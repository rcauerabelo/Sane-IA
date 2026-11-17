package com.saneia.dto;

import com.saneia.model.BlueprintLimits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class UsuarioDtos {

    private UsuarioDtos() {}

    public record UsuarioResponse(
            String uid,
            String nome,
            String email,
            String telefone,
            String regiaoPadraoId,
            boolean cadastroCompleto,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record SalvarPerfilRequest(
            @NotBlank(message = "Informe seu nome completo.")
            @Size(
                    min = BlueprintLimits.USUARIO_NOME_MIN,
                    max = BlueprintLimits.USUARIO_NOME_MAX,
                    message = "O nome deve ter entre 2 e 120 caracteres."
            )
            String nome,

            @NotBlank(message = "Informe um telefone ou WhatsApp para contato.")
            @Size(
                    max = BlueprintLimits.USUARIO_TELEFONE_MAX,
                    message = "O telefone deve ter no máximo 20 caracteres."
            )
            String telefone,

            @Size(max = 128, message = "Identificador de região padrão inválido.")
            String regiaoPadraoId
    ) {}
}
