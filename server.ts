import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { HttpError } from './src/errors.js';
import { cadastroRouter } from './src/routes/cadastro.js';
import { chamadoRouter } from './src/routes/chamado.js';
import { localizacaoRouter } from './src/routes/localizacao.js';
import { iaClient } from './src/services/iaClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AnaliseRequestBody {
  titulo?: string;
  tipoProblemaNome?: string;
  descricao?: string;
  regiaoResumo?: string;
  enderecoResumo?: string;
  fotosCount?: number;
  fotos?: Array<{ imagemDataUrl: string; mimeType?: string }>;
  orgaos?: Array<{ id: string; nome: string; contato: string }>;
}

interface SugerirRequestBody {
  descricao?: string;
  fotos?: Array<{ imagemDataUrl: string; mimeType?: string }>;
  tipos?: Array<{ id: string; nome: string }>;
}

function normalizePassosResolucao(raw: unknown, fallbackText: string): string[] {
  let items: string[] = [];
  if (Array.isArray(raw)) {
    items = raw.map((item) => String(item || '').trim()).filter(Boolean);
  } else if (typeof raw === 'string' && raw.trim()) {
    items = raw
      .split(/\r?\n+/)
      .map((line) => line.replace(/^\s*(?:\d+[.)-]|[-*•])\s*/, '').trim())
      .filter(Boolean);
  }

  if (items.length === 0 && fallbackText.trim()) {
    items = fallbackText
      .split(/\r?\n+/)
      .map((line) => line.replace(/^\s*(?:\d+[.)-]|[-*•])\s*/, '').trim())
      .filter(Boolean);
  }

  return items.slice(0, 8).map((s) => s.slice(0, 240));
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = '0.0.0.0';
  const uploadsDir = process.env.SANEIA_UPLOADS_DIR || 'uploads';

  app.use(express.json({ limit: '12mb' }));
  app.use('/uploads', express.static(uploadsDir));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'sane-ia' });
  });

  // Server-side multimodal AI suggestion from photo + description (GEMINI_API_KEY stays on server)
  app.post('/api/analisar/sugerir', async (req, res, next) => {
    try {
      const body = req.body as SugerirRequestBody;
      const descricao = (body.descricao || '').trim();
      const fotos = Array.isArray(body.fotos) ? body.fotos.slice(0, 4) : [];
      const tipos = Array.isArray(body.tipos) ? body.tipos : [];

      if (fotos.length === 0 && descricao.length < 3) {
        throw new HttpError(
          400,
          'Envie ao menos uma foto ou descreva o problema para a IA sugerir.'
        );
      }

      const sugestao = await iaClient.sugerirPreenchimento({
        descricao,
        fotos,
        tipos,
      });

      const normTipo = sugestao.tipo_problema.toLowerCase();
      const matchedTipo =
        tipos.find((t) => t.nome.toLowerCase() === normTipo) ??
        tipos.find(
          (t) =>
            normTipo.length > 0 &&
            (t.nome.toLowerCase().includes(normTipo) || normTipo.includes(t.nome.toLowerCase()))
        ) ??
        tipos[0] ??
        null;

      res.json({
        titulo: sugestao.titulo || matchedTipo?.nome || 'Ocorrência de saneamento',
        tipoId: matchedTipo?.id ?? '',
        tipoNome: matchedTipo?.nome ?? sugestao.tipo_problema,
        descricaoSugerida: sugestao.descricao_sugerida || '',
      });
    } catch (err) {
      next(err);
    }
  });

  // Server-side proxy for multimodal AI ticket analysis (keeps GEMINI_API_KEY exclusively on the server)
  app.post('/api/analisar', async (req, res, next) => {
    try {
      const body = req.body as AnaliseRequestBody;
      const titulo = (body.titulo || '').trim();
      const tipoProblemaNome = (body.tipoProblemaNome || '').trim();
      const descricao = (body.descricao || '').trim();
      const regiaoResumo = (body.regiaoResumo || '').trim();
      const enderecoResumo = (body.enderecoResumo || '').trim();
      const fotos = Array.isArray(body.fotos) ? body.fotos.slice(0, 4) : [];
      const fotosCount = Number(body.fotosCount || fotos.length || 0);
      const orgaos = Array.isArray(body.orgaos) ? body.orgaos : [];

      if (!titulo && !descricao && fotos.length === 0) {
        throw new HttpError(
          400,
          'Informe título, descrição ou anexe uma foto para análise.'
        );
      }

      const localTexto = enderecoResumo || regiaoResumo || 'Local não informado';
      const result = await iaClient.analisarOcorrencia({
        titulo: titulo || tipoProblemaNome || 'Ocorrência de saneamento',
        tipoProblemaNome: tipoProblemaNome || 'Saneamento básico',
        descricao,
        regiaoResumo,
        enderecoResumo,
        fotosCount,
        fotos,
        orgaos,
      });

      const urgencia = result.urgencia;
      const prazoEstimado = (
        result.prazo_estimado ||
        (urgencia === 'ALTA'
          ? 'Atendimento prioritário (até 24h)'
          : urgencia === 'BAIXA'
          ? '3 a 5 dias úteis'
          : '24h a 48h')
      ).slice(0, 80);

      const passosResolucao = normalizePassosResolucao(
        result.passos_resolucao,
        result.orientacao || result.diagnostico
      );
      const diagnostico = (result.diagnostico || result.orientacao || '').slice(0, 600);
      const orientacao = (
        result.orientacao || [diagnostico, ...passosResolucao].filter(Boolean).join('\n')
      ).slice(0, 2000);

      const nomeOrgao = result.orgao_responsavel.toLowerCase();
      const matchedOrgao =
        orgaos.find((o) => o.nome.toLowerCase() === nomeOrgao) ??
        orgaos.find(
          (o) =>
            nomeOrgao.length > 0 &&
            (o.nome.toLowerCase().includes(nomeOrgao) ||
              nomeOrgao.includes(o.nome.toLowerCase()))
        ) ??
        orgaos[0] ??
        null;

      const destino = matchedOrgao?.nome || 'Órgão Responsável';
      const modeloProtocolo = (
        result.modelo_protocolo ||
        `Solicitação de atendimento — ${destino}\n` +
          `Ocorrência: ${titulo || tipoProblemaNome} (${tipoProblemaNome})\n` +
          `Local: ${localTexto}\n` +
          `Descrição: ${descricao || 'Solicito vistoria técnica no local.'}\n` +
          `Peço registro de número de protocolo e previsão de reparo.`
      ).slice(0, 1500);

      res.json({
        urgencia,
        prazoEstimado,
        diagnostico,
        passosResolucao,
        modeloProtocolo,
        orientacao,
        respostaBruta: result.respostaBruta.slice(0, 4000),
        orgaoId: matchedOrgao?.id ?? '',
        orgaoNome: matchedOrgao?.nome ?? '',
        orgaoContato: matchedOrgao?.contato ?? '',
      });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', cadastroRouter);
  app.use('/api', localizacaoRouter);
  app.use('/api/chamados', chamadoRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({
      status: 404,
      message: 'Rota da API não encontrada.',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const clientDist = path.resolve(__dirname, '../client');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({
        status: err.status,
        message: err.message,
      });
      return;
    }

    if (err instanceof multer.MulterError) {
      res.status(400).json({
        status: 400,
        message: err.message,
      });
      return;
    }

    const maybePayloadErr = err as { type?: string; status?: number };
    if (maybePayloadErr?.type === 'entity.too.large' || maybePayloadErr?.status === 413) {
      res.status(413).json({
        status: 413,
        message: 'As imagens enviadas excedem o tamanho máximo permitido. Envie menos fotos ou arquivos menores.',
      });
      return;
    }

    const message = err instanceof Error ? err.message : 'Erro interno no servidor';
    res.status(500).json({
      status: 500,
      message,
    });
  });

  app.listen(PORT, HOST, () => {
    console.log(`SaneIA app listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SaneIA server:', err);
  process.exit(1);
});
