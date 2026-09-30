package br.com.saneia.service;

import br.com.saneia.dto.NovoChamadoRequest;
import br.com.saneia.model.*;
import br.com.saneia.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ChamadoService {

    private final ChamadoRepository chamadoRepo;
    private final UsuarioRepository usuarioRepo;
    private final RegiaoRepository regiaoRepo;
    private final TipoProblemaRepository tipoRepo;
    private final OrgaoResponsavelRepository orgaoRepo;
    private final FotoRepository fotoRepo;
    private final AnaliseIARepository analiseRepo;
    private final IAClient iaClient;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${saneia.uploads.dir}")
    private String pastaUploads;

    public ChamadoService(ChamadoRepository chamadoRepo, UsuarioRepository usuarioRepo,
                          RegiaoRepository regiaoRepo, TipoProblemaRepository tipoRepo,
                          OrgaoResponsavelRepository orgaoRepo, FotoRepository fotoRepo,
                          AnaliseIARepository analiseRepo, IAClient iaClient) {
        this.chamadoRepo = chamadoRepo;
        this.usuarioRepo = usuarioRepo;
        this.regiaoRepo = regiaoRepo;
        this.tipoRepo = tipoRepo;
        this.orgaoRepo = orgaoRepo;
        this.fotoRepo = fotoRepo;
        this.analiseRepo = analiseRepo;
        this.iaClient = iaClient;
    }

    // ---------- Funcionalidade 1: abrir chamado (+ fotos) ----------

    @Transactional
    public Chamado abrir(NovoChamadoRequest req) {
        Chamado c = new Chamado();
        c.setTitulo(req.titulo());
        c.setDescricao(req.descricao());
        c.setUsuario(usuarioRepo.findById(req.usuarioId())
                .orElseThrow(() -> naoEncontrado("Usuário")));
        c.setRegiao(regiaoRepo.findById(req.regiaoId())
                .orElseThrow(() -> naoEncontrado("Região")));
        c.setTipoProblema(tipoRepo.findById(req.tipoProblemaId())
                .orElseThrow(() -> naoEncontrado("Tipo de problema")));
        return chamadoRepo.save(c);
    }

    @Transactional
    public Foto anexarFoto(Long chamadoId, MultipartFile arquivo) throws IOException {
        Chamado c = buscar(chamadoId);
        Path pasta = Path.of(pastaUploads);
        Files.createDirectories(pasta);

        String original = arquivo.getOriginalFilename() == null ? "foto" : arquivo.getOriginalFilename();
        String nome = UUID.randomUUID() + "_" + original.replaceAll("[^a-zA-Z0-9._-]", "_");
        Path destino = pasta.resolve(nome);
        Files.copy(arquivo.getInputStream(), destino);

        Foto f = new Foto();
        f.setCaminhoArquivo(destino.toString());
        f.setChamado(c);
        return fotoRepo.save(f);
    }

    // ---------- Funcionalidades 2 e 3: enviar para a IA e salvar a resposta ----------

    @Transactional
    public AnaliseIA analisar(Long chamadoId) {
        Chamado c = buscar(chamadoId);
        List<OrgaoResponsavel> orgaos = orgaoRepo.findAll();

        String resposta = iaClient.enviar(montarPrompt(c, orgaos));

        AnaliseIA a = c.getAnalise() != null ? c.getAnalise() : new AnaliseIA();
        a.setChamado(c);
        a.setRespostaBruta(resposta);
        a.setDataAnalise(LocalDateTime.now());

        try {
            JsonNode json = mapper.readTree(resposta);
            a.setUrgencia(json.path("urgencia").asText("MEDIA").toUpperCase());
            a.setOrientacao(json.path("orientacao").asText(""));
            String nomeOrgao = json.path("orgao_responsavel").asText("");
            a.setOrgao(orgaos.stream()
                    .filter(o -> o.getNome().equalsIgnoreCase(nomeOrgao))
                    .findFirst().orElse(null));
        } catch (JsonProcessingException e) {
            a.setUrgencia("INDEFINIDA");
            a.setOrientacao(resposta);
        }

        c.setAnalise(a);
        c.setStatus(StatusChamado.EM_ANALISE);
        return analiseRepo.save(a);
    }

    private String montarPrompt(Chamado c, List<OrgaoResponsavel> orgaos) {
        String nomesOrgaos = orgaos.stream().map(OrgaoResponsavel::getNome).collect(Collectors.joining("; "));
        return "Analise o chamado de saneamento abaixo e responda SOMENTE em JSON com as chaves: "
                + "\"tipo\" (texto), \"urgencia\" (BAIXA, MEDIA ou ALTA), "
                + "\"orgao_responsavel\" (exatamente um destes: " + nomesOrgaos + ") e "
                + "\"orientacao\" (passos práticos para o morador e para o órgão, em até 5 linhas).\n\n"
                + "Título: " + c.getTitulo() + "\n"
                + "Tipo informado: " + c.getTipoProblema().getNome() + "\n"
                + "Descrição: " + c.getDescricao() + "\n"
                + "Região: " + c.getRegiao().getBairro() + ", " + c.getRegiao().getCidade()
                + " - " + c.getRegiao().getEstado() + "\n"
                + "Fotos anexadas: " + c.getFotos().size();
    }

    // ---------- Consultas ----------

    public Chamado buscar(Long id) {
        return chamadoRepo.findById(id).orElseThrow(() -> naoEncontrado("Chamado"));
    }

    public List<Chamado> listar() {
        return chamadoRepo.findAll();
    }

    private ResponseStatusException naoEncontrado(String o) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, o + " não encontrado(a)");
    }
}
