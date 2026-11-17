package com.saneia.controller;

import com.saneia.dto.LocalizacaoDtos.CepLookupResponse;
import com.saneia.dto.LocalizacaoDtos.GeocodeResponse;
import com.saneia.dto.LocalizacaoDtos.MapsConfigResponse;
import com.saneia.service.LocalizacaoService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class LocalizacaoController {

    private final LocalizacaoService localizacaoService;

    public LocalizacaoController(LocalizacaoService localizacaoService) {
        this.localizacaoService = localizacaoService;
    }

    @GetMapping("/config/maps")
    public MapsConfigResponse obterConfigMaps() {
        return localizacaoService.obterConfiguracaoMaps();
    }

    @GetMapping("/cep/{cep}")
    public CepLookupResponse buscarCep(
            @PathVariable String cep,
            @RequestParam(name = "geocode", defaultValue = "1") String geocode
    ) {
        boolean shouldGeocode = !"0".equals(geocode);
        return localizacaoService.buscarCep(cep, shouldGeocode);
    }

    @GetMapping("/geocode/reverse")
    public GeocodeResponse reverseGeocode(
            @RequestParam("lat") Double lat,
            @RequestParam("lng") Double lng
    ) {
        return localizacaoService.reverseGeocode(lat, lng);
    }

    @GetMapping("/geocode/address")
    public GeocodeResponse forwardGeocode(@RequestParam("q") String q) {
        return localizacaoService.forwardGeocode(q);
    }
}
