export enum StatusChamado {
  ABERTO = 'ABERTO',
  EM_ANALISE = 'EM_ANALISE',
  ENCAMINHADO = 'ENCAMINHADO',
  RESOLVIDO = 'RESOLVIDO',
}

export interface Usuario {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
}

export interface Regiao {
  id: number;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface TipoProblema {
  id: number;
  nome: string;
}

export interface OrgaoResponsavel {
  id: number;
  nome: string;
  contato: string | null;
}

export interface Foto {
  id: number;
  caminhoArquivo: string;
}

export interface AnaliseIA {
  id: number;
  urgencia: string;
  orientacao: string;
  respostaBruta: string;
  dataAnalise: string;
  orgao: OrgaoResponsavel | null;
}

export interface Chamado {
  id: number;
  titulo: string;
  descricao: string | null;
  dataAbertura: string;
  status: StatusChamado;
  usuario: Usuario;
  regiao: Regiao;
  tipoProblema: TipoProblema;
  fotos: Foto[];
  analise: AnaliseIA | null;
}

export interface NovoChamadoRequest {
  titulo: string;
  descricao?: string;
  usuarioId: number;
  regiaoId: number;
  tipoProblemaId: number;
}
