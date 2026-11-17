package com.saneia.controller;

import com.saneia.dto.UsuarioDtos.SalvarPerfilRequest;
import com.saneia.dto.UsuarioDtos.UsuarioResponse;
import com.saneia.security.AuthenticatedUser;
import com.saneia.security.SecurityContextHelper;
import com.saneia.service.UsuarioService;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
@ConditionalOnBean(UsuarioService.class)
public class PerfilController {

    private final UsuarioService usuarioService;
    private final SecurityContextHelper securityHelper;

    public PerfilController(UsuarioService usuarioService, SecurityContextHelper securityHelper) {
        this.usuarioService = usuarioService;
        this.securityHelper = securityHelper;
    }

    @GetMapping
    public UsuarioResponse obterPerfil() {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return usuarioService.buscarOuInicializarPerfil(user);
    }

    @PutMapping
    public UsuarioResponse salvarPerfil(@Valid @RequestBody SalvarPerfilRequest request) {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return usuarioService.salvarPerfil(user, request);
    }
}
