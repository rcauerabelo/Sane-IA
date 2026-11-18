import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  BLUEPRINT_LIMITS,
  StatusChamado,
  UrgenciaIA,
} from './blueprint';
import { db, handleFirestoreError, OperationType } from './firebase';
import { parseJsonResponse } from './httpJson';
import { ProcessedImage } from './imageUtils';

export interface UsuarioProfile {
  uid: string;
  nome: string;
  email: string;
  telefone: string;
  regiaoPadraoId?: string;
  cadastroCompleto: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface RegiaoDoc {
  id: string;
  bairro: string;
  cidade: string;
  estado: string;
  criadoPorUid: string;
}

export interface TipoProblemaDoc {
  id: string;
  nome: string;
}

export interface OrgaoResponsavelDoc {
  id: string;
  nome: string;
  contato: string;
}

export interface EnderecoDoc {
  id: string;
  usuarioId: string;
  apelido: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  referencia: string;
  latitude: number;
  longitude: number;
  principal: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface EnderecoInput {
  apelido: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  referencia: string;
  latitude: number;
  longitude: number;
  principal: boolean;
}

export interface ChamadoDoc {
  id: string;
  titulo: string;
  descricao: string;
  dataAbertura: Timestamp | null;
  status: StatusChamado;
  usuarioId: string;
  usuarioNome: string;
  regiaoId: string;
  regiaoResumo: string;
  tipoProblemaId: string;
  tipoProblemaNome: string;
  fotosCount: number;
  enderecoId?: string;
  enderecoResumo?: string;
  latitude?: number;
  longitude?: number;
  updatedAt: Timestamp | null;
}

export interface FotoDoc {
  id: string;
  nomeArquivo: string;
  mimeType: string;
  imagemDataUrl: string;
  chamadoId: string;
  usuarioId: string;
  createdAt: Timestamp | null;
}

export interface AnaliseIADoc {
  id: string;
  urgencia: UrgenciaIA;
  orientacao: string;
  respostaBruta: string;
  dataAnalise: Timestamp | null;
  chamadoId: string;
  usuarioId: string;
  orgaoId: string;
  orgaoNome: string;
  orgaoContato: string;
  diagnostico?: string;
  prazoEstimado?: string;
  passosResolucao?: string[];
  modeloProtocolo?: string;
}

const DEFAULT_TIPOS: Array<{ id: string; nome: string }> = [
  { id: '1', nome: 'Falta de água' },
  { id: '2', nome: 'Vazamento de água' },
  { id: '3', nome: 'Esgoto a céu aberto' },
  { id: '4', nome: 'Falta de rede de esgoto' },
  { id: '5', nome: 'Lixo acumulado / drenagem' },
  { id: '6', nome: 'Qualidade da água' },
];

const DEFAULT_ORGAOS: Array<{ id: string; nome: string; contato: string }> = [
  { id: '1', nome: 'Companhia de Saneamento', contato: '0800-000-0000' },
  { id: '2', nome: 'Prefeitura - Secretaria de Obras', contato: '156' },
  { id: '3', nome: 'Vigilância Sanitária', contato: '0800-111-1111' },
];

export async function ensureInitialCatalogs(uid: string): Promise<void> {
  try {
    const tiposSnap = await getDocs(collection(db, 'tipos_problema'));
    if (tiposSnap.empty) {
      for (const tipo of DEFAULT_TIPOS) {
        const ref = doc(db, 'tipos_problema', tipo.id);
        const existing = await getDoc(ref);
        if (!existing.exists()) {
          await setDoc(ref, { nome: tipo.nome });
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'tipos_problema');
  }

  try {
    const orgaosSnap = await getDocs(collection(db, 'orgaos_responsaveis'));
    if (orgaosSnap.empty) {
      for (const orgao of DEFAULT_ORGAOS) {
        const ref = doc(db, 'orgaos_responsaveis', orgao.id);
        const existing = await getDoc(ref);
        if (!existing.exists()) {
          await setDoc(ref, { nome: orgao.nome, contato: orgao.contato });
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'orgaos_responsaveis');
  }

  try {
    const regioesSnap = await getDocs(collection(db, 'regioes'));
    if (regioesSnap.empty) {
      const ref = doc(db, 'regioes', 'regiao_padrao');
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        await setDoc(ref, {
          bairro: 'Jardim Exemplo',
          cidade: 'São Paulo',
          estado: 'SP',
          criadoPorUid: uid,
          createdAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'regioes');
  }
}

export async function fetchUserProfile(uid: string): Promise<UsuarioProfile | null> {
  const path = `usuarios/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return null;
    return snap.data() as UsuarioProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(
  authUser: User,
  input: { nome: string; telefone: string; regiaoPadraoId?: string }
): Promise<UsuarioProfile> {
  const uid = authUser.uid;
  const email = (authUser.email || '').trim().slice(0, BLUEPRINT_LIMITS.USUARIO_EMAIL_MAX);
  const nome = input.nome.trim().slice(0, BLUEPRINT_LIMITS.USUARIO_NOME_MAX);
  const telefone = input.telefone.trim().slice(0, BLUEPRINT_LIMITS.USUARIO_TELEFONE_MAX);
  const regiaoPadraoId = (input.regiaoPadraoId || '').trim().slice(0, 128);

  if (nome.length < BLUEPRINT_LIMITS.USUARIO_NOME_MIN) {
    throw new Error('Informe seu nome completo (mínimo de 2 caracteres).');
  }
  if (!telefone) {
    throw new Error('Informe um telefone ou WhatsApp para contato.');
  }

  const path = `usuarios/${uid}`;
  const docRef = doc(db, 'usuarios', uid);
  try {
    const existing = await getDoc(docRef);
    if (!existing.exists()) {
      const payload = {
        uid,
        nome,
        email,
        telefone,
        regiaoPadraoId,
        cadastroCompleto: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(docRef, payload);
    } else {
      await updateDoc(docRef, {
        nome,
        telefone,
        regiaoPadraoId,
        cadastroCompleto: true,
        updatedAt: serverTimestamp(),
      });
    }
    const updated = await getDoc(docRef);
    return updated.data() as UsuarioProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchCatalogs(): Promise<{
  tipos: TipoProblemaDoc[];
  orgaos: OrgaoResponsavelDoc[];
  regioes: RegiaoDoc[];
}> {
  try {
    const [tiposSnap, orgaosSnap, regioesSnap] = await Promise.all([
      getDocs(collection(db, 'tipos_problema')),
      getDocs(collection(db, 'orgaos_responsaveis')),
      getDocs(collection(db, 'regioes')),
    ]);

    const tipos = tiposSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as { nome: string }) }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const orgaos = orgaosSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as { nome: string; contato: string }) }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const regioes = regioesSnap.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as Omit<RegiaoDoc, 'id'>),
      }))
      .sort((a, b) => a.bairro.localeCompare(b.bairro));

    return { tipos, orgaos, regioes };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'catalogos');
  }
}

export async function createRegiao(
  uid: string,
  input: { bairro: string; cidade: string; estado: string }
): Promise<RegiaoDoc> {
  const bairro = input.bairro.trim().slice(0, BLUEPRINT_LIMITS.REGIAO_BAIRRO_MAX);
  const cidade = input.cidade.trim().slice(0, BLUEPRINT_LIMITS.REGIAO_CIDADE_MAX);
  const estado = input.estado.trim().toUpperCase();

  if (bairro.length < BLUEPRINT_LIMITS.REGIAO_BAIRRO_MIN) {
    throw new Error('Informe o nome do bairro.');
  }
  if (cidade.length < BLUEPRINT_LIMITS.REGIAO_CIDADE_MIN) {
    throw new Error('Informe a cidade.');
  }
  if (!BLUEPRINT_LIMITS.UF_PATTERN.test(estado)) {
    throw new Error('Informe a sigla do estado com 2 letras (ex.: SP).');
  }

  const ref = doc(collection(db, 'regioes'));
  try {
    await setDoc(ref, {
      bairro,
      cidade,
      estado,
      criadoPorUid: uid,
      createdAt: serverTimestamp(),
    });
    return {
      id: ref.id,
      bairro,
      cidade,
      estado,
      criadoPorUid: uid,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `regioes/${ref.id}`);
  }
}

export async function findOrCreateRegiao(
  uid: string,
  input: { bairro: string; cidade: string; estado: string },
  existingRegioes: RegiaoDoc[]
): Promise<{ regiao: RegiaoDoc; created: boolean }> {
  const bairroNorm = input.bairro.trim().toLowerCase();
  const cidadeNorm = input.cidade.trim().toLowerCase();
  const estadoNorm = input.estado.trim().toUpperCase();

  const match = existingRegioes.find(
    (r) =>
      r.bairro.trim().toLowerCase() === bairroNorm &&
      r.cidade.trim().toLowerCase() === cidadeNorm &&
      r.estado.trim().toUpperCase() === estadoNorm
  );
  if (match) {
    return { regiao: match, created: false };
  }

  const created = await createRegiao(uid, input);
  return { regiao: created, created: true };
}

export function formatEnderecoResumo(e: Pick<
  EnderecoDoc,
  'logradouro' | 'numero' | 'bairro' | 'cidade' | 'estado' | 'cep'
>): string {
  const numPart = e.numero.trim() ? `, ${e.numero.trim()}` : ', s/n';
  const cepPart =
    e.cep && e.cep.length === 8
      ? ` · CEP ${e.cep.slice(0, 5)}-${e.cep.slice(5)}`
      : '';
  return `${e.logradouro}${numPart} · ${e.bairro}, ${e.cidade} - ${e.estado}${cepPart}`.slice(
    0,
    BLUEPRINT_LIMITS.CHAMADO_ENDERECO_RESUMO_MAX
  );
}

export function subscribeUserEnderecos(
  uid: string,
  onData: (enderecos: EnderecoDoc[]) => void,
  onError: (err: Error) => void
): () => void {
  const colRef = collection(db, 'usuarios', uid, 'enderecos');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: EnderecoDoc[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<EnderecoDoc, 'id'>),
      }));
      list.sort((a, b) => {
        if (a.principal !== b.principal) return a.principal ? -1 : 1;
        const ta = a.updatedAt?.toMillis() ?? Date.now();
        const tb = b.updatedAt?.toMillis() ?? Date.now();
        return tb - ta;
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `usuarios/${uid}/enderecos`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveUserEndereco(
  uid: string,
  input: EnderecoInput,
  existingId?: string,
  allCurrent?: EnderecoDoc[]
): Promise<string> {
  const apelido = input.apelido.trim().slice(0, BLUEPRINT_LIMITS.ENDERECO_APELIDO_MAX);
  const cep = input.cep.replace(/\D/g, '').slice(0, BLUEPRINT_LIMITS.ENDERECO_CEP_MAX);
  const logradouro = input.logradouro
    .trim()
    .slice(0, BLUEPRINT_LIMITS.ENDERECO_LOGRADOURO_MAX);
  const numero = input.numero.trim().slice(0, BLUEPRINT_LIMITS.ENDERECO_NUMERO_MAX);
  const complemento = input.complemento
    .trim()
    .slice(0, BLUEPRINT_LIMITS.ENDERECO_COMPLEMENTO_MAX);
  const bairro = input.bairro.trim().slice(0, BLUEPRINT_LIMITS.REGIAO_BAIRRO_MAX);
  const cidade = input.cidade.trim().slice(0, BLUEPRINT_LIMITS.REGIAO_CIDADE_MAX);
  const estado = input.estado.trim().toUpperCase();
  const referencia = input.referencia
    .trim()
    .slice(0, BLUEPRINT_LIMITS.ENDERECO_REFERENCIA_MAX);

  if (apelido.length < BLUEPRINT_LIMITS.ENDERECO_APELIDO_MIN) {
    throw new Error('Informe um nome para o endereço (ex.: Casa, Trabalho).');
  }
  if (!BLUEPRINT_LIMITS.CEP_PATTERN.test(cep)) {
    throw new Error('O CEP deve ter 8 dígitos.');
  }
  if (logradouro.length < BLUEPRINT_LIMITS.ENDERECO_LOGRADOURO_MIN) {
    throw new Error('Informe o nome da rua ou avenida.');
  }
  if (bairro.length < BLUEPRINT_LIMITS.REGIAO_BAIRRO_MIN) {
    throw new Error('Informe o bairro.');
  }
  if (cidade.length < BLUEPRINT_LIMITS.REGIAO_CIDADE_MIN) {
    throw new Error('Informe a cidade.');
  }
  if (!BLUEPRINT_LIMITS.UF_PATTERN.test(estado)) {
    throw new Error('Informe a sigla do estado com 2 letras (ex.: SP).');
  }
  if (
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    throw new Error('Toque no mapa para marcar a localização exata do endereço.');
  }

  const colRef = collection(db, 'usuarios', uid, 'enderecos');
  const targetRef = existingId ? doc(colRef, existingId) : doc(colRef);
  const shouldBePrincipal =
    input.principal || !allCurrent || allCurrent.length === 0;

  const batch = writeBatch(db);

  if (shouldBePrincipal && allCurrent) {
    for (const item of allCurrent) {
      if (item.id !== targetRef.id && item.principal) {
        batch.update(doc(colRef, item.id), {
          principal: false,
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  const fields = {
    usuarioId: uid,
    apelido,
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
    referencia,
    latitude: input.latitude,
    longitude: input.longitude,
    principal: shouldBePrincipal,
    updatedAt: serverTimestamp(),
  };

  if (existingId) {
    batch.update(targetRef, fields);
  } else {
    batch.set(targetRef, {
      ...fields,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return targetRef.id;
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      `usuarios/${uid}/enderecos/${targetRef.id}`
    );
  }
}

export async function setPrincipalEndereco(
  uid: string,
  enderecoId: string,
  allCurrent: EnderecoDoc[]
): Promise<void> {
  const colRef = collection(db, 'usuarios', uid, 'enderecos');
  const batch = writeBatch(db);

  for (const item of allCurrent) {
    if (item.id === enderecoId && !item.principal) {
      batch.update(doc(colRef, item.id), {
        principal: true,
        updatedAt: serverTimestamp(),
      });
    } else if (item.id !== enderecoId && item.principal) {
      batch.update(doc(colRef, item.id), {
        principal: false,
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `usuarios/${uid}/enderecos/${enderecoId}`
    );
  }
}

export async function deleteUserEndereco(
  uid: string,
  enderecoId: string
): Promise<void> {
  const path = `usuarios/${uid}/enderecos/${enderecoId}`;
  try {
    await deleteDoc(doc(db, 'usuarios', uid, 'enderecos', enderecoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserChamados(
  uid: string,
  onData: (chamados: ChamadoDoc[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(collection(db, 'chamados'), where('usuarioId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: ChamadoDoc[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ChamadoDoc, 'id'>),
      }));
      list.sort((a, b) => {
        const ta = a.dataAbertura?.toMillis() ?? Date.now();
        const tb = b.dataAbertura?.toMillis() ?? Date.now();
        return tb - ta;
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'chamados');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createChamadoWithPhotos(params: {
  usuario: UsuarioProfile;
  titulo: string;
  descricao: string;
  regiao: RegiaoDoc;
  tipo: TipoProblemaDoc;
  fotos: ProcessedImage[];
  endereco?: EnderecoDoc | null;
}): Promise<ChamadoDoc> {
  const titulo = params.titulo.trim().slice(0, BLUEPRINT_LIMITS.CHAMADO_TITULO_MAX);
  const descricao = params.descricao.trim().slice(0, BLUEPRINT_LIMITS.CHAMADO_DESCRICAO_MAX);

  if (titulo.length < BLUEPRINT_LIMITS.CHAMADO_TITULO_MIN) {
    throw new Error('O título do chamado deve ter pelo menos 3 caracteres.');
  }

  const chamadoRef = doc(collection(db, 'chamados'));
  const regiaoResumo = `${params.regiao.bairro}, ${params.regiao.cidade} - ${params.regiao.estado}`.slice(
    0,
    220
  );
  const usuarioNome = params.usuario.nome.slice(0, 120);
  const tipoProblemaNome = params.tipo.nome.slice(0, 100);
  const enderecoResumo = params.endereco ? formatEnderecoResumo(params.endereco) : undefined;

  const payload: Record<string, unknown> = {
    titulo,
    descricao,
    dataAbertura: serverTimestamp(),
    status: 'ABERTO',
    usuarioId: params.usuario.uid,
    usuarioNome,
    regiaoId: params.regiao.id,
    regiaoResumo,
    tipoProblemaId: params.tipo.id,
    tipoProblemaNome,
    fotosCount: 0,
    updatedAt: serverTimestamp(),
  };

  if (params.endereco && enderecoResumo) {
    payload.enderecoId = params.endereco.id.slice(0, 128);
    payload.enderecoResumo = enderecoResumo;
    payload.latitude = params.endereco.latitude;
    payload.longitude = params.endereco.longitude;
  }

  try {
    await setDoc(chamadoRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `chamados/${chamadoRef.id}`);
  }

  for (const foto of params.fotos) {
    await attachFotoToChamado(chamadoRef.id, params.usuario.uid, foto);
  }

  return {
    id: chamadoRef.id,
    titulo,
    descricao,
    dataAbertura: null,
    status: 'ABERTO',
    usuarioId: params.usuario.uid,
    usuarioNome,
    regiaoId: params.regiao.id,
    regiaoResumo,
    tipoProblemaId: params.tipo.id,
    tipoProblemaNome,
    fotosCount: params.fotos.length,
    ...(params.endereco && enderecoResumo
      ? {
          enderecoId: params.endereco.id.slice(0, 128),
          enderecoResumo,
          latitude: params.endereco.latitude,
          longitude: params.endereco.longitude,
        }
      : {}),
    updatedAt: null,
  };
}

export async function attachFotoToChamado(
  chamadoId: string,
  usuarioId: string,
  foto: ProcessedImage
): Promise<void> {
  const fotoRef = doc(collection(db, 'chamados', chamadoId, 'fotos'));
  const chamadoRef = doc(db, 'chamados', chamadoId);
  const batch = writeBatch(db);

  batch.set(fotoRef, {
    nomeArquivo: foto.nomeArquivo,
    mimeType: foto.mimeType,
    imagemDataUrl: foto.imagemDataUrl,
    chamadoId,
    usuarioId,
    createdAt: serverTimestamp(),
  });
  batch.update(chamadoRef, {
    fotosCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `chamados/${chamadoId}/fotos/${fotoRef.id}`);
  }
}

export function subscribeChamadoDetail(
  chamadoId: string,
  onChamado: (chamado: ChamadoDoc | null) => void,
  onFotos: (fotos: FotoDoc[]) => void,
  onAnalise: (analise: AnaliseIADoc | null) => void,
  onError: (err: Error) => void
): () => void {
  const unsubChamado = onSnapshot(
    doc(db, 'chamados', chamadoId),
    (snap) => {
      onChamado(
        snap.exists() ? { id: snap.id, ...(snap.data() as Omit<ChamadoDoc, 'id'>) } : null
      );
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `chamados/${chamadoId}`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubFotos = onSnapshot(
    collection(db, 'chamados', chamadoId, 'fotos'),
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FotoDoc, 'id'>),
      }));
      list.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
      onFotos(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `chamados/${chamadoId}/fotos`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubAnalise = onSnapshot(
    doc(db, 'chamados', chamadoId, 'analise', 'atual'),
    (snap) => {
      onAnalise(
        snap.exists()
          ? { id: snap.id, ...(snap.data() as Omit<AnaliseIADoc, 'id'>) }
          : null
      );
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `chamados/${chamadoId}/analise/atual`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    unsubChamado();
    unsubFotos();
    unsubAnalise();
  };
}

export async function updateChamadoStatus(
  chamadoId: string,
  status: Exclude<StatusChamado, 'ABERTO'>
): Promise<void> {
  const path = `chamados/${chamadoId}`;
  try {
    await updateDoc(doc(db, 'chamados', chamadoId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface SugestaoChamadoIA {
  titulo: string;
  tipoId: string;
  tipoNome: string;
  descricaoSugerida: string;
}

export async function suggestChamadoFromPhotoAndDescription(params: {
  descricao: string;
  fotos: Array<{ imagemDataUrl: string; mimeType?: string }>;
  tipos: TipoProblemaDoc[];
}): Promise<SugestaoChamadoIA> {
  const resp = await fetch('/api/analisar/sugerir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      descricao: params.descricao,
      fotos: params.fotos.slice(0, 4).map((f) => ({
        imagemDataUrl: f.imagemDataUrl,
        mimeType: f.mimeType,
      })),
      tipos: params.tipos,
    }),
  });

  const data = await parseJsonResponse<SugestaoChamadoIA & { message?: string }>(
    resp,
    'Não foi possível gerar sugestão com a IA.'
  );

  if (!resp.ok) {
    throw new Error(data.message || 'Não foi possível gerar sugestão com a IA.');
  }

  return data;
}

export async function runChamadoAIAnalysis(
  chamado: ChamadoDoc,
  orgaos: OrgaoResponsavelDoc[],
  fotos: Array<{ imagemDataUrl: string; mimeType?: string }> = []
): Promise<void> {
  const resp = await fetch('/api/analisar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titulo: chamado.titulo,
      tipoProblemaNome: chamado.tipoProblemaNome,
      descricao: chamado.descricao,
      regiaoResumo: chamado.regiaoResumo,
      enderecoResumo: chamado.enderecoResumo || '',
      fotosCount: Math.max(chamado.fotosCount, fotos.length),
      fotos: fotos.slice(0, 4).map((f) => ({
        imagemDataUrl: f.imagemDataUrl,
        mimeType: f.mimeType,
      })),
      orgaos,
    }),
  });

  const data = await parseJsonResponse<{
    urgencia?: UrgenciaIA;
    prazoEstimado?: string;
    diagnostico?: string;
    passosResolucao?: string[];
    modeloProtocolo?: string;
    orientacao?: string;
    respostaBruta?: string;
    orgaoId?: string;
    orgaoNome?: string;
    orgaoContato?: string;
    message?: string;
  }>(resp, 'Falha ao executar análise da IA.');

  if (!resp.ok) {
    throw new Error(data.message || 'Falha ao executar análise da IA.');
  }

  const passosResolucao = Array.isArray(data.passosResolucao)
    ? data.passosResolucao
        .map((p) => String(p || '').trim().slice(0, BLUEPRINT_LIMITS.ANALISE_PASSO_ITEM_MAX))
        .filter(Boolean)
        .slice(0, BLUEPRINT_LIMITS.ANALISE_PASSOS_MAX)
    : [];

  const analiseRef = doc(db, 'chamados', chamado.id, 'analise', 'atual');
  const chamadoRef = doc(db, 'chamados', chamado.id);

  try {
    await setDoc(analiseRef, {
      urgencia: data.urgencia || 'MEDIA',
      orientacao: (data.orientacao || '').slice(0, BLUEPRINT_LIMITS.ANALISE_ORIENTACAO_MAX),
      respostaBruta: (data.respostaBruta || '').slice(
        0,
        BLUEPRINT_LIMITS.ANALISE_RESPOSTA_BRUTA_MAX
      ),
      dataAnalise: serverTimestamp(),
      chamadoId: chamado.id,
      usuarioId: chamado.usuarioId,
      orgaoId: (data.orgaoId || '').slice(0, 128),
      orgaoNome: (data.orgaoNome || '').slice(0, 120),
      orgaoContato: (data.orgaoContato || '').slice(0, 100),
      diagnostico: (data.diagnostico || '').slice(0, BLUEPRINT_LIMITS.ANALISE_DIAGNOSTICO_MAX),
      prazoEstimado: (data.prazoEstimado || '').slice(0, BLUEPRINT_LIMITS.ANALISE_PRAZO_MAX),
      passosResolucao,
      modeloProtocolo: (data.modeloProtocolo || '').slice(
        0,
        BLUEPRINT_LIMITS.ANALISE_PROTOCOLO_MAX
      ),
    });

    if (chamado.status !== 'RESOLVIDO') {
      await updateDoc(chamadoRef, {
        status: 'EM_ANALISE',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `chamados/${chamado.id}/analise/atual`);
  }
}
