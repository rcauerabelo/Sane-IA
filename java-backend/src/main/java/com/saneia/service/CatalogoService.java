package com.saneia.service;

import com.saneia.dto.CatalogoDtos.CatalogosResponse;
import com.saneia.dto.CatalogoDtos.CriarRegiaoRequest;
import com.saneia.dto.CatalogoDtos.OrgaoResponsavelResponse;
import com.saneia.dto.CatalogoDtos.RegiaoResponse;
import com.saneia.dto.CatalogoDtos.TipoProblemaResponse;
import com.saneia.exception.ApiException;
import com.saneia.model.BlueprintLimits;
import com.saneia.repository.CatalogoRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@ConditionalOnBean(CatalogoRepository.class)
public class CatalogoService {

    private final CatalogoRepository catalogoRepository;

    public CatalogoService(CatalogoRepository catalogoRepository) {
        this.catalogoRepository = catalogoRepository;
    }

    public CatalogosResponse carregarCatalogos(String uid) {
        catalogoRepository.ensureInitialCatalogs(uid);
        return new CatalogosResponse(
                catalogoRepository.findAllTipos(),
                catalogoRepository.findAllOrgaos(),
                catalogoRepository.findAllRegioes()
        );
    }

    public List<RegiaoResponse> listarRegioes() {
        return catalogoRepository.findAllRegioes();
    }

    public List<TipoProblemaResponse> listarTipos() {
        return catalogoRepository.findAllTipos();
    }

    public List<OrgaoResponsavelResponse> listarOrgaos() {
        return catalogoRepository.findAllOrgaos();
    }

    public RegiaoResponse criarRegiao(String uid, CriarRegiaoRequest request) {
        String bairro = truncate(request.bairro(), BlueprintLimits.REGIAO_BAIRRO_MAX);
        String cidade = truncate(request.cidade(), BlueprintLimits.REGIAO_CIDADE_MAX);
        String estado = request.estado() == null ? "" : request.estado().trim().toUpperCase();

        if (bairro.length() < BlueprintLimits.REGIAO_BAIRRO_MIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe o nome do bairro.");
        }
        if (cidade.length() < BlueprintLimits.REGIAO_CIDADE_MIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe a cidade.");
        }
        if (!BlueprintLimits.UF_PATTERN.matcher(estado).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe a sigla do estado com 2 letras (ex.: SP).");
        }

        return catalogoRepository.createRegiao(uid, bairro, cidade, estado);
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return "";
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }
}
