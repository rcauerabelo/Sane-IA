package com.saneia.client;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.saneia.config.SaneIaProperties;
import com.saneia.dto.LocalizacaoDtos.GeocodeResponse;
import com.saneia.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Objects;

@Component
public class GoogleMapsGeocodeClient {

    private static final String SOLUTION_HEADER = "X-Goog-Maps-Solution-ID";

    private final RestClient googleMapsRestClient;
    private final SaneIaProperties properties;

    public GoogleMapsGeocodeClient(RestClient googleMapsRestClient, SaneIaProperties properties) {
        this.googleMapsRestClient = googleMapsRestClient;
        this.properties = properties;
    }

    public boolean isConfigured() {
        return properties.maps() != null && StringUtils.hasText(properties.maps().apiKey());
    }

    public String getApiKey() {
        return properties.maps() != null && properties.maps().apiKey() != null
                ? properties.maps().apiKey().trim()
                : "";
    }

    public GeocodeResponse reverseGeocode(double lat, double lng) {
        URI uri = UriComponentsBuilder.fromUriString(properties.maps().geocodeUrl())
                .queryParam("language", "pt-BR")
                .queryParam("region", "br")
                .queryParam("latlng", lat + "," + lng)
                .queryParam("key", getApiKey())
                .build()
                .toUri();

        GoogleApiPayload data = execute(uri);
        List<GoogleResult> results = data.results() != null ? data.results() : List.of();
        if (results.isEmpty()) {
            return new GeocodeResponse("", "", "", "", "", "", "", lat, lng);
        }
        return extractAddress(results, lat, lng);
    }

    public GeocodeResponse forwardGeocode(String address) {
        URI uri = UriComponentsBuilder.fromUriString(properties.maps().geocodeUrl())
                .queryParam("language", "pt-BR")
                .queryParam("region", "br")
                .queryParam("address", address)
                .queryParam("components", "country:BR")
                .queryParam("key", getApiKey())
                .build()
                .encode()
                .toUri();

        GoogleApiPayload data = execute(uri);
        List<GoogleResult> results = data.results() != null ? data.results() : List.of();
        if (results.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Endereço não encontrado no mapa.");
        }
        return extractAddress(results, null, null);
    }

    private GoogleApiPayload execute(URI uri) {
        String apiKey = getApiKey();
        if (!StringUtils.hasText(apiKey)) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Chave da API do Google Maps não configurada no servidor."
            );
        }

        try {
            GoogleApiPayload payload = googleMapsRestClient.get()
                    .uri(uri)
                    .header(SOLUTION_HEADER, properties.maps().solutionId())
                    .retrieve()
                    .body(GoogleApiPayload.class);

            if (payload == null) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "Resposta vazia da API de Geocodificação.");
            }

            if ("OVER_QUERY_LIMIT".equals(payload.status())
                    || (payload.error() != null && "RESOURCE_EXHAUSTED".equals(payload.error().status()))) {
                throw new ApiException(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "Limite de consultas do Google Maps atingido. Tente novamente mais tarde."
                );
            }

            if ("REQUEST_DENIED".equals(payload.status())) {
                throw new ApiException(
                        HttpStatus.FORBIDDEN,
                        StringUtils.hasText(payload.errorMessage())
                                ? payload.errorMessage()
                                : "Acesso negado à API de Geocodificação."
                );
            }

            return payload;
        } catch (HttpStatusCodeException ex) {
            if (ex.getStatusCode().value() == 429) {
                throw new ApiException(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "Limite de consultas do Google Maps atingido. Tente novamente mais tarde.",
                        ex
                );
            }
            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "Erro ao consultar Geocoding API (" + ex.getStatusCode().value() + ").",
                    ex
            );
        } catch (RestClientException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Falha de comunicação com Google Maps Geocoding.", ex);
        }
    }

    private GeocodeResponse extractAddress(List<GoogleResult> results, Double overrideLat, Double overrideLng) {
        GoogleResult first = results.getFirst();
        List<AddressComponent> allComponents = results.stream()
                .map(GoogleResult::addressComponents)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .toList();

        String rawPostal = findComp(allComponents, List.of("postal_code"), false).replaceAll("\\D", "");
        String cep = rawPostal.length() == 8 ? rawPostal : "";
        String logradouro = findComp(allComponents, List.of("route", "street_address", "premise"), false);
        String numero = findComp(allComponents, List.of("street_number"), false);
        String bairro = findComp(allComponents, List.of(
                "sublocality_level_1", "sublocality", "neighborhood", "sublocality_level_2"
        ), false);
        String cidade = findComp(allComponents, List.of("administrative_area_level_2", "locality"), false);
        String rawEstado = findComp(allComponents, List.of("administrative_area_level_1"), true).toUpperCase();
        String estado = rawEstado.matches("^[A-Z]{2}$") ? rawEstado : "";

        LatLng loc = first.geometry() != null ? first.geometry().location() : null;
        Double lat = overrideLat != null ? overrideLat : (loc != null ? loc.lat() : null);
        Double lng = overrideLng != null ? overrideLng : (loc != null ? loc.lng() : null);

        return new GeocodeResponse(
                cep,
                logradouro,
                numero,
                bairro,
                cidade,
                estado,
                first.formattedAddress() != null ? first.formattedAddress() : "",
                lat,
                lng
        );
    }

    private String findComp(List<AddressComponent> components, List<String> types, boolean useShort) {
        for (String type : types) {
            for (AddressComponent comp : components) {
                if (comp.types() != null && comp.types().contains(type)) {
                    String val = useShort ? comp.shortName() : comp.longName();
                    return val == null ? "" : val.trim();
                }
            }
        }
        return "";
    }

    private record GoogleApiPayload(
            String status,
            @JsonProperty("error_message") String errorMessage,
            GoogleError error,
            List<GoogleResult> results
    ) {}

    private record GoogleError(String status, String message) {}

    private record GoogleResult(
            @JsonProperty("formatted_address") String formattedAddress,
            @JsonProperty("address_components") List<AddressComponent> addressComponents,
            Geometry geometry
    ) {}

    private record AddressComponent(
            @JsonProperty("long_name") String longName,
            @JsonProperty("short_name") String shortName,
            List<String> types
    ) {}

    private record Geometry(LatLng location) {}

    private record LatLng(Double lat, Double lng) {}
}
