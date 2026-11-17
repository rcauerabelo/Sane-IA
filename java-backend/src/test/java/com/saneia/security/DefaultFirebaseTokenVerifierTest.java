package com.saneia.security;

import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.saneia.config.SaneIaProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DefaultFirebaseTokenVerifierTest {

    @Mock
    private FirebaseAuth firebaseAuth;

    private DefaultFirebaseTokenVerifier verifier;

    @BeforeEach
    void setUp() {
        SaneIaProperties properties = new SaneIaProperties(
                new SaneIaProperties.FirebaseProperties(true, true, "proj", "db", "", ""),
                new SaneIaProperties.IaProperties("", "", "", 10),
                new SaneIaProperties.MapsProperties("", "", "", 5),
                new SaneIaProperties.ViaCepProperties("", 5),
                new SaneIaProperties.CorsProperties(List.of("*"))
        );
        verifier = new DefaultFirebaseTokenVerifier(firebaseAuth, properties);
    }

    @Test
    void deveValidarTokenJwtEExtrairDadosDoUsuario() throws Exception {
        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn("uid-morador-123");
        when(token.getEmail()).thenReturn("morador@saneia.app");
        when(token.getName()).thenReturn("Maria Oliveira");
        when(token.isEmailVerified()).thenReturn(true);
        when(token.getClaims()).thenReturn(Map.of("firebase", Map.of("sign_in_provider", "google.com")));
        when(firebaseAuth.verifyIdToken("jwt-valido", true)).thenReturn(token);

        AuthenticatedUser user = verifier.verify("jwt-valido");

        verify(firebaseAuth).verifyIdToken("jwt-valido", true);
        assertThat(user.uid()).isEqualTo("uid-morador-123");
        assertThat(user.email()).isEqualTo("morador@saneia.app");
        assertThat(user.name()).isEqualTo("Maria Oliveira");
        assertThat(user.emailVerified()).isTrue();
        assertThat(user.signInProvider()).isEqualTo("google.com");
    }

    @Test
    void deveRejeitarTokenExpiradoComMensagemClara() throws Exception {
        FirebaseAuthException ex = mock(FirebaseAuthException.class);
        when(ex.getAuthErrorCode()).thenReturn(AuthErrorCode.EXPIRED_ID_TOKEN);
        when(firebaseAuth.verifyIdToken("jwt-expirado", true)).thenThrow(ex);

        assertThatThrownBy(() -> verifier.verify("jwt-expirado"))
                .isInstanceOf(InvalidFirebaseTokenException.class)
                .hasMessageContaining("Sessão expirada");
    }

    @Test
    void deveRejeitarTokenRevogadoComMensagemClara() throws Exception {
        FirebaseAuthException ex = mock(FirebaseAuthException.class);
        when(ex.getAuthErrorCode()).thenReturn(AuthErrorCode.REVOKED_ID_TOKEN);
        when(firebaseAuth.verifyIdToken("jwt-revogado", true)).thenThrow(ex);

        assertThatThrownBy(() -> verifier.verify("jwt-revogado"))
                .isInstanceOf(InvalidFirebaseTokenException.class)
                .hasMessageContaining("Sessão revogada");
    }

    @Test
    void deveRejeitarUidInvalidoNoToken() throws Exception {
        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn("uid invalido/com*espaco");
        when(firebaseAuth.verifyIdToken("jwt-uid-ruim", true)).thenReturn(token);

        assertThatThrownBy(() -> verifier.verify("jwt-uid-ruim"))
                .isInstanceOf(InvalidFirebaseTokenException.class)
                .hasMessageContaining("Identificador de usuário inválido");
    }
}
