package com.saneia.security;

import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.saneia.config.SaneIaProperties;
import com.saneia.model.BlueprintLimits;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Implementação padrão que valida assinatura, emissor, audiência e expiração
 * dos ID Tokens JWT do Firebase Authentication usando o Firebase Admin SDK.
 */
@Component
@ConditionalOnBean(FirebaseAuth.class)
public class DefaultFirebaseTokenVerifier implements FirebaseTokenVerifier {

    private final FirebaseAuth firebaseAuth;
    private final boolean checkRevoked;

    public DefaultFirebaseTokenVerifier(FirebaseAuth firebaseAuth, SaneIaProperties properties) {
        this.firebaseAuth = firebaseAuth;
        this.checkRevoked = properties.firebase() != null && properties.firebase().checkRevoked();
    }

    @Override
    public AuthenticatedUser verify(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            throw new InvalidFirebaseTokenException("Token de autenticação ausente.");
        }

        try {
            FirebaseToken decoded = firebaseAuth.verifyIdToken(idToken, checkRevoked);
            String uid = decoded.getUid();

            if (uid == null || uid.isBlank() || !BlueprintLimits.ID_PATTERN.matcher(uid).matches()) {
                throw new InvalidFirebaseTokenException("Identificador de usuário inválido no token Firebase.");
            }

            String email = decoded.getEmail() != null ? decoded.getEmail().trim() : "";
            String name = decoded.getName() != null ? decoded.getName().trim() : "";
            boolean emailVerified = decoded.isEmailVerified();
            String signInProvider = extractSignInProvider(decoded.getClaims());

            return new AuthenticatedUser(uid, email, name, emailVerified, signInProvider);
        } catch (FirebaseAuthException ex) {
            throw new InvalidFirebaseTokenException(mapErrorMessage(ex.getAuthErrorCode()), ex);
        }
    }

    private String extractSignInProvider(Map<String, Object> claims) {
        if (claims == null) {
            return "";
        }
        Object firebaseClaim = claims.get("firebase");
        if (firebaseClaim instanceof Map<?, ?> firebaseMap) {
            Object provider = firebaseMap.get("sign_in_provider");
            if (provider != null) {
                return String.valueOf(provider).trim();
            }
        }
        return "";
    }

    private String mapErrorMessage(AuthErrorCode code) {
        if (code == null) {
            return "Token Firebase inválido ou expirado.";
        }
        return switch (code) {
            case EXPIRED_ID_TOKEN -> "Sessão expirada. Faça login novamente com sua conta Google.";
            case REVOKED_ID_TOKEN -> "Sessão revogada. Faça login novamente com sua conta Google.";
            case CERTIFICATE_FETCH_FAILED -> "Não foi possível validar as chaves públicas do Firebase Auth.";
            default -> "Token Firebase inválido ou expirado.";
        };
    }
}
