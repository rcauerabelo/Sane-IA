package com.saneia.dto;

import com.saneia.model.BlueprintLimits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class CatalogoDtos {

    private CatalogoDtos() {}

    public record RegiaoResponse(
            String id,
            String bairro,
            String cidade,
            String estado,
            String criadoPorUid,
            Instant createdAt
    ) {}

    public record CriarRegiaoRequest(
            @NotBlank(message = "Informe o nome do bairro.")
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
            String estado
    ) {}

    public record TipoProblemaResponse(
            String id,
            String nome
    ) {}

    public record OrgaoResponsavelResponse(
            String id,
            String nome,
            String contato
    ) {}

    public record CatalogosResponse(
            List<TipoProblemaResponse> tipos,
            List<OrgaoResponsavelResponse> orgaos,
            List<RegiaoResponse> regioes
    ) {}
}
