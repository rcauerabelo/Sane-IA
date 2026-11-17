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
  fotosCount?: number;
  orgaos?: Array<{ id: string; nome: string; contato: string }>;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = '0.0.0.0';
  const uploadsDir = process.env.SANEIA_UPLOADS_DIR || 'uploads';

  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(uploadsDir));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'sane-ia' });
  });

  // Server-side proxy for AI ticket analysis (keeps GROQ_API_KEY exclusively on the server)
  app.post('/api/analisar', async (req, res, next) => {
    try {
      const body = req.body as AnaliseRequestBody;
      const titulo = (body.titulo || '').trim();
      const tipoProblemaNome = (body.tipoProblemaNome || '').trim();
      const descricao = (body.descricao || '').trim();
      const regiaoResumo = (body.regiaoResumo || '').trim();
      const fotosCount = Number(body.fotosCount || 0);
      const orgaos = Array.isArray(body.orgaos) ? body.orgaos : [];

      if (!titulo || !tipoProblemaNome) {
        throw new HttpError(400, 'Título e tipo de problema são obrigatórios para análise.');
      }

      const nomesOrgaos = orgaos.map((o) => o.nome).join('; ');
      const prompt =
        'Analise o chamado de saneamento abaixo e responda SOMENTE em JSON com as chaves: ' +
        '"tipo" (texto), "urgencia" (BAIXA, MEDIA ou ALTA), ' +
        `"orgao_responsavel" (exatamente um destes: ${nomesOrgaos}) e ` +
        '"orientacao" (passos práticos para o morador e para o órgão, em até 5 linhas).\n\n' +
        `Título: ${titulo}\n` +
        `Tipo informado: ${tipoProblemaNome}\n` +
        `Descrição: ${descricao}\n` +
        `Região: ${regiaoResumo}\n` +
        `Fotos anexadas: ${fotosCount}`;

      const respostaBruta = await iaClient.enviar(prompt);

      let urgencia: 'BAIXA' | 'MEDIA' | 'ALTA' | 'INDEFINIDA' = 'MEDIA';
      let orientacao = '';
      let matchedOrgao: { id: string; nome: string; contato: string } | null = null;

      try {
        const parsed = JSON.parse(respostaBruta) as {
          urgencia?: unknown;
          orientacao?: unknown;
          orgao_responsavel?: unknown;
        };
        const rawUrg = String(parsed.urgencia || 'MEDIA').toUpperCase();
        if (rawUrg === 'BAIXA' || rawUrg === 'MEDIA' || rawUrg === 'ALTA') {
          urgencia = rawUrg;
        }
        orientacao = String(parsed.orientacao || '');
        const nomeOrgao = String(parsed.orgao_responsavel || '').trim();
        matchedOrgao =
          orgaos.find((o) => o.nome.toLowerCase() === nomeOrgao.toLowerCase()) ?? null;
      } catch {
        urgencia = 'INDEFINIDA';
        orientacao = respostaBruta;
      }

      res.json({
        urgencia,
        orientacao,
        respostaBruta,
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
