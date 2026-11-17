package com.saneia.dto;

public final class LocalizacaoDtos {

    private LocalizacaoDtos() {}

    public record MapsConfigResponse(
            String apiKey
    ) {}

    public record CepLookupResponse(
            String cep,
            String cepFormatado,
            String logradouro,
            String complemento,
            String bairro,
            String cidade,
            String estado,
            Double latitude,
            Double longitude,
            boolean quotaExceeded
    ) {}

    public record GeocodeResponse(
            String cep,
            String logradouro,
            String numero,
            String bairro,
            String cidade,
            String estado,
            String formattedAddress,
            Double latitude,
            Double longitude
    ) {}
}
