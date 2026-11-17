package com.saneia.controller;

import com.saneia.dto.LocalizacaoDtos.CepLookupResponse;
import com.saneia.exception.ApiException;
import com.saneia.service.LocalizacaoService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LocalizacaoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private LocalizacaoService localizacaoService;

    @Test
    void healthEndpointDeveRetornar200SemAutenticacao() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.service").value("sane-ia-java"));
    }

    @Test
    void rotaProtegidaSemTokenDeveRetornar401EmJsonPadronizado() throws Exception {
        mockMvc.perform(get("/api/chamados"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void buscarCepDeveRetornar200ComDadosEstruturados() throws Exception {
        when(localizacaoService.buscarCep("01001000", false)).thenReturn(
                new CepLookupResponse("01001000", "01001-000", "Praça da Sé", "", "Sé", "São Paulo", "SP", null, null, false)
        );

        mockMvc.perform(get("/api/cep/01001000?geocode=0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logradouro").value("Praça da Sé"))
                .andExpect(jsonPath("$.estado").value("SP"));
    }

    @Test
    void erro429DeveSerFormatadoPeloGlobalExceptionHandler() throws Exception {
        when(localizacaoService.reverseGeocode(-23.5, -46.6))
                .thenThrow(new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Limite de consultas atingido."));

        mockMvc.perform(get("/api/geocode/reverse?lat=-23.5&lng=-46.6"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.message").value("Limite de consultas atingido."));
    }
}
