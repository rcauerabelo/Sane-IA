import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  MapCameraChangedEvent,
  MapMouseEvent,
  Pin,
  useApiIsLoaded,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import {
  Briefcase,
  Crosshair,
  Home,
  Loader2,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import { BLUEPRINT_LIMITS } from '../lib/blueprint';
import {
  formatCep,
  forwardGeocodeAddress,
  lookupCep,
  normalizeCepDigits,
  reverseGeocodePoint,
} from '../lib/locationApi';
import {
  EnderecoDoc,
  findOrCreateRegiao,
  RegiaoDoc,
  saveUserEndereco,
} from '../lib/saneiaApi';

// Default center: São Paulo, Brasil
const DEFAULT_CENTER = { lat: -23.55052, lng: -46.633308 };

interface AddressFormModalProps {
  open: boolean;
  uid: string;
  editingEndereco: EnderecoDoc | null;
  allEnderecos: EnderecoDoc[];
  regioes: RegiaoDoc[];
  hasMapsProvider: boolean;
  onRegiaoCreated: (regiao: RegiaoDoc) => void;
  onSaved: (savedId: string) => void;
  onClose: () => void;
}

const PRESET_LABELS = ['Casa', 'Trabalho', 'Outro'] as const;

interface InteractiveAddressMapProps {
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
  pinPosition: { lat: number; lng: number };
  loadingReverse: boolean;
  onCameraChanged: (ev: MapCameraChangedEvent) => void;
  onClick: (ev: MapMouseEvent) => void;
}

const InteractiveAddressMap: React.FC<InteractiveAddressMapProps> = ({
  mapCenter,
  mapZoom,
  pinPosition,
  loadingReverse,
  onCameraChanged,
  onClick,
}) => {
  const apiIsLoaded = useApiIsLoaded();
  const apiStatus = useApiLoadingStatus();

  return (
    <div className="relative h-64 sm:h-72 w-full rounded-xl overflow-hidden border border-zinc-300 bg-zinc-100">
      {apiStatus === APILoadingStatus.FAILED ||
      apiStatus === APILoadingStatus.AUTH_FAILURE ? (
        <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center text-xs text-zinc-600">
          Não foi possível carregar o mapa interativo no momento. Preencha os campos abaixo pelo CEP.
        </div>
      ) : !apiIsLoaded ? (
        <div className="h-full w-full flex items-center justify-center gap-2 text-xs text-zinc-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando mapa...</span>
        </div>
      ) : (
        <GoogleMap
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          center={mapCenter}
          zoom={mapZoom}
          onCameraChanged={onCameraChanged}
          onClick={onClick}
          gestureHandling="greedy"
          disableDefaultUI={false}
          streetViewControl={false}
          mapTypeControl={false}
          style={{ width: '100%', height: '100%' }}
        >
          <AdvancedMarker position={pinPosition} title="Local selecionado">
            <Pin background="#09090b" borderColor="#ffffff" glyphColor="#ffffff" />
          </AdvancedMarker>
        </GoogleMap>
      )}

      {loadingReverse && (
        <div className="absolute top-3 left-3 rounded-lg bg-zinc-950/90 text-white px-3 py-1.5 text-xs flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Identificando rua...</span>
        </div>
      )}
    </div>
  );
};

export const AddressFormModal: React.FC<AddressFormModalProps> = ({
  open,
  uid,
  editingEndereco,
  allEnderecos,
  regioes,
  hasMapsProvider,
  onRegiaoCreated,
  onSaved,
  onClose,
}) => {
  const [apelidoPreset, setApelidoPreset] = useState<'Casa' | 'Trabalho' | 'Outro'>('Casa');
  const [apelidoCustom, setApelidoCustom] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [semNumero, setSemNumero] = useState(false);
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [referencia, setReferencia] = useState('');
  const [principal, setPrincipal] = useState(true);

  const [pinPosition, setPinPosition] = useState<{ lat: number; lng: number }>(
    DEFAULT_CENTER
  );
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(
    DEFAULT_CENTER
  );
  const [mapZoom, setMapZoom] = useState<number>(13);

  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingReverse, setLoadingReverse] = useState(false);
  const [loadingForward, setLoadingForward] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const lastAutoCepRef = useRef('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setInfoMsg('');

    if (editingEndereco) {
      const preset =
        editingEndereco.apelido === 'Casa' || editingEndereco.apelido === 'Trabalho'
          ? editingEndereco.apelido
          : 'Outro';
      setApelidoPreset(preset);
      setApelidoCustom(preset === 'Outro' ? editingEndereco.apelido : '');
      setCep(formatCep(editingEndereco.cep));
      lastAutoCepRef.current = editingEndereco.cep;
      setLogradouro(editingEndereco.logradouro);
      setNumero(editingEndereco.numero);
      setSemNumero(editingEndereco.numero.toUpperCase() === 'S/N');
      setComplemento(editingEndereco.complemento);
      setBairro(editingEndereco.bairro);
      setCidade(editingEndereco.cidade);
      setEstado(editingEndereco.estado);
      setReferencia(editingEndereco.referencia);
      setPrincipal(editingEndereco.principal);
      const pos = {
        lat: editingEndereco.latitude,
        lng: editingEndereco.longitude,
      };
      setPinPosition(pos);
      setMapCenter(pos);
      setMapZoom(17);
    } else {
      setApelidoPreset('Casa');
      setApelidoCustom('');
      setCep('');
      lastAutoCepRef.current = '';
      setLogradouro('');
      setNumero('');
      setSemNumero(false);
      setComplemento('');
      setBairro('');
      setCidade('');
      setEstado('');
      setReferencia('');
      setPrincipal(allEnderecos.length === 0);
      setPinPosition(DEFAULT_CENTER);
      setMapCenter(DEFAULT_CENTER);
      setMapZoom(12);
    }
  }, [open, editingEndereco, allEnderecos.length]);

  const handleLookupCep = useCallback(async (rawCep: string) => {
    const digits = normalizeCepDigits(rawCep);
    if (digits.length !== 8) {
      setError('Informe os 8 dígitos do CEP para buscar.');
      return;
    }

    setError('');
    setInfoMsg('');
    setLoadingCep(true);
    try {
      const res = await lookupCep(digits);
      if (res.logradouro) setLogradouro(res.logradouro);
      if (res.bairro) setBairro(res.bairro);
      if (res.cidade) setCidade(res.cidade);
      if (res.estado) setEstado(res.estado);
      if (res.complemento && !complemento) setComplemento(res.complemento);

      if (typeof res.latitude === 'number' && typeof res.longitude === 'number') {
        const pos = { lat: res.latitude, lng: res.longitude };
        setPinPosition(pos);
        setMapCenter(pos);
        setMapZoom(17);
        setInfoMsg(
          'Rua preenchida pelo CEP e marcada no mapa. Toque no mapa se quiser ajustar o ponto exato.'
        );
      } else {
        setInfoMsg('Rua preenchida pelo CEP. Toque no mapa para marcar o ponto exato.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar CEP.');
    } finally {
      setLoadingCep(false);
    }
  }, [complemento]);

  const handleCepChange = (value: string) => {
    const formatted = formatCep(value);
    setCep(formatted);
    const digits = normalizeCepDigits(formatted);
    if (digits.length === 8 && digits !== lastAutoCepRef.current) {
      lastAutoCepRef.current = digits;
      void handleLookupCep(digits);
    }
  };

  const applyReversePoint = useCallback(async (lat: number, lng: number) => {
    setPinPosition({ lat, lng });
    setMapCenter({ lat, lng });
    setError('');
    setInfoMsg('');
    setLoadingReverse(true);
    try {
      const geo = await reverseGeocodePoint(lat, lng);
      if (geo.logradouro) setLogradouro(geo.logradouro);
      if (geo.numero && !semNumero) setNumero(geo.numero);
      if (geo.bairro) setBairro(geo.bairro);
      if (geo.cidade) setCidade(geo.cidade);
      if (geo.estado) setEstado(geo.estado);
      if (geo.cep) {
        lastAutoCepRef.current = geo.cep;
        setCep(formatCep(geo.cep));
      }
      setInfoMsg('Endereço atualizado a partir do ponto tocado no mapa.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ponto selecionado no mapa, mas não foi possível ler o nome da rua.'
      );
    } finally {
      setLoadingReverse(false);
    }
  }, [semNumero]);

  const handleMapClick = useCallback(
    (ev: MapMouseEvent) => {
      const latLng = ev.detail?.latLng;
      if (!latLng) return;
      void applyReversePoint(latLng.lat, latLng.lng);
    },
    [applyReversePoint]
  );

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setError('Geolocalização não disponível neste dispositivo.');
      return;
    }
    setError('');
    setInfoMsg('');
    setLoadingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoadingGps(false);
        setMapZoom(17);
        void applyReversePoint(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLoadingGps(false);
        setError(
          'Não foi possível obter sua localização atual. Você pode tocar diretamente no mapa ou digitar o CEP.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCenterFromAddress = async () => {
    const queryParts = [
      logradouro.trim(),
      numero.trim() && numero.trim() !== 'S/N' ? numero.trim() : '',
      bairro.trim(),
      cidade.trim(),
      estado.trim(),
      cep.trim(),
    ].filter(Boolean);

    if (queryParts.length < 2) {
      setError('Informe ao menos rua e cidade ou bairro para localizar no mapa.');
      return;
    }

    setError('');
    setInfoMsg('');
    setLoadingForward(true);
    try {
      const geo = await forwardGeocodeAddress(queryParts.join(', '));
      if (typeof geo.latitude === 'number' && typeof geo.longitude === 'number') {
        const pos = { lat: geo.latitude, lng: geo.longitude };
        setPinPosition(pos);
        setMapCenter(pos);
        setMapZoom(17);
        if (!cep && geo.cep) {
          lastAutoCepRef.current = geo.cep;
          setCep(formatCep(geo.cep));
        }
        setInfoMsg('Mapa centralizado no endereço. Toque no mapa para ajustar o pino.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Endereço não encontrado no mapa.');
    } finally {
      setLoadingForward(false);
    }
  };

  const handleCameraChange = useCallback((ev: MapCameraChangedEvent) => {
    if (ev.detail?.center) {
      setMapCenter(ev.detail.center);
    }
    if (typeof ev.detail?.zoom === 'number') {
      setMapZoom(ev.detail.zoom);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const apelidoFinal =
      apelidoPreset === 'Outro' ? apelidoCustom.trim() : apelidoPreset;
    const numeroFinal = semNumero ? 'S/N' : numero.trim();

    setSaving(true);
    try {
      const regiaoResult = await findOrCreateRegiao(
        uid,
        { bairro, cidade, estado },
        regioes
      );
      if (regiaoResult.created) {
        onRegiaoCreated(regiaoResult.regiao);
      }

      const savedId = await saveUserEndereco(
        uid,
        {
          apelido: apelidoFinal,
          cep: normalizeCepDigits(cep),
          logradouro,
          numero: numeroFinal,
          complemento,
          bairro,
          cidade,
          estado,
          referencia,
          latitude: pinPosition.lat,
          longitude: pinPosition.lng,
          principal,
        },
        editingEndereco?.id,
        allEnderecos
      );

      onSaved(savedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar endereço.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="address-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] bg-white rounded-t-2xl sm:rounded-2xl border border-zinc-200 flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between gap-3 bg-white shrink-0">
          <div>
            <h2 id="address-modal-title" className="text-base font-bold text-zinc-950">
              {editingEndereco ? 'Editar endereço' : 'Novo endereço'}
            </h2>
            <p className="text-xs text-zinc-500">
              Consulte pelo CEP ou toque diretamente no mapa para salvar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="h-11 w-11 rounded-xl border border-zinc-200 flex items-center justify-center text-zinc-700 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          id="address-modal-form"
          onSubmit={(e) => void handleSubmit(e)}
          className="flex-1 overflow-y-auto p-5 space-y-5"
        >
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm text-red-800"
            >
              {error}
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-700"
            >
              {infoMsg}
            </div>
          )}

          {/* CEP Lookup row */}
          <div className="space-y-1.5">
            <label htmlFor="end-cep" className="block text-sm font-medium text-zinc-900">
              CEP (busca automática da rua e bairro)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="end-cep"
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                className="flex-1 min-h-[48px] rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-mono tabular-nums text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
              <button
                type="button"
                disabled={loadingCep || normalizeCepDigits(cep).length !== 8}
                onClick={() => void handleLookupCep(cep)}
                className="min-h-[48px] inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition whitespace-nowrap"
              >
                {loadingCep ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span>{loadingCep ? 'Buscando...' : 'Buscar CEP'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Tap-to-Pick Google Map */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-900">
                Toque no mapa para marcar o local exato
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingForward}
                  onClick={() => void handleCenterFromAddress()}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{loadingForward ? 'Buscando...' : 'Localizar rua'}</span>
                </button>
                <button
                  type="button"
                  disabled={loadingGps}
                  onClick={handleUseGps}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  <span>{loadingGps ? 'Localizando...' : 'Usar meu GPS'}</span>
                </button>
              </div>
            </div>

            {hasMapsProvider ? (
              <InteractiveAddressMap
                mapCenter={mapCenter}
                mapZoom={mapZoom}
                pinPosition={pinPosition}
                loadingReverse={loadingReverse}
                onCameraChanged={handleCameraChange}
                onClick={handleMapClick}
              />
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
                Mapa interativo indisponível sem chave configurada. Use a busca por CEP acima.
              </div>
            )}

            <p className="text-[11px] font-mono tabular-nums text-zinc-500">
              Ponto marcado: {pinPosition.lat.toFixed(6)}, {pinPosition.lng.toFixed(6)}
            </p>
          </div>

          {/* Street & Number */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8 space-y-1.5">
              <label htmlFor="end-rua" className="block text-xs font-medium text-zinc-900">
                Rua / Avenida
              </label>
              <input
                id="end-rua"
                type="text"
                required
                minLength={BLUEPRINT_LIMITS.ENDERECO_LOGRADOURO_MIN}
                maxLength={BLUEPRINT_LIMITS.ENDERECO_LOGRADOURO_MAX}
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
                placeholder="Ex.: Rua das Flores"
                className="w-full min-h-[46px] rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <div className="sm:col-span-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="end-numero" className="block text-xs font-medium text-zinc-900">
                  Número
                </label>
                <label className="inline-flex items-center gap-1 text-[11px] text-zinc-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={semNumero}
                    onChange={(e) => {
                      setSemNumero(e.target.checked);
                      if (e.target.checked) setNumero('S/N');
                      else setNumero('');
                    }}
                    className="rounded border-zinc-300"
                  />
                  <span>Sem nº</span>
                </label>
              </div>
              <input
                id="end-numero"
                type="text"
                disabled={semNumero}
                maxLength={BLUEPRINT_LIMITS.ENDERECO_NUMERO_MAX}
                value={semNumero ? 'S/N' : numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="120"
                className="w-full min-h-[46px] rounded-xl border border-zinc-300 bg-white px-3.5 text-sm font-mono tabular-nums text-zinc-950 disabled:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>
          </div>

          {/* Neighborhood, City, State */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5 space-y-1.5">
              <label htmlFor="end-bairro" className="block text-xs font-medium text-zinc-900">
                Bairro
              </label>
              <input
                id="end-bairro"
                type="text"
                required
                minLength={BLUEPRINT_LIMITS.REGIAO_BAIRRO_MIN}
                maxLength={BLUEPRINT_LIMITS.REGIAO_BAIRRO_MAX}
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Ex.: Centro"
                className="w-full min-h-[46px] rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <div className="sm:col-span-5 space-y-1.5">
              <label htmlFor="end-cidade" className="block text-xs font-medium text-zinc-900">
                Cidade
              </label>
              <input
                id="end-cidade"
                type="text"
                required
                minLength={BLUEPRINT_LIMITS.REGIAO_CIDADE_MIN}
                maxLength={BLUEPRINT_LIMITS.REGIAO_CIDADE_MAX}
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex.: São Paulo"
                className="w-full min-h-[46px] rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="end-uf" className="block text-xs font-medium text-zinc-900">
                UF
              </label>
              <input
                id="end-uf"
                type="text"
                required
                maxLength={2}
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase())}
                placeholder="SP"
                className="w-full min-h-[46px] rounded-xl border border-zinc-300 bg-white px-3 text-sm font-mono uppercase text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>
          </div>

          {/* Complement & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="end-comp" className="block text-xs font-medium text-zinc-900">
                Complemento (opcional)
              </label>
              <input
                id="end-comp"
                type="text"
                maxLength={BLUEPRINT_LIMITS.ENDERECO_COMPLEMENTO_MAX}
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                placeholder="Apto, bloco, fundos..."
                className="w-full min-h-[46px] rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="end-ref" className="block text-xs font-medium text-zinc-900">
                Ponto de referência (opcional)
              </label>
              <input
                id="end-ref"
                type="text"
                maxLength={BLUEPRINT_LIMITS.ENDERECO_REFERENCIA_MAX}
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Próximo à escola, esquina..."
                className="w-full min-h-[46px] rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>
          </div>

          {/* iFood/ML style Label Selector */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-zinc-900">
              Salvar como (apelido do endereço)
            </span>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_LABELS.map((preset) => {
                const active = apelidoPreset === preset;
                const Icon =
                  preset === 'Casa'
                    ? Home
                    : preset === 'Trabalho'
                    ? Briefcase
                    : MapPin;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setApelidoPreset(preset)}
                    className={`min-h-[44px] flex items-center justify-center gap-2 rounded-xl border px-3 text-xs font-medium transition ${
                      active
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{preset}</span>
                  </button>
                );
              })}
            </div>

            {apelidoPreset === 'Outro' && (
              <input
                type="text"
                required
                minLength={BLUEPRINT_LIMITS.ENDERECO_APELIDO_MIN}
                maxLength={BLUEPRINT_LIMITS.ENDERECO_APELIDO_MAX}
                value={apelidoCustom}
                onChange={(e) => setApelidoCustom(e.target.value)}
                placeholder="Ex.: Casa da minha mãe, Rua da escola"
                className="w-full min-h-[46px] rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            )}
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={principal}
              onChange={(e) => setPrincipal(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-950"
            />
            <span className="text-sm text-zinc-800">
              Definir como meu endereço principal
            </span>
          </label>
        </form>

        <div className="px-5 py-4 border-t border-zinc-200 bg-white flex items-center justify-end gap-3 shrink-0 pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="address-modal-form"
            disabled={saving}
            className="min-h-[48px] rounded-xl bg-zinc-950 px-6 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 transition"
          >
            {saving ? 'Salvando...' : 'Salvar endereço'}
          </button>
        </div>
      </div>
    </div>
  );
};
