package com.saneia.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class HttpClientConfig {

    @Bean
    public RestClient viaCepRestClient(SaneIaProperties properties) {
        int timeout = Math.max(2, properties.viacep().timeoutSeconds());
        return RestClient.builder()
                .baseUrl(properties.viacep().baseUrl())
                .requestFactory(buildRequestFactory(timeout))
                .build();
    }

    @Bean
    public RestClient googleMapsRestClient(SaneIaProperties properties) {
        int timeout = Math.max(2, properties.maps().timeoutSeconds());
        return RestClient.builder()
                .requestFactory(buildRequestFactory(timeout))
                .build();
    }

    @Bean
    public RestClient groqRestClient(SaneIaProperties properties) {
        int timeout = Math.max(5, properties.ia().timeoutSeconds());
        return RestClient.builder()
                .requestFactory(buildRequestFactory(timeout))
                .build();
    }

    private SimpleClientHttpRequestFactory buildRequestFactory(int timeoutSeconds) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(timeoutSeconds));
        factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
        return factory;
    }
}
