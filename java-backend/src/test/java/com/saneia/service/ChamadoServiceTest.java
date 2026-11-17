package com.saneia.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.saneia.client.GroqAiClient;
import com.saneia.dto.CatalogoDtos.OrgaoResponsavelResponse;
import com.saneia.dto.CatalogoDtos.RegiaoResponse;
import com.saneia.dto.CatalogoDtos.TipoProblemaResponse;
import com.saneia.dto.ChamadoDtos.AnaliseIAResponse;
import com.saneia.dto.ChamadoDtos.ChamadoResponse;
import com.saneia.dto.ChamadoDtos.CriarChamadoRequest;
import com.saneia.dto.ChamadoDtos.FotoResponse;
import com.saneia.dto.UsuarioDtos.UsuarioResponse;
import com.saneia.exception.ApiException;
import com.saneia.model.StatusChamado;
import com.saneia.model.UrgenciaIA;
import com.saneia.repository.CatalogoRepository;
import com.saneia.repository.ChamadoRepository;
import com.saneia.repository.EnderecoRepository;
import com.saneia.repository.UsuarioRepository;
import com.saneia.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChamadoServiceTest {

    @Mock
    private ChamadoRepository chamadoRepository;
    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private CatalogoRepository catalogoRepository;
    @Mock
    private EnderecoRepository enderecoRepository;
    @Mock
    private GroqAiClient groqAiClient;

    private ChamadoService service;

    @BeforeEach
    void setUp() {
        service = new ChamadoService(
                chamadoRepository,
                usuarioRepository,
                catalogoRepository,
                enderecoRepository,
                groqAiClient,
                new ObjectMapper()
        );
    }

    @Test
    void deveAbrirChamadoQuandoCadastroEstiverCompleto() {
        AuthenticatedUser auth = new AuthenticatedUser("uid-1", "ana@email.com", "Ana");
        when(usuarioRepository.findByUid("uid-1")).thenReturn(Optional.of(
                new UsuarioResponse("uid-1", "Ana Silva", "ana@email.com", "11999999999", "", true, Instant.now(), Instant.now())
        ));
        when(catalogoRepository.findRegiaoById("reg-1")).thenReturn(Optional.of(
                new RegiaoResponse("reg-1", "Centro", "São Paulo", "SP", "uid-1", Instant.now())
        ));
        when(catalogoRepository.findTipoById("1")).thenReturn(Optional.of(
                new TipoProblemaResponse("1", "Falta de água")
        ));
        when(chamadoRepository.create(any())).thenReturn(sampleChamado("ch-1", "uid-1", StatusChamado.ABERTO, 0));

        ChamadoResponse criado = service.abrir(
                auth,
                new CriarChamadoRequest("Sem água desde ontem", "Torneira seca", "reg-1", "1", null)
        );

        assertThat(criado.id()).isEqualTo("ch-1");
        assertThat(criado.status()).isEqualTo(StatusChamado.ABERTO);
    }

    @Test
    void deveImpedirAberturaDeChamadoSemCadastroCompleto() {
        AuthenticatedUser auth = new AuthenticatedUser("uid-1", "ana@email.com", "Ana");
        when(usuarioRepository.findByUid("uid-1")).thenReturn(Optional.empty());

        CriarChamadoRequest req = new CriarChamadoRequest("Vazamento", "Na calçada", "reg-1", "2", null);

        assertThatThrownBy(() -> service.abrir(auth, req))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void deveAnexarFotoJpegValidaEConverterParaDataUrl() {
        when(chamadoRepository.findById("ch-1")).thenReturn(Optional.of(
                sampleChamado("ch-1", "uid-1", StatusChamado.ABERTO, 0)
        ));
        MockMultipartFile file = new MockMultipartFile(
                "arquivo",
                "cano quebrado.jpg",
                "image/jpeg",
                new byte[]{1, 2, 3, 4}
        );
        when(chamadoRepository.attachFotoAndIncrementCount(
                eq("ch-1"),
                eq("uid-1"),
                eq("cano_quebrado.jpg"),
                eq("image/jpeg"),
                eq("data:image/jpeg;base64,AQIDBA==")
        )).thenReturn(new FotoResponse("f-1", "cano_quebrado.jpg", "image/jpeg", "data:image/jpeg;base64,AQIDBA==", "ch-1", "uid-1", Instant.now()));

        FotoResponse foto = service.anexarFoto("uid-1", "ch-1", file);

        assertThat(foto.nomeArquivo()).isEqualTo("cano_quebrado.jpg");
        assertThat(foto.imagemDataUrl()).startsWith("data:image/jpeg;base64,");
    }

    @Test
    void deveRejeitarFormatoDeFotoNaoSuportado() {
        when(chamadoRepository.findById("ch-1")).thenReturn(Optional.of(
                sampleChamado("ch-1", "uid-1", StatusChamado.ABERTO, 0)
        ));
        MockMultipartFile file = new MockMultipartFile(
                "arquivo",
                "documento.pdf",
                "application/pdf",
                new byte[]{1, 2, 3}
        );

        assertThatThrownBy(() -> service.anexarFoto("uid-1", "ch-1", file))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void deveAnalisarChamadoComGroqEAplicarFallbackQuandoJsonForInvalido() {
        when(chamadoRepository.findById("ch-1")).thenReturn(Optional.of(
                sampleChamado("ch-1", "uid-1", StatusChamado.ABERTO, 1)
        ));
        when(catalogoRepository.findAllOrgaos()).thenReturn(List.of(
                new OrgaoResponsavelResponse("1", "Companhia de Saneamento", "0800-000-0000")
        ));
        when(groqAiClient.enviarPrompt(any())).thenReturn("Resposta textual fora de JSON");
        when(chamadoRepository.saveAnaliseAndUpdateStatus(eq("ch-1"), eq(StatusChamado.ABERTO), any()))
                .thenReturn(new AnaliseIAResponse(
                        "atual",
                        UrgenciaIA.INDEFINIDA,
                        "Resposta textual fora de JSON",
                        "Resposta textual fora de JSON",
                        Instant.now(),
                        "ch-1",
                        "uid-1",
                        "",
                        "",
                        ""
                ));

        AnaliseIAResponse analise = service.analisar("uid-1", "ch-1");

        assertThat(analise.urgencia()).isEqualTo(UrgenciaIA.INDEFINIDA);
        assertThat(analise.orientacao()).contains("Resposta textual");
    }

    private ChamadoResponse sampleChamado(String id, String uid, StatusChamado status, int fotosCount) {
        return new ChamadoResponse(
                id,
                "Sem água desde ontem",
                "Torneira seca",
                Instant.now(),
                status,
                uid,
                "Ana Silva",
                "reg-1",
                "Centro, São Paulo - SP",
                "1",
                "Falta de água",
                fotosCount,
                "",
                "",
                null,
                null,
                Instant.now()
        );
    }
}
