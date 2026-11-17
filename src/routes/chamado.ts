import { Router } from 'express';
import multer from 'multer';
import { HttpError } from '../errors.js';
import { chamadoService } from '../services/chamadoService.js';
import { NovoChamadoRequest } from '../types.js';

export const chamadoRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB matching spring.servlet.multipart.max-file-size
  },
});

chamadoRouter.post('/', (req, res) => {
  const body = req.body as NovoChamadoRequest;
  const criado = chamadoService.abrir(body);
  res.status(201).json(criado);
});

chamadoRouter.post('/:id/fotos', upload.single('arquivo'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!req.file) {
      throw new HttpError(400, "Campo 'arquivo' é obrigatório");
    }
    const foto = await chamadoService.anexarFoto(id, req.file);
    res.status(201).json(foto);
  } catch (err) {
    next(err);
  }
});

chamadoRouter.post('/:id/analisar', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const analise = await chamadoService.analisar(id);
    res.json(analise);
  } catch (err) {
    next(err);
  }
});

chamadoRouter.get('/', (_req, res) => {
  res.json(chamadoService.listar());
});

chamadoRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  res.json(chamadoService.buscar(id));
});
