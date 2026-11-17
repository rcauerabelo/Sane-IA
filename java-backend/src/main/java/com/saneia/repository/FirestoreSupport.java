package com.saneia.repository;

import com.google.api.core.ApiFuture;
import com.google.cloud.Timestamp;
import com.saneia.exception.ApiException;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.concurrent.ExecutionException;

public final class FirestoreSupport {

    private FirestoreSupport() {}

    public static <T> T await(ApiFuture<T> future, String operationDescription) {
        try {
            return future.get();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Operação no Firestore interrompida ao " + operationDescription, ex);
        } catch (ExecutionException ex) {
            Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "Erro ao " + operationDescription + ": " + cause.getMessage(), cause);
        }
    }

    public static Instant toInstant(Object value) {
        if (value instanceof Timestamp ts) {
            return Instant.ofEpochSecond(ts.getSeconds(), ts.getNanos());
        }
        if (value instanceof java.util.Date date) {
            return date.toInstant();
        }
        if (value instanceof String str && !str.isBlank()) {
            try {
                return Instant.parse(str);
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    public static String stringOrEmpty(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    public static boolean booleanOrFalse(Object value) {
        return value instanceof Boolean b && b;
    }

    public static int intOrZero(Object value) {
        if (value instanceof Number n) {
            return n.intValue();
        }
        return 0;
    }

    public static Double doubleOrNull(Object value) {
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        return null;
    }
}
