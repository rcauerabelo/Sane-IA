package com.saneia.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.saneia.client.GroqAiClient;
import com.saneia.dto.CatalogoDtos.OrgaoResponsavelResponse;
import com.saneia.dto.CatalogoDtos.RegiaoResponse;
import com.saneia.dto.CatalogoDtos.TipoProblemaResponse;
import com.saneia.dto.ChamadoDtos.AnaliseIAResponse;
import com.saneia.dto.ChamadoDtos.ChamadoDetalheResponse;
import com.saneia.dto.ChamadoDtos.ChamadoResponse;
import com.saneia.dto.ChamadoDtos.CriarChamadoRequest;
import com.saneia.dto.ChamadoDtos.FotoResponse;
import com.saneia.dto.EnderecoDtos.EnderecoResponse;
import com.saneia.dto.UsuarioDtos.UsuarioResponse;
import com.saneia.exception.ApiException;
import com.saneia.model.BlueprintLimits;
import com.saneia.model.StatusChamado;
import com.saneia.model.UrgenciaIA;
import com.saneia.repository.CatalogoRepository;
import com.saneia.repository.ChamadoRepository;
import com.saneia.repository.EnderecoRepository;
import com.saneia.repository.UsuarioRepository;
import com.saneia.security.AuthenticatedUser;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@ConditionalOnBean({ChamadoRepository.class, UsuarioRepository.class, CatalogoRepository.class, EnderecoRepository.class})
public class ChamadoService {

    private final ChamadoRepository chamadoRepository;
    private final UsuarioRepository usuarioRepository;
    private final CatalogoRepository catalogoRepository;
    private final EnderecoRepository enderecoRepository;
    private final GroqAiClient groqAiClient;
    private final ObjectMapper objectMapper;

    public ChamadoService(
            ChamadoRepository chamadoRepository,
            UsuarioRepository usuarioRepository,
            CatalogoRepository catalogoRepository,
            EnderecoRepository enderecoRepository,
            GroqAiClient groqAiClient,
            ObjectMapper objectMapper
    ) {
        this.chamadoRepository = chamadoRepository;
        this.usuarioRepository = usuarioRepository;
        this.catalogoRepository = catalogoRepository;
        this.enderecoRepository = enderecoRepository;
        this.groqAiClient = groqAiClient;
        this.objectMapper = objectMapper;
    }

    public List<ChamadoResponse> listarDoUsuario(String uid, StatusChamado filtroStatus) {
        List<ChamadoResponse> all = chamadoRepository.findAllByUsuarioId(uid);
        if (filtroStatus == null) {
            return all;
        }
        return all.stream()
                .filter(c -> c.status() == filtroStatus)
                .toList();
    }

    public ChamadoDetalheResponse buscarDetalhe(String uid, String chamadoId) {
        ChamadoResponse chamado = buscarChamadoDoUsuario(uid, chamadoId);
        List<FotoResponse> fotos = chamadoRepository.findFotosByChamadoId(chamadoId);
        AnaliseIAResponse analise = chamadoRepository.findAnaliseAtual(chamadoId).orElse(null);
        return new ChamadoDetalheResponse(chamado, fotos, analise);
    }

    public ChamadoResponse abrir(AuthenticatedUser authUser, CriarChamadoRequest request) {
        String titulo = truncate(request.titulo(), BlueprintLimits.CHAMADO_TITULO_MAX);
        if (titulo.length() < BlueprintLimits.CHAMADO_TITULO_MIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "O título do chamado deve ter pelo menos 3 caracteres.");
        }
        String descricao = truncate(request.descricao(), BlueprintLimits.CHAMADO_DESCRICAO_MAX);

