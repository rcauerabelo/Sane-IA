package com.saneia.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FirebaseAuthFilterTest {

    private ObjectMapper objectMapper;
    private FirebaseTokenVerifier tokenVerifier;
    private FirebaseAuthFilter filter;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        tokenVerifier = mock(FirebaseTokenVerifier.class);
        filter = new FirebaseAuthFilter(tokenVerifier, objectMapper);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void deveAutenticarUsuarioComTokenBearerValido() throws Exception {
        AuthenticatedUser expectedUser = new AuthenticatedUser(
                "uid-123",
                "joao@saneia.app",
                "João Silva",
                true,
                "google.com"
        );
        when(tokenVerifier.verify("token-valido")).thenReturn(expectedUser);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/me");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer token-valido");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.isAuthenticated()).isTrue();
        assertThat(auth.getPrincipal()).isEqualTo(expectedUser);
        assertThat(auth.getAuthorities()).extracting("authority").containsExactly("ROLE_USER");
    }

    @Test
    void deveAceitarEsquemaBearerCaseInsensitive() throws Exception {
        AuthenticatedUser expectedUser = new AuthenticatedUser("uid-456", "ana@saneia.app", "Ana");
        when(tokenVerifier.verify("abc.def.ghi")).thenReturn(expectedUser);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/chamados");
        request.addHeader(HttpHeaders.AUTHORIZATION, "bearer abc.def.ghi");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal()).isEqualTo(expectedUser);
    }

    @Test
    void deveSeguirCadeiaSemAutenticacaoQuandoHeaderNaoForEnviado() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/cep/01001000");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void deveRetornar401QuandoTokenBearerEstiverVazio() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/me");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer   ");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain, never()).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(response.getContentAsString()).contains("Token de autenticação ausente");
    }

    @Test
    void deveRetornar401ELimparContextoQuandoTokenForInvalido() throws Exception {
        when(tokenVerifier.verify("token-invalido"))
                .thenThrow(new InvalidFirebaseTokenException("Token Firebase inválido ou expirado."));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/chamados");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer token-invalido");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain, never()).doFilter(request, response);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(response.getContentAsString()).contains("Token Firebase inválido ou expirado");
    }
}
