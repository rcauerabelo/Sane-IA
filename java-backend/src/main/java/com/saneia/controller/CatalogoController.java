package com.saneia.controller;

import com.saneia.dto.CatalogoDtos.CatalogosResponse;
import com.saneia.dto.CatalogoDtos.CriarRegiaoRequest;
import com.saneia.dto.CatalogoDtos.OrgaoResponsavelResponse;
import com.saneia.dto.CatalogoDtos.RegiaoResponse;
import com.saneia.dto.CatalogoDtos.TipoProblemaResponse;
import com.saneia.security.AuthenticatedUser;
import com.saneia.security.SecurityContextHelper;
import com.saneia.service.CatalogoService;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
@ConditionalOnBean(CatalogoService.class)
public class CatalogoController {

    private final CatalogoService catalogoService;
    private final SecurityContextHelper securityHelper;

    public CatalogoController(CatalogoService catalogoService, SecurityContextHelper securityHelper) {
        this.catalogoService = catalogoService;
        this.securityHelper = securityHelper;
    }

    @GetMapping("/catalogos")
    public CatalogosResponse carregarCatalogos() {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return catalogoService.carregarCatalogos(user.uid());
    }

    @GetMapping("/regioes")
    public List<RegiaoResponse> listarRegioes() {
        return catalogoService.listarRegioes();
    }

    @PostMapping("/regioes")
    @ResponseStatus(HttpStatus.CREATED)
    public RegiaoResponse criarRegiao(@Valid @RequestBody CriarRegiaoRequest request) {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return catalogoService.criarRegiao(user.uid(), request);
    }

    @GetMapping("/tipos")
    public List<TipoProblemaResponse> listarTipos() {
        return catalogoService.listarTipos();
    }

    @GetMapping("/orgaos")
    public List<OrgaoResponsavelResponse> listarOrgaos() {
        return catalogoService.listarOrgaos();
    }
}