        UsuarioResponse usuario = usuarioRepository.findByUid(authUser.uid())
                .filter(UsuarioResponse::cadastroCompleto)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "Complete seu cadastro com nome e telefone antes de abrir um chamado."
                ));

        RegiaoResponse regiao = catalogoRepository.findRegiaoById(request.regiaoId().trim())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Região não encontrada."));

        TipoProblemaResponse tipo = catalogoRepository.findTipoById(request.tipoProblemaId().trim())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tipo de problema não encontrado."));

        String regiaoResumo = truncate(
                regiao.bairro() + ", " + regiao.cidade() + " - " + regiao.estado(),
                BlueprintLimits.CHAMADO_REGIAO_RESUMO_MAX
        );

        Map<String, Object> fields = new HashMap<>();
        fields.put("titulo", titulo);
        fields.put("descricao", descricao);
        fields.put("status", StatusChamado.ABERTO.name());
        fields.put("usuarioId", authUser.uid());
        fields.put("usuarioNome", truncate(usuario.nome(), BlueprintLimits.USUARIO_NOME_MAX));
        fields.put("regiaoId", regiao.id());
        fields.put("regiaoResumo", regiaoResumo);
        fields.put("tipoProblemaId", tipo.id());
        fields.put("tipoProblemaNome", truncate(tipo.nome(), 100));
        fields.put("fotosCount", 0);

        if (StringUtils.hasText(request.enderecoId())) {
            EnderecoResponse endereco = enderecoRepository.findById(authUser.uid(), request.enderecoId().trim())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Endereço selecionado não encontrado."));
            fields.put("enderecoId", truncate(endereco.id(), 128));
            fields.put("enderecoResumo", EnderecoService.formatEnderecoResumo(endereco));
            fields.put("latitude", endereco.latitude());
            fields.put("longitude", endereco.longitude());
        }

        return chamadoRepository.create(fields);
    }

    public ChamadoResponse atualizarStatus(String uid, String chamadoId, StatusChamado novoStatus) {
        ChamadoResponse chamado = buscarChamadoDoUsuario(uid, chamadoId);
        if (novoStatus == StatusChamado.ABERTO && chamado.status() != StatusChamado.ABERTO) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Não é possível reverter um chamado para ABERTO.");
        }
        return chamadoRepository.updateStatus(chamadoId, novoStatus);
    }

    public FotoResponse anexarFoto(String uid, String chamadoId, MultipartFile arquivo) {
        ChamadoResponse chamado = buscarChamadoDoUsuario(uid, chamadoId);

        if (chamado.fotosCount() >= BlueprintLimits.CHAMADO_MAX_FOTOS) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Limite máximo de " + BlueprintLimits.CHAMADO_MAX_FOTOS + " fotos por chamado atingido."
            );
        }

        if (arquivo == null || arquivo.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Campo 'arquivo' é obrigatório.");
        }
        if (arquivo.getSize() > BlueprintLimits.FOTO_MAX_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "A foto excede o limite máximo de 5 MB.");
        }

        String mimeType = arquivo.getContentType() != null ? arquivo.getContentType().toLowerCase() : "";
        if (!BlueprintLimits.FOTO_ALLOWED_MIME_TYPES.contains(mimeType)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Formato de imagem não suportado. Envie JPEG, PNG ou WebP."
            );
        }

        String originalName = StringUtils.hasText(arquivo.getOriginalFilename())
                ? arquivo.getOriginalFilename().trim()
                : "foto.jpg";
        String sanitizedName = truncate(originalName.replaceAll("[^a-zA-Z0-9._-]", "_"), 255);
        if (sanitizedName.isEmpty()) {
            sanitizedName = "foto.jpg";
        }

        byte[] bytes;
        try {
            bytes = arquivo.getBytes();
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Não foi possível ler os bytes da imagem enviada.", ex);
        }

        String dataUrl = "data:" + mimeType + ";base64," + Base64.getEncoder().encodeToString(bytes);
        if (dataUrl.length() > BlueprintLimits.FOTO_DATA_URL_MAX_CHARS) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "A imagem codificada excede o limite suportado pelo documento (~900 KB). Reduza a resolução antes de enviar."
            );
        }

        return chamadoRepository.attachFotoAndIncrementCount(
                chamadoId,
                uid,
                sanitizedName,
                mimeType,
                dataUrl
        );
    }

    public AnaliseIAResponse analisar(String uid, String chamadoId) {
        ChamadoResponse chamado = buscarChamadoDoUsuario(uid, chamadoId);
        List<OrgaoResponsavelResponse> orgaos = catalogoRepository.findAllOrgaos();

        String prompt = montarPrompt(chamado, orgaos);
        String respostaBruta = groqAiClient.enviarPrompt(prompt);

        ParsedAnalise parsed = parseRespostaIa(respostaBruta, orgaos);

        Map<String, Object> fields = new HashMap<>();
        fields.put("urgencia", parsed.urgencia().name());
        fields.put("orientacao", truncate(parsed.orientacao(), BlueprintLimits.ANALISE_ORIENTACAO_MAX));
        fields.put("respostaBruta", truncate(respostaBruta, BlueprintLimits.ANALISE_RESPOSTA_BRUTA_MAX));
        fields.put("chamadoId", chamado.id());
        fields.put("usuarioId", uid);
        fields.put("orgaoId", parsed.orgao() != null ? truncate(parsed.orgao().id(), 128) : "");
        fields.put("orgaoNome", parsed.orgao() != null ? truncate(parsed.orgao().nome(), 120) : "");
        fields.put("orgaoContato", parsed.orgao() != null ? truncate(parsed.orgao().contato(), 100) : "");

        return chamadoRepository.saveAnaliseAndUpdateStatus(chamado.id(), chamado.status(), fields);
    }

    private ChamadoResponse buscarChamadoDoUsuario(String uid, String chamadoId) {
        ChamadoResponse chamado = chamadoRepository.findById(chamadoId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Chamado não encontrado."));
        if (!uid.equals(chamado.usuarioId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Você não tem permissão para acessar este chamado.");
        }
        return chamado;
    }

    String montarPrompt(ChamadoResponse chamado, List<OrgaoResponsavelResponse> orgaos) {
        String nomesOrgaos = orgaos.stream()
                .map(OrgaoResponsavelResponse::nome)
                .collect(Collectors.joining("; "));

        String local = StringUtils.hasText(chamado.enderecoResumo())
                ? chamado.regiaoResumo() + " (" + chamado.enderecoResumo() + ")"
                : chamado.regiaoResumo();

        return "Analise o chamado de saneamento abaixo e responda SOMENTE em JSON com as chaves: "
                + "\"tipo\" (texto), \"urgencia\" (BAIXA, MEDIA ou ALTA), "
                + "\"orgao_responsavel\" (exatamente um destes: " + nomesOrgaos + ") e "
                + "\"orientacao\" (passos práticos para o morador e para o órgão, em até 5 linhas).\n\n"
                + "Título: " + chamado.titulo() + "\n"
                + "Tipo informado: " + chamado.tipoProblemaNome() + "\n"
                + "Descrição: " + (chamado.descricao() != null ? chamado.descricao() : "") + "\n"
                + "Região: " + local + "\n"
                + "Fotos anexadas: " + chamado.fotosCount();
    }

    ParsedAnalise parseRespostaIa(String respostaBruta, List<OrgaoResponsavelResponse> orgaos) {
        try {
            JsonNode json = objectMapper.readTree(respostaBruta);
            String rawUrg = json.path("urgencia").asText("MEDIA").trim().toUpperCase();
            UrgenciaIA urgencia = switch (rawUrg) {
                case "BAIXA" -> UrgenciaIA.BAIXA;
                case "MEDIA" -> UrgenciaIA.MEDIA;
                case "ALTA" -> UrgenciaIA.ALTA;
                default -> UrgenciaIA.MEDIA;
            };
            String orientacao = json.path("orientacao").asText("");
            String nomeOrgao = json.path("orgao_responsavel").asText("").trim();
            OrgaoResponsavelResponse matched = orgaos.stream()
                    .filter(o -> o.nome().equalsIgnoreCase(nomeOrgao))
                    .findFirst()
                    .orElse(null);
            return new ParsedAnalise(urgencia, orientacao, matched);
        } catch (Exception ex) {
            return new ParsedAnalise(UrgenciaIA.INDEFINIDA, respostaBruta != null ? respostaBruta : "", null);
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return "";
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }

    record ParsedAnalise(
            UrgenciaIA urgencia,
            String orientacao,
            OrgaoResponsavelResponse orgao
    ) {}
}
