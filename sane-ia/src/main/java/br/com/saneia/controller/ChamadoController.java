package br.com.saneia.controller;

import br.com.saneia.dto.NovoChamadoRequest;
import br.com.saneia.model.AnaliseIA;
import br.com.saneia.model.Chamado;
import br.com.saneia.model.Foto;
import br.com.saneia.service.ChamadoService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/chamados")
public class ChamadoController {

    private final ChamadoService service;

    public ChamadoController(ChamadoService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Chamado abrir(@RequestBody NovoChamadoRequest req) {
        return service.abrir(req);
    }

    @PostMapping(path = "/{id}/fotos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Foto anexarFoto(@PathVariable Long id, @RequestParam("arquivo") MultipartFile arquivo) throws IOException {
        return service.anexarFoto(id, arquivo);
    }

    @PostMapping("/{id}/analisar")
    public AnaliseIA analisar(@PathVariable Long id) {
        return service.analisar(id);
    }

    @GetMapping
    public List<Chamado> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    public Chamado buscar(@PathVariable Long id) {
        return service.buscar(id);
    }
}
