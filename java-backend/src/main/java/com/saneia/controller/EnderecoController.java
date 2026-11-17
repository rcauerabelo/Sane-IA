package com.saneia.controller;

import com.saneia.dto.EnderecoDtos.EnderecoResponse;
import com.saneia.dto.EnderecoDtos.SalvarEnderecoRequest;
import com.saneia.security.AuthenticatedUser;
import com.saneia.security.SecurityContextHelper;
import com.saneia.service.EnderecoService;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/enderecos")
@ConditionalOnBean(EnderecoService.class)
public class EnderecoController {

    private final EnderecoService enderecoService;
    private final SecurityContextHelper securityHelper;

    public EnderecoController(EnderecoService enderecoService, SecurityContextHelper securityHelper) {
        this.enderecoService = enderecoService;
        this.securityHelper = securityHelper;
    }

    @GetMapping
    public List<EnderecoResponse> listar() {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return enderecoService.listarDoUsuario(user.uid());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EnderecoResponse criar(@Valid @RequestBody SalvarEnderecoRequest request) {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return enderecoService.criar(user.uid(), request);
    }

    @PutMapping("/{id}")
    public EnderecoResponse atualizar(
            @PathVariable String id,
            @Valid @RequestBody SalvarEnderecoRequest request
    ) {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        return enderecoService.atualizar(user.uid(), id, request);
    }

    @PatchMapping("/{id}/principal")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void definirPrincipal(@PathVariable String id) {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        enderecoService.definirPrincipal(user.uid(), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable String id) {
        AuthenticatedUser user = securityHelper.requireAuthenticatedUser();
        enderecoService.excluir(user.uid(), id);
    }
}
