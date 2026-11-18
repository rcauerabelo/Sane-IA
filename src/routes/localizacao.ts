import { Router } from 'express';
import { HttpError } from '../errors.js';

export const localizacaoRouter = Router();

interface GeocodeComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  error?: { status?: string; message?: string };
  results?: Array<{
    formatted_address?: string;
    address_components?: GeocodeComponent[];
    geometry?: {
      location?: { lat: number; lng: number };
    };
  }>;
}

export interface ParsedEndereco {
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

function getMapsApiKey(): string {
  return (
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
}

function extractAddressFromResults(
  results: NonNullable<GoogleGeocodeResponse['results']>,
  overrideLat?: number,
  overrideLng?: number
): ParsedEndereco {
  const first = results[0];
  const allComponents = results.flatMap((r) => r.address_components || []);

  const findComp = (types: string[], useShort = false): string => {
    for (const type of types) {
      const comp = allComponents.find((c) => c.types.includes(type));
      if (comp) {
        return (useShort ? comp.short_name : comp.long_name || '').trim();
      }
    }
    return '';
  };

  const rawPostal = findComp(['postal_code']).replace(/\D/g, '');
  const cep = rawPostal.length === 8 ? rawPostal : '';
  const logradouro = findComp(['route', 'street_address', 'premise']);
  const numero = findComp(['street_number']);
  const bairro = findComp([
    'sublocality_level_1',
    'sublocality',
    'neighborhood',
    'sublocality_level_2',
  ]);
  const cidade = findComp(['administrative_area_level_2', 'locality']);
  const rawEstado = findComp(['administrative_area_level_1'], true).toUpperCase();
  const estado = /^[A-Z]{2}$/.test(rawEstado) ? rawEstado : '';

  const loc = first?.geometry?.location;
  const latitude =
    typeof overrideLat === 'number'
      ? overrideLat
      : typeof loc?.lat === 'number'
      ? loc.lat
      : null;
  const longitude =
    typeof overrideLng === 'number'
      ? overrideLng
      : typeof loc?.lng === 'number'
      ? loc.lng
      : null;

  return {
    cep,
    logradouro,
    numero,
    bairro,
    cidade,
    estado,
    formattedAddress: first?.formatted_address || '',
    latitude,
    longitude,
  };
}

async function callGoogleGeocode(
  params: Record<string, string>
): Promise<GoogleGeocodeResponse> {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    throw new HttpError(
      503,
      'Chave da API do Google Maps não configurada no servidor.'
    );
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('region', 'br');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
    },
    signal: AbortSignal.timeout(8000),
  });

  const rawText = await response.text();
  let data: GoogleGeocodeResponse;
  try {
    data = JSON.parse(rawText) as GoogleGeocodeResponse;
  } catch {
    throw new HttpError(
      502,
      `Resposta inválida da API de Geocodificação (HTTP ${response.status}).`
    );
  }

  if (
    response.status === 429 ||
    data.status === 'OVER_QUERY_LIMIT' ||
    data.error?.status === 'RESOURCE_EXHAUSTED'
  ) {
    throw new HttpError(
      429,
      'Limite de consultas do Google Maps atingido. Tente novamente mais tarde.'
    );
  }

  if (!response.ok) {
    throw new HttpError(
      502,
      data.error_message || `Erro ao consultar Geocoding API (${response.status}).`
    );
  }

  if (data.status === 'REQUEST_DENIED') {
    throw new HttpError(
      403,
      data.error_message || 'Acesso negado à API de Geocodificação.'
    );
  }

  return data;
}

// Exposes the client Maps JS key when runtime-injected outside Vite build-time env
localizacaoRouter.get('/config/maps', (_req, res) => {
  res.json({ apiKey: getMapsApiKey() });
});

// Brazilian CEP lookup via ViaCEP + optional Google Geocoding for map centering
localizacaoRouter.get('/cep/:cep', async (req, res, next) => {
  try {
    const digits = (req.params.cep || '').replace(/\D/g, '');
    if (!/^\d{8}$/.test(digits)) {
      throw new HttpError(400, 'Informe um CEP válido com 8 dígitos.');
    }

    const viacepResp = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      method: 'GET',
      signal: AbortSignal.timeout(7000),
    });

    if (!viacepResp.ok) {
      throw new HttpError(502, 'Não foi possível consultar o serviço de CEP.');
    }

    const viacepText = await viacepResp.text();
    let viacepData: {
      erro?: boolean | string;
      cep?: string;
      logradouro?: string;
      complemento?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    try {
      viacepData = JSON.parse(viacepText) as typeof viacepData;
    } catch {
      throw new HttpError(502, 'O serviço de CEP retornou uma resposta inválida.');
    }

    if (viacepData.erro === true || viacepData.erro === 'true') {
      throw new HttpError(404, 'CEP não encontrado.');
    }

    const logradouro = (viacepData.logradouro || '').trim();
    const complemento = (viacepData.complemento || '').trim();
    const bairro = (viacepData.bairro || '').trim();
    const cidade = (viacepData.localidade || '').trim();
    const estado = (viacepData.uf || '').trim().toUpperCase();

    let latitude: number | null = null;
    let longitude: number | null = null;
    let quotaExceeded = false;

    if (req.query.geocode !== '0' && getMapsApiKey()) {
      const addressParts = [
        logradouro,
        bairro,
        cidade && estado ? `${cidade} - ${estado}` : cidade,
        `${digits.slice(0, 5)}-${digits.slice(5)}`,
        'Brasil',
      ].filter(Boolean);

      try {
        const geo = await callGoogleGeocode({
          address: addressParts.join(', '),
          components: 'country:BR',
        });
        const loc = geo.results?.[0]?.geometry?.location;
        if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          latitude = loc.lat;
          longitude = loc.lng;
        }
      } catch (geoErr) {
        if (geoErr instanceof HttpError && geoErr.status === 429) {
          quotaExceeded = true;
        }
      }
    }

    res.json({
      cep: digits,
      cepFormatado: `${digits.slice(0, 5)}-${digits.slice(5)}`,
      logradouro,
      complemento,
      bairro,
      cidade,
      estado,
      latitude,
      longitude,
      quotaExceeded,
    });
  } catch (err) {
    next(err);
  }
});

// Server-side Reverse Geocoding proxy (CF1: avoids browser CORS block)
localizacaoRouter.get('/geocode/reverse', async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new HttpError(400, 'Latitude inválida.');
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new HttpError(400, 'Longitude inválida.');
    }

    const data = await callGoogleGeocode({
      latlng: `${lat},${lng}`,
    });

    const results = data.results || [];
    if (results.length === 0) {
      res.json({
        cep: '',
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        formattedAddress: '',
        latitude: lat,
        longitude: lng,
      });
      return;
    }

    const parsed = extractAddressFromResults(results, lat, lng);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
});

// Server-side Forward Geocoding proxy (centers map when user types street/city)
localizacaoRouter.get('/geocode/address', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 3 || q.length > 300) {
      throw new HttpError(400, 'Informe um endereço válido para localizar no mapa.');
    }

    const data = await callGoogleGeocode({
      address: q,
      components: 'country:BR',
    });

    const results = data.results || [];
    if (results.length === 0) {
      throw new HttpError(404, 'Endereço não encontrado no mapa.');
    }

    const parsed = extractAddressFromResults(results);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
});
