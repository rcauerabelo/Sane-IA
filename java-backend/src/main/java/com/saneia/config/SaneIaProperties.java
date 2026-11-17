package com.saneia.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "saneia")
public record SaneIaProperties(
        FirebaseProperties firebase,
        IaProperties ia,
        MapsProperties maps,
        ViaCepProperties viacep,
        CorsProperties cors
) {
    public record FirebaseProperties(
            boolean enabled,
            boolean checkRevoked,
            String projectId,
            String databaseId,
            String credentialsPath,
            String credentialsJson
    ) {}

    public record IaProperties(
            String apiUrl,
            String apiKey,
            String model,
            int timeoutSeconds
    ) {}

    public record MapsProperties(
            String apiKey,
            String geocodeUrl,
            String solutionId,
            int timeoutSeconds
    ) {}

    public record ViaCepProperties(
            String baseUrl,
            int timeoutSeconds
    ) {}

    public record CorsProperties(
            List<String> allowedOrigins
    ) {}
}
