package com.saneia.service;

import com.saneia.dto.UsuarioDtos.SalvarPerfilRequest;
import com.saneia.dto.UsuarioDtos.UsuarioResponse;
import com.saneia.exception.ApiException;
import com.saneia.model.BlueprintLimits;
import com.saneia.repository.UsuarioRepository;
import com.saneia.security.AuthenticatedUser;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnBean(UsuarioRepository.class)
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;

    public UsuarioService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    public UsuarioResponse buscarOuInicializarPerfil(AuthenticatedUser user) {
        return usuarioRepository.findByUid(user.uid())
                .orElseGet(() -> new UsuarioResponse(
                        user.uid(),
                        user.name() != null ? user.name() : "",
                        user.email() != null ? user.email() : "",
                        "",
                        "",
                        false,
                        null,
                        null
                ));
    }

    public UsuarioResponse salvarPerfil(AuthenticatedUser user, SalvarPerfilRequest request) {
        String nome = truncate(request.nome(), BlueprintLimits.USUARIO_NOME_MAX);
        String telefone = truncate(request.telefone(), BlueprintLimits.USUARIO_TELEFONE_MAX);
        String email = truncate(user.email() != null ? user.email() : "", BlueprintLimits.USUARIO_EMAIL_MAX);
        String regiaoPadraoId = truncate(request.regiaoPadraoId(), 128);

        if (nome.length() < BlueprintLimits.USUARIO_NOME_MIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe seu nome completo (mínimo de 2 caracteres).");
        }
        if (telefone.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um telefone ou WhatsApp para contato.");
        }

        return usuarioRepository.saveProfile(user.uid(), email, nome, telefone, regiaoPadraoId);
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return "";
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }
}
