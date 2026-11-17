package com.saneia.client;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.saneia.config.SaneIaProperties;
import com.saneia.exception.ApiException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

/**
 * Cliente da API de IA (compatível com OpenAI / Groq).
 * A chave GROQ_API_KEY é consumida exclusivamente no servidor via SaneIaProperties.
 */
@Component
public class GroqAiClient {

    private static final String SYSTEM_PROMPT =
            "Você é um assistente especializado em saneamento básico e abastecimento de água no Brasil. Responda sempre em português do Brasil.";

    private final RestClient groqRestClient;
    private final SaneIaProperties properties;

    public GroqAiClient(RestClient groqRestClient, SaneIaProperties properties) {
        this.groqRestClient = groqRestClient;
        this.properties = properties;
    }

    public String enviarPrompt(String prompt) {
        SaneIaProperties.IaProperties ia = properties.ia();
        if (ia == null || !StringUtils.hasText(ia.apiKey())) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Chave da API de IA não configurada. Defina a variável de ambiente GROQ_API_KEY."
            );
        }

        ChatRequest body = new ChatRequest(
                ia.model(),
                0.2,
                new ResponseFormat("json_object"),
                List.of(
                        new ChatMessage("system", SYSTEM_PROMPT),
                        new ChatMessage("user", prompt)
                )
        );

        try {
            ChatResponse response = groqRestClient.post()
                    .uri(ia.apiUrl())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + ia.apiKey().trim())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(ChatResponse.class);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                return "";
            }
            ChatMessage message = response.choices().getFirst().message();
            return message != null && message.content() != null ? message.content() : "";
        } catch (HttpStatusCodeException ex) {
            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "Erro da API de IA (" + ex.getStatusCode().value() + "): " + ex.getResponseBodyAsString(),
                    ex
            );
        } catch (RestClientException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Falha ao chamar a IA: " + ex.getMessage(), ex);
        }
    }

    private record ChatRequest(
            String model,
            double temperature,
            @JsonProperty("response_format") ResponseFormat responseFormat,
            List<ChatMessage> messages
    ) {}

    private record ResponseFormat(String type) {}

    private record ChatMessage(String role, String content) {}

    private record ChatResponse(List<Choice> choices) {}

    private record Choice(ChatMessage message) {}
}
