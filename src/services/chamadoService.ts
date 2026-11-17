import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError } from '../errors.js';
import { store } from '../store.js';
import {
  AnaliseIA,
  Chamado,
  Foto,
  NovoChamadoRequest,
  OrgaoResponsavel,
  StatusChamado,
} from '../types.js';
import { iaClient } from './iaClient.js';

const pastaUploads = process.env.SANEIA_UPLOADS_DIR || 'uploads';

function naoEncontrado(entidade: string): HttpError {
  return new HttpError(404, `${entidade} não encontrado(a)`);
}

export const chamadoService = {
  abrir(req: NovoChamadoRequest): Chamado {
    const usuario = store.usuarios.get(Number(req.usuarioId));
    if (!usuario) throw naoEncontrado('Usuário');

    const regiao = store.regioes.get(Number(req.regiaoId));
    if (!regiao) throw naoEncontrado('Região');

    const tipoProblema = store.tiposProblema.get(Number(req.tipoProblemaId));
    if (!tipoProblema) throw naoEncontrado('Tipo de problema');

    const chamado: Chamado = {
      id: store.nextChamadoId(),
      titulo: req.titulo,
      descricao: req.descricao ?? null,
      dataAbertura: new Date().toISOString(),
      status: StatusChamado.ABERTO,
      usuario,
      regiao,
      tipoProblema,
      fotos: [],
      analise: null,
    };

    store.chamados.set(chamado.id, chamado);
    return chamado;
  },

  async anexarFoto(
    chamadoId: number,
    arquivo: { originalname?: string; buffer: Buffer }
  ): Promise<Foto> {
    const chamado = this.buscar(chamadoId);
    await fs.mkdir(pastaUploads, { recursive: true });

    const original = arquivo.originalname || 'foto';
    const nomeSanitizado = original.replace(/[^a-zA-Z0-9._-]/g, '_');
    const nome = `${randomUUID()}_${nomeSanitizado}`;
    const destino = path.join(pastaUploads, nome);

    await fs.writeFile(destino, arquivo.buffer);

    const foto: Foto = {
      id: store.nextFotoId(),
      caminhoArquivo: destino,
    };

    store.fotos.set(foto.id, foto);
    chamado.fotos.push(foto);
    return foto;
  },

  async analisar(chamadoId: number): Promise<AnaliseIA> {
    const chamado = this.buscar(chamadoId);
    const orgaos = Array.from(store.orgaosResponsaveis.values());
    const resposta = await iaClient.enviar(this.montarPrompt(chamado, orgaos));

    let urgencia = 'MEDIA';
    let orientacao = '';
    let orgao: OrgaoResponsavel | null = null;

    try {
      const json = JSON.parse(resposta) as {
        urgencia?: unknown;
        orientacao?: unknown;
        orgao_responsavel?: unknown;
      };
      urgencia = String(json.urgencia || 'MEDIA').toUpperCase();
      orientacao = String(json.orientacao || '');
      const nomeOrgao = String(json.orgao_responsavel || '');
      orgao =
        orgaos.find((o) => o.nome.toLowerCase() === nomeOrgao.toLowerCase()) ?? null;
    } catch {
      urgencia = 'INDEFINIDA';
      orientacao = resposta;
    }

    const analise: AnaliseIA = {
      id: chamado.analise ? chamado.analise.id : store.nextAnaliseId(),
      urgencia,
      orientacao,
      respostaBruta: resposta,
      dataAnalise: new Date().toISOString(),
      orgao,
    };

    store.analises.set(analise.id, analise);
    chamado.analise = analise;
    chamado.status = StatusChamado.EM_ANALISE;

    return analise;
  },

  montarPrompt(c: Chamado, orgaos: OrgaoResponsavel[]): string {
    const nomesOrgaos = orgaos.map((o) => o.nome).join('; ');
    return (
      'Analise o chamado de saneamento abaixo e responda SOMENTE em JSON com as chaves: ' +
      '"tipo" (texto), "urgencia" (BAIXA, MEDIA ou ALTA), ' +
      `"orgao_responsavel" (exatamente um destes: ${nomesOrgaos}) e ` +
      '"orientacao" (passos práticos para o morador e para o órgão, em até 5 linhas).\n\n' +
      `Título: ${c.titulo}\n` +
      `Tipo informado: ${c.tipoProblema.nome}\n` +
      `Descrição: ${c.descricao ?? ''}\n` +
      `Região: ${c.regiao.bairro}, ${c.regiao.cidade} - ${c.regiao.estado}\n` +
      `Fotos anexadas: ${c.fotos.length}`
    );
  },

  buscar(id: number): Chamado {
    const chamado = store.chamados.get(id);
    if (!chamado) throw naoEncontrado('Chamado');
    return chamado;
  },

  listar(): Chamado[] {
    return Array.from(store.chamados.values());
  },
};
