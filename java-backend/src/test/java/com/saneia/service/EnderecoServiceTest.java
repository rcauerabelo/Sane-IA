package com.saneia.service;

import com.saneia.dto.EnderecoDtos.EnderecoResponse;
import com.saneia.dto.EnderecoDtos.SalvarEnderecoRequest;
import com.saneia.exception.ApiException;
import com.saneia.repository.EnderecoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnderecoServiceTest {

    @Mock
    private EnderecoRepository enderecoRepository;

    private EnderecoService service;

    @BeforeEach
    void setUp() {
        service = new EnderecoService(enderecoRepository);
    }

    @Test
    void primeiroEnderecoDoUsuarioDeveSerDefinidoComoPrincipalAutomaticamente() {
        when(enderecoRepository.findAllByUser("user-1")).thenReturn(List.of());
        EnderecoResponse saved = sampleEndereco("end-1", "user-1", true);
        when(enderecoRepository.saveWithPrincipalBatch(eq("user-1"), isNull(), any(), eq(true)))
                .thenReturn(saved);

        SalvarEnderecoRequest req = new SalvarEnderecoRequest(
                "Casa",
                "01001-000",
                "Praça da Sé",
                "100",
                "",
                "Sé",
                "São Paulo",
                "sp",
                "Em frente à catedral",
                -23.5505,
                -46.6333,
                false
        );

        EnderecoResponse result = service.criar("user-1", req);

        assertThat(result.principal()).isTrue();
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(enderecoRepository).saveWithPrincipalBatch(eq("user-1"), isNull(), captor.capture(), eq(true));
        assertThat(captor.getValue().get("cep")).isEqualTo("01001000");
        assertThat(captor.getValue().get("estado")).isEqualTo("SP");
    }

    @Test
    void deveRejeitarCoordenadasInvalidasAoSalvarEndereco() {
        SalvarEnderecoRequest req = new SalvarEnderecoRequest(
                "Trabalho",
                "01001000",
                "Rua Teste",
                "10",
                "",
                "Centro",
                "São Paulo",
                "SP",
                "",
                120.0,
                -46.6333,
                true
        );

        assertThatThrownBy(() -> service.criar("user-1", req))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void deveNegarAcessoAoExcluirEnderecoDeOutroUsuario() {
        when(enderecoRepository.findById("user-1", "end-99"))
                .thenReturn(Optional.of(sampleEndereco("end-99", "outro-usuario", false)));

        assertThatThrownBy(() -> service.excluir("user-1", "end-99"))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void formatEnderecoResumoDeveFormatarComCepENumero() {
        EnderecoResponse endereco = sampleEndereco("end-1", "user-1", true);
        String resumo = EnderecoService.formatEnderecoResumo(endereco);

        assertThat(resumo).isEqualTo("Praça da Sé, 100 · Sé, São Paulo - SP · CEP 01001-000");
    }

    private EnderecoResponse sampleEndereco(String id, String uid, boolean principal) {
        return new EnderecoResponse(
                id,
                uid,
                "Casa",
                "01001000",
                "Praça da Sé",
                "100",
                "",
                "Sé",
                "São Paulo",
                "SP",
                "",
                -23.5505,
                -46.6333,
                principal,
                Instant.now(),
                Instant.now()
        );
    }
}
