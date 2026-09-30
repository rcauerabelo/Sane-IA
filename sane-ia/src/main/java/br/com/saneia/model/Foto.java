package br.com.saneia.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonBackReference;

@Entity
public class Foto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String caminhoArquivo;

    @ManyToOne(optional = false)
    @JoinColumn(name = "chamado_id")
    @JsonBackReference("chamado-fotos")
    private Chamado chamado;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCaminhoArquivo() { return caminhoArquivo; }
    public void setCaminhoArquivo(String caminhoArquivo) { this.caminhoArquivo = caminhoArquivo; }

    public Chamado getChamado() { return chamado; }
    public void setChamado(Chamado chamado) { this.chamado = chamado; }

}
