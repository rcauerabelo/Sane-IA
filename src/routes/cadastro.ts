import { Router } from 'express';
import { store } from '../store.js';
import { Regiao, Usuario } from '../types.js';

export const cadastroRouter = Router();

cadastroRouter.post('/usuarios', (req, res) => {
  const { nome, email = null, telefone = null } = req.body as Partial<Usuario>;
  const usuario: Usuario = {
    id: store.nextUsuarioId(),
    nome: nome ?? '',
    email,
    telefone,
  };
  store.usuarios.set(usuario.id, usuario);
  res.status(201).json(usuario);
});

cadastroRouter.post('/regioes', (req, res) => {
  const { bairro, cidade, estado } = req.body as Partial<Regiao>;
  const regiao: Regiao = {
    id: store.nextRegiaoId(),
    bairro: bairro ?? '',
    cidade: cidade ?? '',
    estado: estado ?? '',
  };
  store.regioes.set(regiao.id, regiao);
  res.status(201).json(regiao);
});

cadastroRouter.get('/regioes', (_req, res) => {
  res.json(Array.from(store.regioes.values()));
});

cadastroRouter.get('/tipos', (_req, res) => {
  res.json(Array.from(store.tiposProblema.values()));
});

cadastroRouter.get('/orgaos', (_req, res) => {
  res.json(Array.from(store.orgaosResponsaveis.values()));
});
