import { HttpError } from '../errors.js';

/**
 * Cliente da API de IA (formato compatível com OpenAI: Groq, OpenRouter etc.).
 * Configurado via variáveis de ambiente GROQ_API_KEY, IA_API_URL e IA_API_MODEL.
 */
export class IAClient {
  public async enviar(prompt: string): Promise<string> {
    const url =
      process.env.IA_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
    const apiKey = process.env.GROQ_API_KEY || '';
    const model = process.env.IA_API_MODEL || 'openai/gpt-oss-120b';

    if (!apiKey.trim()) {
      throw new HttpError(
        500,
        'Chave da API de IA não configurada. Defina a variável de ambiente GROQ_API_KEY.'
      );
    }

    try {
      const corpo = {
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Você é um assistente especializado em saneamento básico e abastecimento de água no Brasil. Responda sempre em português do Brasil.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(corpo),
      });

      const bodyText = await resp.text();
      if (!resp.ok) {
        throw new HttpError(502, `Erro da API de IA (${resp.status}): ${bodyText}`);
      }

      const parsed = JSON.parse(bodyText) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return parsed.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      if (err instanceof HttpError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpError(502, `Falha ao chamar a IA: ${message}`);
    }
  }
}

export const iaClient = new IAClient();
