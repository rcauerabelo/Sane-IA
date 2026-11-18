import { parseJsonResponse } from './httpJson';

export interface CepLookupResult {
  cep: string;
  cepFormatado: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  latitude: number | null;
  longitude: number | null;
  quotaExceeded?: boolean;
}

export interface GeocodeResult {
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
}

export function formatCep(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function normalizeCepDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 8);
}

function checkQuotaResponse(status: number, payload: Record<string, unknown>): void {
  const errObj = payload.error as { status?: string } | undefined;
  if (
    status === 429 ||
    payload.quotaExceeded === true ||
    payload.status === 'OVER_QUERY_LIMIT' ||
    errObj?.status === 'RESOURCE_EXHAUSTED'
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

export async function fetchMapsApiKey(): Promise<string> {
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  if (envKey) return envKey;

  try {
    const resp = await fetch('/api/config/maps');
    if (!resp.ok) return '';
    const data = await parseJsonResponse<{ apiKey?: string }>(
      resp,
      'Não foi possível ler a configuração do mapa.'
    );
    return (data.apiKey || '').trim();
  } catch {
    return '';
  }
}

export async function lookupCep(cep: string): Promise<CepLookupResult> {
  const digits = normalizeCepDigits(cep);
  if (digits.length !== 8) {
    throw new Error('Informe os 8 dígitos do CEP.');
  }

  const resp = await fetch(`/api/cep/${digits}`);
  const data = await parseJsonResponse<CepLookupResult & { message?: string }>(
    resp,
    'Não foi possível consultar o CEP.'
  );
  checkQuotaResponse(resp.status, data as unknown as Record<string, unknown>);

  if (!resp.ok) {
    throw new Error(data.message || 'Não foi possível consultar o CEP.');
  }

  return data;
}

export async function reverseGeocodePoint(
  lat: number,
  lng: number
): Promise<GeocodeResult> {
  const resp = await fetch(
    `/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
  );
  const data = await parseJsonResponse<
    GeocodeResult & {
      message?: string;
      quotaExceeded?: boolean;
    }
  >(resp, 'Não foi possível identificar o endereço deste ponto.');
  checkQuotaResponse(resp.status, data as unknown as Record<string, unknown>);

  if (!resp.ok) {
    throw new Error(data.message || 'Não foi possível identificar o endereço deste ponto.');
  }

  return data;
}

export async function forwardGeocodeAddress(
  queryText: string
): Promise<GeocodeResult> {
  const resp = await fetch(
    `/api/geocode/address?q=${encodeURIComponent(queryText)}`
  );
  const data = await parseJsonResponse<
    GeocodeResult & {
      message?: string;
      quotaExceeded?: boolean;
    }
  >(resp, 'Não foi possível localizar o endereço no mapa.');
  checkQuotaResponse(resp.status, data as unknown as Record<string, unknown>);

  if (!resp.ok) {
    throw new Error(data.message || 'Não foi possível localizar o endereço no mapa.');
  }

  return data;
}
