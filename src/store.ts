import {
  AnaliseIA,
  Chamado,
  Foto,
  OrgaoResponsavel,
  Regiao,
  TipoProblema,
  Usuario,
} from './types.js';

// In-memory store replacing H2/JPA, seeded with initial data from data.sql
class InMemoryStore {
  public usuarios = new Map<number, Usuario>();
  public regioes = new Map<number, Regiao>();
  public tiposProblema = new Map<number, TipoProblema>();
  public orgaosResponsaveis = new Map<number, OrgaoResponsavel>();
  public chamados = new Map<number, Chamado>();
  public fotos = new Map<number, Foto>();
  public analises = new Map<number, AnaliseIA>();

  private seqUsuario = 1;
  private seqRegiao = 1;
  private seqTipo = 1;
  private seqOrgao = 1;
  private seqChamado = 1;
  private seqFoto = 1;
  private seqAnalise = 1;

  constructor() {
    this.seed();
  }

  private seed(): void {
    const tipos = [
      'Falta de água',
      'Vazamento de água',
      'Esgoto a céu aberto',
      'Falta de rede de esgoto',
      'Lixo acumulado / drenagem',
      'Qualidade da água',
    ];
    for (const nome of tipos) {
      const id = this.seqTipo++;
      this.tiposProblema.set(id, { id, nome });
    }

    const orgaos: Array<{ nome: string; contato: string }> = [
      { nome: 'Companhia de Saneamento', contato: '0800-000-0000' },
      { nome: 'Prefeitura - Secretaria de Obras', contato: '156' },
      { nome: 'Vigilância Sanitária', contato: '0800-111-1111' },
    ];
    for (const orgao of orgaos) {
      const id = this.seqOrgao++;
      this.orgaosResponsaveis.set(id, { id, ...orgao });
    }

    const regiaoId = this.seqRegiao++;
    this.regioes.set(regiaoId, {
      id: regiaoId,
      bairro: 'Jardim Exemplo',
      cidade: 'São Paulo',
      estado: 'SP',
    });

    const usuarioId = this.seqUsuario++;
    this.usuarios.set(usuarioId, {
      id: usuarioId,
      nome: 'Morador Teste',
      email: 'teste@email.com',
      telefone: '11999999999',
    });
  }

  public nextUsuarioId(): number {
    return this.seqUsuario++;
  }

  public nextRegiaoId(): number {
    return this.seqRegiao++;
  }

  public nextChamadoId(): number {
    return this.seqChamado++;
  }

  public nextFotoId(): number {
    return this.seqFoto++;
  }

  public nextAnaliseId(): number {
    return this.seqAnalise++;
  }
}

export const store = new InMemoryStore();
