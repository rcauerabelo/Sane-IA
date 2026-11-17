package com.saneia.service;

import com.saneia.client.GoogleMapsGeocodeClient;
import com.saneia.client.ViaCepClient;
import com.saneia.dto.LocalizacaoDtos.CepLookupResponse;
import com.saneia.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LocalizacaoServiceTest {

    @Mock
    private ViaCepClient viaCepClient;
    @Mock
    private GoogleMapsGeocodeClient googleMapsGeocodeClient;

    private LocalizacaoService service;

    @BeforeEach
    void setUp() {
        service = new LocalizacaoService(viaCepClient, googleMapsGeocodeClient);
    }

    @Test
    void deveRetornarDadosDoViaCepMesmoQuandoGoogleMapsEstourarCota429() {
        when(viaCepClient.lookup("01001000")).thenReturn(
                new ViaCepClient.ViaCepResult("01001000", "01001-000", "Praça da Sé", "", "Sé", "São Paulo", "SP")
        );
        when(googleMapsGeocodeClient.isConfigured()).thenReturn(true);
        when(googleMapsGeocodeClient.forwardGeocode(anyString()))
                .thenThrow(new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Limite atingido"));

        CepLookupResponse result = service.buscarCep("01001-000", true);

        assertThat(result.cep()).isEqualTo("01001000");
        assertThat(result.logradouro()).isEqualTo("Praça da Sé");
        assertThat(result.quotaExceeded()).isTrue();
        assertThat(result.latitude()).isNull();
    }

    @Test
    void deveRejeitarCepComMenosDe8Digitos() {
        assertThatThrownBy(() -> service.buscarCep("1234", false))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void deveRejeitarLatitudeForaDosLimites() {
        assertThatThrownBy(() -> service.reverseGeocode(-95.0, -46.6))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }
}
