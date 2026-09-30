package br.com.saneia.dto;

public record NovoChamadoRequest(
        String titulo,
        String descricao,
        Long usuarioId,
        Long regiaoId,
        Long tipoProblemaId) {
}
