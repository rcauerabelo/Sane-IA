import { GoogleGenAI, Part, Type } from '@google/genai';
import { HttpError } from '../errors.js';

export interface FotoAnaliseInput {
  imagemDataUrl: string;
  mimeType?: string;
}

export interface OrgaoAnaliseInput {
  id: string;
  nome: string;
  contato: string;
}

export interface AnaliseOcorrenciaInput {
  titulo: string;
  tipoProblemaNome: string;
  descricao: string;
  regiaoResumo: string;
  enderecoResumo: string;
  fotosCount: number;
  fotos?: FotoAnaliseInput[];
  orgaos: OrgaoAnaliseInput[];
}

export interface AnaliseOcorrenciaOutput {
  urgencia: 'BAIXA' | 'MEDIA' | 'ALTA';
  orgao_responsavel: string;
  prazo_estimado: string;
  diagnostico: string;
  passos_resolucao: string[];
  modelo_protocolo: string;
  orientacao: string;
  respostaBruta: string;
}

export interface SugerirPreenchimentoOutput {
  titulo: string;
  tipo_problema: string;
  descricao_sugerida: string;
}

const GEMINI_MODEL = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new HttpError(
      500,
      'Chave GEMINI_API_KEY não configurada no servidor. Configure em Settings > Secrets ou no arquivo .env.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseDataUrlToPart(foto: FotoAnaliseInput): Part | null {
  const raw = (foto.imagemDataUrl || '').trim();
  if (!raw) return null;

  const match = /^data:([^;]+);base64,(.+)$/i.exec(raw);
  if (match) {
    const mimeType = match[1].trim();
    const data = match[2].trim();
    if (!mimeType.startsWith('image/') || !data) return null;
    return {
      inlineData: {
        mimeType,
        data,
      },
    };
  }

  return null;
}

function mapGeminiError(err: unknown): HttpError {
  if (err instanceof HttpError) {
    return err;
  }

  const rawMsg = err instanceof Error ? err.message : String(err);
  const upper = rawMsg.toUpperCase();

  if (upper.includes('API_KEY_INVALID') || upper.includes('INVALID_ARGUMENT')) {
    return new HttpError(
      400,
      'Chave GEMINI_API_KEY inválida. Verifique sua chave em Settings > Secrets ou no arquivo .env.'
    );
  }
  if (upper.includes('PERMISSION_DENIED') || upper.includes('403')) {
    return new HttpError(
      403,
      'Permissão negada na API Gemini. Verifique sua chave em Settings > Secrets.'
    );
  }
  if (upper.includes('RESOURCE_EXHAUSTED') || upper.includes('429')) {
    return new HttpError(
      429,
      'Limite temporário de requisições da API Gemini atingido. Aguarde alguns instantes e tente novamente.'
    );
  }
  if (upper.includes('NOT_FOUND') || upper.includes('404')) {
    return new HttpError(
      502,
      `Modelo Gemini (${GEMINI_MODEL}) não encontrado ou indisponível no momento.`
    );
  }

  return new HttpError(502, `Falha ao consultar a IA (Gemini): ${rawMsg}`);
}

