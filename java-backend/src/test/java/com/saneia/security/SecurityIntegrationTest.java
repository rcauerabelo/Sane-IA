package com.saneia.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FirebaseTokenVerifier firebaseTokenVerifier;

    @TestConfiguration
    static class TestSecurityEndpointsConfig {
        @Bean
        TestSecureController testSecureController() {
            return new TestSecureController();
        }
    }

    @RestController
    static class TestSecureController {
        @GetMapping("/api/test-secure")
        @PreAuthorize("hasRole('USER')")
        public Map<String, Object> secureEndpoint(@AuthenticationPrincipal AuthenticatedUser user) {
            return Map.of(
                    "uid", user.uid(),
                    "email", user.email(),
                    "provider", user.signInProvider()
            );
        }

        @GetMapping("/api/test-admin")
        @PreAuthorize("hasRole('ADMIN')")
        public Map<String, String> adminOnlyEndpoint() {
            return Map.of("ok", "admin");
        }
    }

    @Test
    void endpointProtegidoSemHeaderAuthorizationDeveRetornar401() throws Exception {
        mockMvc.perform(get("/api/test-secure"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void endpointProtegidoComJwtInvalidoDeveRetornar401() throws Exception {
        when(firebaseTokenVerifier.verify("bad-jwt"))
                .thenThrow(new InvalidFirebaseTokenException("Token Firebase inválido ou expirado."));

        mockMvc.perform(get("/api/test-secure")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer bad-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Token Firebase inválido ou expirado."));
    }

    @Test
    void endpointProtegidoComJwtFirebaseValidoDeveInjetarAuthenticatedUser() throws Exception {
        when(firebaseTokenVerifier.verify("valid-jwt")).thenReturn(
                new AuthenticatedUser("uid-999", "morador@saneia.app", "Carlos", true, "google.com")
        );

        mockMvc.perform(get("/api/test-secure")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer valid-jwt"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uid").value("uid-999"))
                .andExpect(jsonPath("$.email").value("morador@saneia.app"))
                .andExpect(jsonPath("$.provider").value("google.com"));
    }

    @Test
    void endpointAdminParaUsuarioComRoleUserDeveRetornar403Json() throws Exception {
        when(firebaseTokenVerifier.verify("valid-jwt")).thenReturn(
                new AuthenticatedUser("uid-999", "morador@saneia.app", "Carlos", true, "google.com")
        );

        mockMvc.perform(get("/api/test-admin")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer valid-jwt"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }
}
