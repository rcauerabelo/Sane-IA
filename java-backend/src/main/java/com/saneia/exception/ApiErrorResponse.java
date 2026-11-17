package com.saneia.exception;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ApiErrorResponse(
        int status,
        String error,
        String message,
        Instant timestamp,
        Map<String, String> fieldErrors
) {
    public static ApiErrorResponse of(int status, String error, String message) {
        return new ApiErrorResponse(status, error, message, Instant.now(), Map.of());
    }

    public static ApiErrorResponse ofValidation(int status, String error, String message, Map<String, String> fieldErrors) {
        return new ApiErrorResponse(status, error, message, Instant.now(), fieldErrors);
    }
}
