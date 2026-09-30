package br.com.saneia.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonBackReference;
import java.time.LocalDateTime;

@Entity
public class AnaliseIA {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String urgencia;

    @Column(length = 2000)
    private String orientacao;

    @Column(length = 4000)
    private String respostaBruta;

    private LocalDateTime dataAnalise;

    @OneToOne(optional = false)
    @JoinColumn(name = "chamado_id", unique = true)
    @JsonBackReference("chamado-analise")
    private Chamado chamado;

    @ManyToOne
    private OrgaoResponsavel orgao;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUrgencia() { return urgencia; }
    public void setUrgencia(String urgencia) { this.urgencia = urgencia; }

    public String getOrientacao() { return orientacao; }
    public void setOrientacao(String orientacao) { this.orientacao = orientacao; }

    public String getRespostaBruta() { return respostaBruta; }
    public void setRespostaBruta(String respostaBruta) { this.respostaBruta = respostaBruta; }

    public LocalDateTime getDataAnalise() { return dataAnalise; }
    public void setDataAnalise(LocalDateTime dataAnalise) { this.dataAnalise = dataAnalise; }

    public Chamado getChamado() { return chamado; }
    public void setChamado(Chamado chamado) { this.chamado = chamado; }

    public OrgaoResponsavel getOrgao() { return orgao; }
    public void setOrgao(OrgaoResponsavel orgao) { this.orgao = orgao; }

}