export class IAClient {
  public async analisarOcorrencia(
    input: AnaliseOcorrenciaInput
  ): Promise<AnaliseOcorrenciaOutput> {
    const ai = getGeminiClient();

    const imageParts: Part[] = (input.fotos || [])
      .slice(0, 4)
      .map(parseDataUrlToPart)
      .filter((p): p is Part => p !== null);

    const nomesOrgaos = input.orgaos.map((o) => o.nome).filter(Boolean).join('; ');
    const localTexto = input.enderecoResumo || input.regiaoResumo || 'Local não informado';

    const promptTexto =
      'Analise esta ocorrência de saneamento básico considerando TODAS as imagens anexadas (se houver) e a descrição do morador.\n\n' +
      `Título: ${input.titulo || 'Não informado'}\n` +
      `Categoria informada: ${input.tipoProblemaNome || 'Não informada'}\n` +
      `Descrição do morador: ${input.descricao || 'Não detalhada pelo morador'}\n` +
      `Local / Endereço: ${localTexto}\n` +
      `Região: ${input.regiaoResumo || 'Não informada'}\n` +
      `Total de fotos anexadas: ${Math.max(input.fotosCount, imageParts.length)}\n` +
      `Órgãos disponíveis para encaminhamento: ${nomesOrgaos || 'Companhia de Saneamento; Prefeitura - Secretaria de Obras; Vigilância Sanitária'}`;

    const parts: Part[] = [...imageParts, { text: promptTexto }];

    const systemInstruction =
      'Você é um engenheiro especialista em saneamento básico e atendimento urbano no Brasil, atuando como o motor principal do aplicativo SaneIA. ' +
      'Sempre responda em português do Brasil claro, prático e objetivo. ' +
      'Quando houver fotos anexadas, descreva o que é observável na imagem (ex.: intensidade de vazamento, água turva, esgoto aparente, risco viário ou contato com residências) dentro do diagnóstico e adapte os passos de resolução à cena real vista na foto. ' +
      'Se não houver fotos, baseie a análise na descrição, categoria e localização. ' +
      'Escolha exatamente um órgão responsável da lista informada quando compatível, defina a urgência (BAIXA, MEDIA ou ALTA), informe um prazo sugerido realista, liste de 3 a 5 passos práticos ordenados de como resolver e gere um modelo de protocolo formal pronto para copiar.';

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              urgencia: {
                type: Type.STRING,
                enum: ['BAIXA', 'MEDIA', 'ALTA'],
                description: 'Classificação de urgência da ocorrência.',
              },
              orgao_responsavel: {
                type: Type.STRING,
                description: 'Nome do órgão responsável mais adequado da lista fornecida.',
              },
              prazo_estimado: {
                type: Type.STRING,
                description:
                  'Prazo curto com no máximo 50 caracteres (ex.: "Atendimento imediato (até 24h)", "24h a 48h", "3 a 5 dias úteis").',
              },
              diagnostico: {
                type: Type.STRING,
                description:
                  'Resumo técnico acessível em 2 a 4 frases citando o que foi identificado na foto (se enviada) e na descrição, além dos riscos.',
              },
              passos_resolucao: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'De 3 a 5 passos práticos ordenados: medidas imediatas de segurança para o morador, registro de provas e acionamento do órgão.',
              },
              modelo_protocolo: {
                type: Type.STRING,
                description:
                  'Mensagem formal pronta para copiar e enviar ao órgão responsável, contendo ocorrência, local exato e solicitação.',
              },
              orientacao: {
                type: Type.STRING,
                description: 'Resumo prático consolidado em até 4 linhas.',
              },
            },
            required: [
              'urgencia',
              'orgao_responsavel',
              'prazo_estimado',
              'diagnostico',
              'passos_resolucao',
              'modelo_protocolo',
              'orientacao',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new HttpError(502, 'A API Gemini retornou uma resposta vazia.');
      }

      const parsed = JSON.parse(rawText) as Partial<AnaliseOcorrenciaOutput>;
      const rawUrg = String(parsed.urgencia || 'MEDIA').toUpperCase();
      const urgencia: 'BAIXA' | 'MEDIA' | 'ALTA' =
        rawUrg === 'BAIXA' || rawUrg === 'ALTA' ? rawUrg : 'MEDIA';

      return {
        urgencia,
        orgao_responsavel: String(parsed.orgao_responsavel || '').trim(),
        prazo_estimado: String(parsed.prazo_estimado || '').trim(),
        diagnostico: String(parsed.diagnostico || '').trim(),
        passos_resolucao: Array.isArray(parsed.passos_resolucao)
          ? parsed.passos_resolucao.map((p) => String(p || '').trim()).filter(Boolean)
          : [],
        modelo_protocolo: String(parsed.modelo_protocolo || '').trim(),
        orientacao: String(parsed.orientacao || '').trim(),
        respostaBruta: rawText,
      };
    } catch (err) {
      throw mapGeminiError(err);
    }
  }

  public async sugerirPreenchimento(input: {
    descricao: string;
    fotos?: FotoAnaliseInput[];
    tipos: Array<{ id: string; nome: string }>;
  }): Promise<SugerirPreenchimentoOutput> {
    const ai = getGeminiClient();

    const imageParts: Part[] = (input.fotos || [])
      .slice(0, 4)
      .map(parseDataUrlToPart)
      .filter((p): p is Part => p !== null);

    const tiposNomes = input.tipos.map((t) => t.nome).join('; ');
    const promptTexto =
      'Com base na(s) foto(s) anexada(s) e na descrição do morador (se informada), sugira um título curto e direto para o chamado de saneamento, escolha exatamente uma categoria da lista e, se a descrição estiver vazia ou muito curta, proponha uma descrição clara do problema observado.\n\n' +
      `Descrição informada: ${input.descricao.trim() || 'Não informada (analise a imagem)'}\n` +
      `Categorias permitidas: ${tiposNomes}`;

    const parts: Part[] = [...imageParts, { text: promptTexto }];

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: { parts },
        config: {
          systemInstruction:
            'Você auxilia moradores no Brasil a registrar ocorrências de saneamento e água. Responda em português do Brasil usando JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titulo: {
                type: Type.STRING,
                description: 'Título objetivo com até 80 caracteres.',
              },
              tipo_problema: {
                type: Type.STRING,
                description: 'Exatamente uma das categorias permitidas informadas.',
              },
              descricao_sugerida: {
                type: Type.STRING,
                description:
                  'Descrição objetiva baseada na imagem e relato (2 a 3 frases).',
              },
            },
            required: ['titulo', 'tipo_problema', 'descricao_sugerida'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText) as Partial<SugerirPreenchimentoOutput>;
      return {
        titulo: String(parsed.titulo || '').trim().slice(0, 150),
        tipo_problema: String(parsed.tipo_problema || '').trim(),
        descricao_sugerida: String(parsed.descricao_sugerida || '').trim().slice(0, 2000),
      };
    } catch (err) {
      throw mapGeminiError(err);
    }
  }

  public async enviar(prompt: string): Promise<string> {
    const ai = getGeminiClient();
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'Você é um assistente especializado em saneamento básico e abastecimento de água no Brasil. Responda sempre em português do Brasil.',
          responseMimeType: 'application/json',
        },
      });
      return (response.text ?? '').trim();
    } catch (err) {
      throw mapGeminiError(err);
    }
  }
}

export const iaClient = new IAClient();
