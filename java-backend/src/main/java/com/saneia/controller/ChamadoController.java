package com.saneia.controller;

import com.saneia.dto.ChamadoDtos.AnaliseIAResponse;
import com.saneia.dto.ChamadoDtos.AtualizarStatusRequest;
import com.saneia.dto.ChamadoDtos.ChamadoDetalheResponse;
import com.saneia.dto.ChamadoDtos.ChamadoResponse;
import com.saneia.dto.ChamadoDtos.CriarChamadoRequest;
import com.saneia.dto.ChamadoDtos.FotoResponse;
import com.saneia.model.StatusChamado;
import com.saneia.security.AuthenticatedUser;
import com.saneia.security.SecurityContextHelper;
import com.saneia.service.ChamadoService;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/chamados")
@ConditionalOnBean(ChamadoService.class)
public class ChamadoController {

    private final ChamadoService chamadoService;
    private final SecurityContextHelper securityHelper;

    public ChamadoController(ChamadoService chamadoService, SecurityContextHelper securityHelper) {
        this.chamadoService = chamadoService;
        this.securityHelper = securityHelper;
    }

    @GetMapping
    public List<ChamadoResponse> listar(
            @RequestParam(name = "status", required = false) StatusChamado status
    ) {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return chamadoService.listarDoUsuario(user.uid(), status);
    }

    @GetMapping("/{id}")
    public ChamadoDetalheResponse buscarDetalhe(@PathVariable String id) {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return chamadoService.buscarDetalhe(user.uid(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChamadoResponse abrir(@Valid @RequestBody CriarChamadoRequest request) {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return chamadoService.abrir(user, request);
    }

    @PatchMapping("/{id}/status")
    public ChamadoResponse atualizarStatus(
            @PathVariable String id,
            @Valid @RequestBody AtualizarStatusRequest request
    ) {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return chamadoService.atualizarStatus(user.uid(), id, request.status());
    }

    @PostMapping(value = "/{id}/fotos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public FotoResponse anexarFoto(
            @PathVariable String id,
            @RequestPart("arquivo") MultipartFile arquivo
    ) {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return chamadoService.anexarFoto(user.uid(), id, arquivo);
    }

    @PostMapping("/{id}/analisar")
    public AnaliseIAResponse analisar(@PathVariable String id) {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return chamadoService.analisar(user.uid(), id);
    }
}
