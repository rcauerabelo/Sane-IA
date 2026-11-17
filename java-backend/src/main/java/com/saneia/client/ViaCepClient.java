package com.saneia.client;

import com.saneia.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class ViaCepClient {

    private final RestClient viaCepRestClient;

    public ViaCepClient(RestClient viaCepRestClient) {
        this.viaCepRestClient = viaCepRestClient;
    }

    public ViaCepResult lookup(String digits) {
        try {
            ViaCepRawResponse raw = viaCepRestClient.get()
                    .uri("/{cep}/json/", digits)
                    .retrieve()
                    .body(ViaCepRawResponse.class);

            if (raw == null) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "Resposta vazia do serviço de CEP.");
            }
            if (Boolean.TRUE.equals(raw.erro()) || "true".equalsIgnoreCase(String.valueOf(raw.erro()))) {
                throw new ApiException(HttpStatus.NOT_FOUND, "CEP não encontrado.");
            }

            return new ViaCepResult(
                    digits,
                    digits.substring(0, 5) + "-" + digits.substring(5),
                    safeTrim(raw.logradouro()),
                    safeTrim(raw.complemento()),
                    safeTrim(raw.bairro()),
                    safeTrim(raw.localidade()),
                    safeTrim(raw.uf()).toUpperCase()
            );
        } catch (ApiException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Não foi possível consultar o serviço de CEP.", ex);
        }
    }

    private String safeTrim(String val) {
        return val == null ? "" : val.trim();
    }

    private record ViaCepRawResponse(
            Object erro,
            String cep,
            String logradouro,
            String complemento,
            String bairro,
            String localidade,
            String uf
    ) {}

    public record ViaCepResult(
            String cep,
            String cepFormatado,
            String logradouro,
            String complemento,
            String bairro,
            String cidade,
            String estado
    ) {}
}
