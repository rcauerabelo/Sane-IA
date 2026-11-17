package com.saneia.service;

import com.saneia.client.GoogleMapsGeocodeClient;
import com.saneia.client.ViaCepClient;
import com.saneia.dto.LocalizacaoDtos.CepLookupResponse;
import com.saneia.dto.LocalizacaoDtos.GeocodeResponse;
import com.saneia.dto.LocalizacaoDtos.MapsConfigResponse;
import com.saneia.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class LocalizacaoService {

    private final ViaCepClient viaCepClient;
    private final GoogleMapsGeocodeClient googleMapsGeocodeClient;

    public LocalizacaoService(
            ViaCepClient viaCepClient,
            GoogleMapsGeocodeClient googleMapsGeocodeClient
    ) {
        this.viaCepClient = viaCepClient;
        this.googleMapsGeocodeClient = googleMapsGeocodeClient;
    }

    public MapsConfigResponse obterConfiguracaoMaps() {
        return new MapsConfigResponse(googleMapsGeocodeClient.getApiKey());
    }

    public CepLookupResponse buscarCep(String rawCep, boolean geocode) {
        String digits = rawCep == null ? "" : rawCep.replaceAll("\\D", "");
        if (!digits.matches("^\\d{8}$")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um CEP válido com 8 dígitos.");
        }

        ViaCepClient.ViaCepResult viaCep = viaCepClient.lookup(digits);

        Double latitude = null;
        Double longitude = null;
        boolean quotaExceeded = false;

        if (geocode && googleMapsGeocodeClient.isConfigured()) {
            String cidadeEstado = (!viaCep.cidade().isEmpty() && !viaCep.estado().isEmpty())
                    ? viaCep.cidade() + " - " + viaCep.estado()
                    : viaCep.cidade();

            String query = Stream.of(
                            viaCep.logradouro(),
                            viaCep.bairro(),
                            cidadeEstado,
                            viaCep.cepFormatado(),
                            "Brasil"
                    )
                    .filter(Objects::nonNull)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.joining(", "));

            try {
                GeocodeResponse geo = googleMapsGeocodeClient.forwardGeocode(query);
                latitude = geo.latitude();
                longitude = geo.longitude();
            } catch (ApiException ex) {
                if (ex.getStatus() == HttpStatus.TOO_MANY_REQUESTS) {
                    quotaExceeded = true;
                }
            }
        }

        return new CepLookupResponse(
                viaCep.cep(),
                viaCep.cepFormatado(),
                viaCep.logradouro(),
                viaCep.complemento(),
                viaCep.bairro(),
                viaCep.cidade(),
                viaCep.estado(),
                latitude,
                longitude,
                quotaExceeded
        );
    }

    public GeocodeResponse reverseGeocode(Double lat, Double lng) {
        if (lat == null || !Double.isFinite(lat) || lat < -90 || lat > 90) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Latitude inválida.");
        }
        if (lng == null || !Double.isFinite(lng) || lng < -180 || lng > 180) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Longitude inválida.");
        }
        return googleMapsGeocodeClient.reverseGeocode(lat, lng);
    }

    public GeocodeResponse forwardGeocode(String q) {
        String trimmed = q == null ? "" : q.trim();
        if (trimmed.length() < 3 || trimmed.length() > 300) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um endereço válido para localizar no mapa.");
        }
        return googleMapsGeocodeClient.forwardGeocode(trimmed);
    }
}
