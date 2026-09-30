package br.com.saneia.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

/**
 * Cliente da API de IA (formato compatível com OpenAI: Groq, OpenRouter etc.).
 * Para trocar de provedor, basta mudar url, key e model no application.properties.
 */
@Service
public class IAClient {

    @Value("${ia.api.url}")
    private String url;

    @Value("${ia.api.key}")
    private String apiKey;

    @Value("${ia.api.model}")
    private String model;

    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    public String enviar(String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Chave da API de IA não configurada. Defina a variável de ambiente GROQ_API_KEY.");
        }
        try {
            Map<String, Object> corpo = Map.of(
                    "model", model,
                    "temperature", 0.2,
                    "response_format", Map.of("type", "json_object"),
                    "messages", List.of(
                            Map.of("role", "system", "content",
                                    "Você é um assistente especializado em saneamento básico e abastecimento de água no Brasil. Responda sempre em português do Brasil."),
                            Map.of("role", "user", "content", prompt)));

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(corpo)))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Erro da API de IA (" + resp.statusCode() + "): " + resp.body());
            }
            return mapper.readTree(resp.body()).path("choices").get(0).path("message").path("content").asText();
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Falha ao chamar a IA: " + e.getMessage());
        }
    }
}
