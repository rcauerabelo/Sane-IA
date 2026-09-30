package br.com.saneia.controller;

import br.com.saneia.model.OrgaoResponsavel;
import br.com.saneia.model.Regiao;
import br.com.saneia.model.TipoProblema;
import br.com.saneia.model.Usuario;
import br.com.saneia.repository.OrgaoResponsavelRepository;
import br.com.saneia.repository.RegiaoRepository;
import br.com.saneia.repository.TipoProblemaRepository;
import br.com.saneia.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Cadastros de apoio: usuários, regiões e listas de tipos/órgãos. */
@RestController
@RequestMapping("/api")
public class CadastroController {

    private final UsuarioRepository usuarioRepo;
    private final RegiaoRepository regiaoRepo;
    private final TipoProblemaRepository tipoRepo;
    private final OrgaoResponsavelRepository orgaoRepo;

    public CadastroController(UsuarioRepository usuarioRepo, RegiaoRepository regiaoRepo,
                              TipoProblemaRepository tipoRepo, OrgaoResponsavelRepository orgaoRepo) {
        this.usuarioRepo = usuarioRepo;
        this.regiaoRepo = regiaoRepo;
        this.tipoRepo = tipoRepo;
        this.orgaoRepo = orgaoRepo;
    }

    @PostMapping("/usuarios")
    @ResponseStatus(HttpStatus.CREATED)
    public Usuario criarUsuario(@RequestBody Usuario u) { return usuarioRepo.save(u); }

    @PostMapping("/regioes")
    @ResponseStatus(HttpStatus.CREATED)
    public Regiao criarRegiao(@RequestBody Regiao r) { return regiaoRepo.save(r); }

    @GetMapping("/regioes")
    public List<Regiao> regioes() { return regiaoRepo.findAll(); }

    @GetMapping("/tipos")
    public List<TipoProblema> tipos() { return tipoRepo.findAll(); }

    @GetMapping("/orgaos")
    public List<OrgaoResponsavel> orgaos() { return orgaoRepo.findAll(); }
}
