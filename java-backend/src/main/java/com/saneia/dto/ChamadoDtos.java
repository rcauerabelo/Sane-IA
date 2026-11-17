package com.saneia.dto;

import com.saneia.model.BlueprintLimits;
import com.saneia.model.StatusChamado;
import com.saneia.model.UrgenciaIA;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class ChamadoDtos {

    private ChamadoDtos() {}

    public record ChamadoResponse(
            String id,
            String titulo,
            String descricao,
            Instant dataAbertura,
            StatusChamado status,
            String usuarioId,
            String usuarioNome,
            String regiaoId,
            String regiaoResumo,
            String tipoProblemaId,
            String tipoProblemaNome,
            int fotosCount,
            String enderecoId,
            String enderecoResumo,
            Double latitude,
            Double longitude,
            Instant updatedAt
    ) {}

    public record FotoResponse(
            String id,
            String nomeArquivo,
            String mimeType,
            String imagemDataUrl,
            String chamadoId,
            String usuarioId,
            Instant createdAt
    ) {}

    public record AnaliseIAResponse(
            String id,
            UrgenciaIA urgencia,
            String orientacao,
            String respostaBruta,
            Instant dataAnalise,
            String chamadoId,
            String usuarioId,
            String orgaoId,
            String orgaoNome,
            String orgaoContato
    ) {}

    public record ChamadoDetalheResponse(
            ChamadoResponse chamado,
            List<FotoResponse> fotos,
            AnaliseIAResponse analise
    ) {}

    public record CriarChamadoRequest(
            @NotBlank(message = "O título do chamado deve ter pelo menos 3 caracteres.")
            @Size(
                    min = BlueprintLimits.CHAMADO_TITULO_MIN,
                    max = BlueprintLimits.CHAMADO_TITULO_MAX,
                    message = "O título deve ter entre 3 e 150 caracteres."
            )
            String titulo,

            @Size(max = BlueprintLimits.CHAMADO_DESCRICAO_MAX, message = "A descrição deve ter no máximo 2000 caracteres.")
            String descricao,

            @NotBlank(message = "Selecione uma região.")
            @Size(max = 128)
            String regiaoId,

            @NotBlank(message = "Selecione o tipo de problema.")
            @Size(max = 128)
            String tipoProblemaId,

            @Size(max = 128)
            String enderecoId
    ) {}

    public record AtualizarStatusRequest(
            @NotNull(message = "Informe o novo status do chamado.")
            StatusChamado status
    ) {}
}
