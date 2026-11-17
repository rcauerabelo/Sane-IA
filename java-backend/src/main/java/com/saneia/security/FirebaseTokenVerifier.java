package com.saneia.security;

/**
 * Contrato para validação de tokens JWT emitidos pelo Firebase Authentication.
 */
@FunctionalInterface
public interface FirebaseTokenVerifier {

    AuthenticatedUser verify(String idToken) throws InvalidFirebaseTokenException;
}
