package com.saneia.dto;

import com.saneia.model.BlueprintLimits;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class EnderecoDtos {

    private EnderecoDtos() {}

    public record EnderecoResponse(
            String id,
            String usuarioId,
            String apelido,
            String cep,
            String logradouro,
            String numero,
            String complemento,
            String bairro,
            String cidade,
            String estado,
            String referencia,
            double latitude,
            double longitude,
            boolean principal,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record SalvarEnderecoRequest(
            @NotBlank(message = "Informe um nome para o endereço (ex.: Casa, Trabalho).")
            @Size(
                    min = BlueprintLimits.ENDERECO_APELIDO_MIN,
                    max = BlueprintLimits.ENDERECO_APELIDO_MAX,
                    message = "O apelido deve ter entre 1 e 40 caracteres."
            )
            String apelido,

            @Size(max = 9, message = "O CEP deve ter 8 dígitos.")
            String cep,

            @NotBlank(message = "Informe o nome da rua ou avenida.")
            @Size(
                    min = BlueprintLimits.ENDERECO_LOGRADOURO_MIN,
                    max = BlueprintLimits.ENDERECO_LOGRADOURO_MAX,
                    message = "O logradouro deve ter entre 2 e 160 caracteres."
            )
            String logradouro,

            @Size(max = BlueprintLimits.ENDERECO_NUMERO_MAX, message = "O número deve ter no máximo 20 caracteres.")
            String numero,

            @Size(max = BlueprintLimits.ENDERECO_COMPLEMENTO_MAX, message = "O complemento deve ter no máximo 80 caracteres.")
            String complemento,

            @NotBlank(message = "Informe o bairro.")
            @Size(
                    min = BlueprintLimits.REGIAO_BAIRRO_MIN,
                    max = BlueprintLimits.REGIAO_BAIRRO_MAX,
                    message = "O bairro deve ter entre 2 e 100 caracteres."
            )
            String bairro,

            @NotBlank(message = "Informe a cidade.")
            @Size(
                    min = BlueprintLimits.REGIAO_CIDADE_MIN,
                    max = BlueprintLimits.REGIAO_CIDADE_MAX,
                    message = "A cidade deve ter entre 2 e 100 caracteres."
            )
            String cidade,

            @NotBlank(message = "Informe a sigla do estado (UF).")
            @Pattern(
                    regexp = "^[a-zA-Z]{2}$",
                    message = "Informe a sigla do estado com 2 letras (ex.: SP)."
            )
            String estado,

            @Size(max = BlueprintLimits.ENDERECO_REFERENCIA_MAX, message = "A referência deve ter no máximo 140 caracteres.")
            String referencia,

            @NotNull(message = "Toque no mapa para marcar a latitude do endereço.")
            @DecimalMin(value = "-90.0", message = "Latitude inválida.")
            @DecimalMax(value = "90.0", message = "Latitude inválida.")
            Double latitude,

            @NotNull(message = "Toque no mapa para marcar a longitude do endereço.")
            @DecimalMin(value = "-180.0", message = "Longitude inválida.")
            @DecimalMax(value = "180.0", message = "Longitude inválida.")
            Double longitude,

            boolean principal
    ) {}
}
