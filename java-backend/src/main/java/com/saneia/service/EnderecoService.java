package com.saneia.service;

import com.saneia.dto.EnderecoDtos.EnderecoResponse;
import com.saneia.dto.EnderecoDtos.SalvarEnderecoRequest;
import com.saneia.exception.ApiException;
import com.saneia.model.BlueprintLimits;
import com.saneia.repository.EnderecoRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@ConditionalOnBean(EnderecoRepository.class)
public class EnderecoService {

    private final EnderecoRepository enderecoRepository;

    public EnderecoService(EnderecoRepository enderecoRepository) {
        this.enderecoRepository = enderecoRepository;
    }

    public List<EnderecoResponse> listarDoUsuario(String uid) {
        return enderecoRepository.findAllByUser(uid);
    }

    public EnderecoResponse criar(String uid, SalvarEnderecoRequest request) {
        Map<String, Object> fields = validarEMontarCampos(uid, request);
        List<EnderecoResponse> atuais = enderecoRepository.findAllByUser(uid);
        boolean shouldBePrincipal = request.principal() || atuais.isEmpty();
        return enderecoRepository.saveWithPrincipalBatch(uid, null, fields, shouldBePrincipal);
    }

    public EnderecoResponse atualizar(String uid, String enderecoId, SalvarEnderecoRequest request) {
        EnderecoResponse existente = enderecoRepository.findById(uid, enderecoId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Endereço não encontrado."));
        if (!uid.equals(existente.usuarioId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acesso negado a este endereço.");
        }

        Map<String, Object> fields = validarEMontarCampos(uid, request);
        return enderecoRepository.saveWithPrincipalBatch(uid, enderecoId, fields, request.principal());
    }

    public void definirPrincipal(String uid, String enderecoId) {
        EnderecoResponse existente = enderecoRepository.findById(uid, enderecoId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Endereço não encontrado."));
        if (!uid.equals(existente.usuarioId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acesso negado a este endereço.");
        }
        enderecoRepository.setPrincipal(uid, enderecoId);
    }

    public void excluir(String uid, String enderecoId) {
        EnderecoResponse existente = enderecoRepository.findById(uid, enderecoId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Endereço não encontrado."));
        if (!uid.equals(existente.usuarioId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acesso negado a este endereço.");
        }
        enderecoRepository.delete(uid, enderecoId);
    }

    public static String formatEnderecoResumo(EnderecoResponse e) {
        String numPart = (e.numero() != null && !e.numero().isBlank())
                ? ", " + e.numero().trim()
                : ", s/n";
        String cepPart = (e.cep() != null && e.cep().length() == 8)
                ? " · CEP " + e.cep().substring(0, 5) + "-" + e.cep().substring(5)
                : "";
        String resumo = e.logradouro() + numPart + " · " + e.bairro() + ", " + e.cidade() + " - " + e.estado() + cepPart;
        return resumo.length() > BlueprintLimits.CHAMADO_ENDERECO_RESUMO_MAX
                ? resumo.substring(0, BlueprintLimits.CHAMADO_ENDERECO_RESUMO_MAX)
                : resumo;
    }

    private Map<String, Object> validarEMontarCampos(String uid, SalvarEnderecoRequest req) {
        String apelido = truncate(req.apelido(), BlueprintLimits.ENDERECO_APELIDO_MAX);
        String rawCep = req.cep() == null ? "" : req.cep().replaceAll("\\D", "");
        String cep = rawCep.length() > BlueprintLimits.ENDERECO_CEP_MAX
                ? rawCep.substring(0, BlueprintLimits.ENDERECO_CEP_MAX)
                : rawCep;
        String logradouro = truncate(req.logradouro(), BlueprintLimits.ENDERECO_LOGRADOURO_MAX);
        String numero = truncate(req.numero(), BlueprintLimits.ENDERECO_NUMERO_MAX);
        String complemento = truncate(req.complemento(), BlueprintLimits.ENDERECO_COMPLEMENTO_MAX);
        String bairro = truncate(req.bairro(), BlueprintLimits.REGIAO_BAIRRO_MAX);
        String cidade = truncate(req.cidade(), BlueprintLimits.REGIAO_CIDADE_MAX);
        String estado = req.estado() == null ? "" : req.estado().trim().toUpperCase();
        String referencia = truncate(req.referencia(), BlueprintLimits.ENDERECO_REFERENCIA_MAX);

        if (apelido.length() < BlueprintLimits.ENDERECO_APELIDO_MIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um nome para o endereço (ex.: Casa, Trabalho).");
        }
        if (!BlueprintLimits.CEP_PATTERN.matcher(cep).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "O CEP deve ter 8 dígitos.");
        }
        if (logradouro.length() < BlueprintLimits.ENDERECO_LOGRADOURO_MIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe o nome da rua ou avenida.");
        }
        if (bairro.length() < BlueprintLimits.REGIAO_BAIRRO_MIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe o bairro.");
        }
        if (cidade.length() < BlueprintLimits.REGIAO_CIDADE_MIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe a cidade.");
        }
        if (!BlueprintLimits.UF_PATTERN.matcher(estado).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe a sigla do estado com 2 letras (ex.: SP).");
        }
        if (req.latitude() == null || !Double.isFinite(req.latitude())
                || req.latitude() < -90 || req.latitude() > 90
                || req.longitude() == null || !Double.isFinite(req.longitude())
                || req.longitude() < -180 || req.longitude() > 180) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Toque no mapa para marcar a localização exata do endereço.");
        }

        Map<String, Object> fields = new HashMap<>();
        fields.put("usuarioId", uid);
        fields.put("apelido", apelido);
        fields.put("cep", cep);
        fields.put("logradouro", logradouro);
        fields.put("numero", numero);
        fields.put("complemento", complemento);
        fields.put("bairro", bairro);
        fields.put("cidade", cidade);
        fields.put("estado", estado);
        fields.put("referencia", referencia);
        fields.put("latitude", req.latitude());
        fields.put("longitude", req.longitude());
        return fields;
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return "";
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }
}
