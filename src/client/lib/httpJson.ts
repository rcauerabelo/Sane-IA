export async function parseJsonResponse<T>(
  resp: Response,
  fallbackErrorMessage: string
): Promise<T> {
  const rawText = await resp.text();
  const trimmed = rawText.trim();
  const contentType = resp.headers.get('content-type') || '';

  let parsed: unknown = null;
  let isValidJson = false;

  if (trimmed.length > 0) {
    try {
      parsed = JSON.parse(trimmed);
      isValidJson = true;
    } catch {
      isValidJson = false;
    }
  }

  if (!isValidJson) {
    const looksLikeHtml =
      contentType.includes('text/html') ||
      trimmed.startsWith('<!') ||
      trimmed.toLowerCase().startsWith('<html');

    if (looksLikeHtml) {
      throw new Error(
        `A API retornou HTML em vez de JSON (HTTP ${resp.status}). Recarregue a página ou verifique se o servidor backend está ativo.`
      );
    }

    throw new Error(
      `${fallbackErrorMessage} (resposta inválida do servidor, HTTP ${resp.status}).`
    );
  }

  return parsed as T;
}
