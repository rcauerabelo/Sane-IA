import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Camera,
  ChevronRight,
  Home,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { AddressFormModal } from '../components/AddressFormModal';
import { AddressSelectorModal } from '../components/AddressSelectorModal';
import { BLUEPRINT_LIMITS } from '../lib/blueprint';
import { ProcessedImage, processImageFile } from '../lib/imageUtils';
import { formatCep, lookupCep, normalizeCepDigits } from '../lib/locationApi';
import {
  createChamadoWithPhotos,
  createRegiao,
  EnderecoDoc,
  findOrCreateRegiao,
  RegiaoDoc,
  TipoProblemaDoc,
  UsuarioProfile,
} from '../lib/saneiaApi';

interface NewTicketViewProps {
  usuario: UsuarioProfile;
  tipos: TipoProblemaDoc[];
  regioes: RegiaoDoc[];
  enderecos: EnderecoDoc[];
  hasMapsProvider: boolean;
  onRegiaoCreated: (regiao: RegiaoDoc) => void;
  onCreated: (chamadoId: string) => void;
}

export const NewTicketView: React.FC<NewTicketViewProps> = ({
  usuario,
  tipos,
  regioes,
  enderecos,
  hasMapsProvider,
  onRegiaoCreated,
  onCreated,
}) => {
  const [titulo, setTitulo] = useState('');
  const [tipoId, setTipoId] = useState(tipos[0]?.id || '');

  const [selectedEnderecoId, setSelectedEnderecoId] = useState<string | null>(null);
  const [useManualRegion, setUseManualRegion] = useState(false);

  const [regiaoId, setRegiaoId] = useState(
    usuario.regiaoPadraoId || regioes[0]?.id || ''
  );
  const [descricao, setDescricao] = useState('');
  const [fotos, setFotos] = useState<ProcessedImage[]>([]);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  const [showNovaRegiao, setShowNovaRegiao] = useState(false);
  const [cepRegiao, setCepRegiao] = useState('');
  const [loadingCepRegiao, setLoadingCepRegiao] = useState(false);
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [savingRegiao, setSavingRegiao] = useState(false);

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingEndereco, setEditingEndereco] = useState<EnderecoDoc | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-select principal or first saved address whenever saved addresses update
  useEffect(() => {
    if (enderecos.length === 0) {
      setSelectedEnderecoId(null);
      return;
    }
    if (selectedEnderecoId && enderecos.some((e) => e.id === selectedEnderecoId)) {
      return;
    }
    const principal = enderecos.find((e) => e.principal) || enderecos[0];
    setSelectedEnderecoId(principal.id);
    setUseManualRegion(false);
  }, [enderecos, selectedEnderecoId]);

  const selectedEndereco =
    !useManualRegion && selectedEnderecoId
      ? enderecos.find((e) => e.id === selectedEnderecoId) || null
      : null;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError('');
    setProcessingPhoto(true);
    try {
      const remainingSlots = Math.max(0, 4 - fotos.length);
      const selected = Array.from(files).slice(0, remainingSlots);
      const processed: ProcessedImage[] = [];
      for (const file of selected) {
        processed.push(await processImageFile(file));
      }
      setFotos((prev) => [...prev, ...processed]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar foto.');
    } finally {
      setProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const handleLookupCepRegiao = async () => {
    const digits = normalizeCepDigits(cepRegiao);
    if (digits.length !== 8) {
      setError('Informe um CEP com 8 dígitos para preencher o bairro.');
      return;
    }
    setError('');
    setLoadingCepRegiao(true);
    try {
      const res = await lookupCep(digits);
      if (res.bairro) setBairro(res.bairro);
      if (res.cidade) setCidade(res.cidade);
      if (res.estado) setEstado(res.estado);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao consultar CEP.');
    } finally {
      setLoadingCepRegiao(false);
    }
  };

  const handleSaveNovaRegiao = async () => {
    setError('');
    setSavingRegiao(true);
    try {
      const nova = await createRegiao(usuario.uid, { bairro, cidade, estado });
      onRegiaoCreated(nova);
      setRegiaoId(nova.id);
      setCepRegiao('');
      setBairro('');
      setCidade('');
      setEstado('');
      setShowNovaRegiao(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar região.');
    } finally {
      setSavingRegiao(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const tipo = tipos.find((t) => t.id === (tipoId || tipos[0]?.id));
    if (!tipo) {
      setError('Selecione o tipo de problema.');
      return;
    }

    setSubmitting(true);
    try {
      let regiao: RegiaoDoc | undefined;

      if (selectedEndereco) {
        const resolved = await findOrCreateRegiao(
          usuario.uid,
          {
            bairro: selectedEndereco.bairro,
            cidade: selectedEndereco.cidade,
            estado: selectedEndereco.estado,
          },
          regioes
        );
        if (resolved.created) {
          onRegiaoCreated(resolved.regiao);
        }
        regiao = resolved.regiao;
      } else {
        regiao = regioes.find((r) => r.id === (regiaoId || regioes[0]?.id));
      }

      if (!regiao) {
        setError('Selecione um endereço salvo ou uma região.');
        setSubmitting(false);
        return;
      }

      const chamadoId = await createChamadoWithPhotos({
        usuario,
        titulo,
        descricao,
        regiao,
        tipo,
        fotos,
        endereco: selectedEndereco,
      });
      onCreated(chamadoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o chamado.');
      setSubmitting(false);
    }
  };

  const SelectedIcon =
    selectedEndereco?.apelido.toLowerCase() === 'casa'
      ? Home
      : selectedEndereco?.apelido.toLowerCase() === 'trabalho'
      ? Briefcase
      : MapPin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Abrir chamado</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Escolha um endereço salvo ou marque no mapa onde o problema acontece e anexe uma foto.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          {/* iFood / Mercado Livre style Location & Saved Addresses Card */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="block text-sm font-medium text-zinc-900">
                Local do problema (Meus endereços)
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingEndereco(null);
                  setFormModalOpen(true);
                }}
                className="min-h-[36px] inline-flex items-center gap-1 text-xs font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Novo endereço</span>
              </button>
            </div>

            {selectedEndereco ? (
              <div className="rounded-xl border border-zinc-950/15 bg-zinc-50 p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setSelectorOpen(true)}
                  className="w-full text-left flex items-start gap-3 group"
                >
                  <div className="h-10 w-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center shrink-0">
                    <SelectedIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-950">
                        {selectedEndereco.apelido}
                      </span>
                      {selectedEndereco.principal && (
                        <span className="text-[11px] font-medium text-zinc-600">
                          · Principal
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-800 truncate">
                      {selectedEndereco.logradouro}
                      {selectedEndereco.numero ? `, ${selectedEndereco.numero}` : ', s/n'}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {selectedEndereco.bairro}, {selectedEndereco.cidade} - {selectedEndereco.estado}
                      {selectedEndereco.cep ? ` · CEP ${formatCep(selectedEndereco.cep)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-zinc-950 shrink-0 self-center">
                    <span>Trocar</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>

                <div className="pt-2 border-t border-zinc-200/80 flex items-center justify-between text-[11px] text-zinc-500">
                  <span className="font-mono tabular-nums">
                    Mapa: {selectedEndereco.latitude.toFixed(5)}, {selectedEndereco.longitude.toFixed(5)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUseManualRegion(true)}
                    className="underline hover:text-zinc-900"
                  >
                    Informar apenas bairro
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingEndereco(null);
                    setFormModalOpen(true);
                  }}
                  className="w-full min-h-[54px] rounded-xl border border-zinc-950 bg-zinc-950 text-white px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium hover:bg-zinc-800 transition"
                >
                  <MapPin className="h-4 w-4" />
                  <span>Buscar CEP e marcar ponto no mapa</span>
                </button>

                {enderecos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setUseManualRegion(false);
                      setSelectorOpen(true);
                    }}
                    className="w-full min-h-[44px] rounded-xl border border-zinc-300 bg-white px-4 text-xs font-medium text-zinc-900 hover:bg-zinc-50"
                  >
                    Escolher entre meus endereços salvos ({enderecos.length})
                  </button>
                )}

                {/* Fallback / quick bairro selection with CEP */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="chamado-regiao" className="block text-xs font-medium text-zinc-700">
                      Ou selecione apenas a região / bairro
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNovaRegiao((v) => !v)}
                      className="min-h-[32px] inline-flex items-center gap-1 text-xs font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700"
                    >
                      <span>{showNovaRegiao ? 'Fechar' : 'Nova região por CEP'}</span>
                    </button>
                  </div>

                  <select
                    id="chamado-regiao"
                    value={regiaoId || regioes[0]?.id || ''}
                    onChange={(e) => setRegiaoId(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
                  >
                    {regioes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.bairro}, {r.cidade} - {r.estado}
                      </option>
                    ))}
                  </select>

                  {showNovaRegiao && (
                    <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                      <p className="text-xs font-semibold text-zinc-900">
                        Adicionar nova região (com busca por CEP)
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={9}
                          placeholder="CEP (00000-000)"
                          value={cepRegiao}
                          onChange={(e) => setCepRegiao(formatCep(e.target.value))}
                          className="flex-1 min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 text-sm font-mono tabular-nums"
                        />
                        <button
                          type="button"
                          disabled={loadingCepRegiao}
                          onClick={() => void handleLookupCepRegiao()}
                          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 hover:bg-zinc-100"
                        >
                          {loadingCepRegiao ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Search className="h-3.5 w-3.5" />
                          )}
                          <span>Buscar</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                        <input
                          type="text"
                          placeholder="Bairro"
                          maxLength={BLUEPRINT_LIMITS.REGIAO_BAIRRO_MAX}
                          value={bairro}
                          onChange={(e) => setBairro(e.target.value)}
                          className="sm:col-span-3 min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Cidade"
                          maxLength={BLUEPRINT_LIMITS.REGIAO_CIDADE_MAX}
                          value={cidade}
                          onChange={(e) => setCidade(e.target.value)}
                          className="sm:col-span-2 min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="UF"
                          maxLength={2}
                          value={estado}
                          onChange={(e) => setEstado(e.target.value.toUpperCase())}
                          className="sm:col-span-1 min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 text-sm font-mono uppercase"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={savingRegiao}
                        onClick={() => void handleSaveNovaRegiao()}
                        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{savingRegiao ? 'Salvando...' : 'Salvar região'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="chamado-titulo" className="block text-sm font-medium text-zinc-900">
              Título do chamado
            </label>
            <input
              id="chamado-titulo"
              type="text"
              required
              minLength={BLUEPRINT_LIMITS.CHAMADO_TITULO_MIN}
              maxLength={BLUEPRINT_LIMITS.CHAMADO_TITULO_MAX}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Esgoto vazando na rua principal"
              className="w-full min-h-[48px] rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="chamado-tipo" className="block text-sm font-medium text-zinc-900">
              Tipo de problema
            </label>
            <select
              id="chamado-tipo"
              value={tipoId || tipos[0]?.id || ''}
              onChange={(e) => setTipoId(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
            >
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="chamado-desc" className="block text-sm font-medium text-zinc-900">
              Descrição detalhada
            </label>
            <textarea
              id="chamado-desc"
              rows={4}
              maxLength={BLUEPRINT_LIMITS.CHAMADO_DESCRICAO_MAX}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Informe há quanto tempo ocorre, se atinge residências ou crianças e pontos de referência."
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>
        </div>

        {/* Photo attachment section */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-zinc-950">Fotos do chamado</h2>
              <p className="mt-0.5 text-xs text-zinc-600">
                Tire uma foto agora ou escolha da galeria (até 4 fotos, máx. 5 MB cada).
              </p>
            </div>

            {fotos.length < 4 && (
              <label className="min-h-[120px] rounded-xl border border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 transition cursor-pointer flex flex-col items-center justify-center gap-2 p-4 text-center">
                <Camera className="h-6 w-6 text-zinc-900" />
                <span className="text-sm font-medium text-zinc-950">
                  {processingPhoto ? 'Processando foto...' : 'Tirar foto ou selecionar arquivo'}
                </span>
                <span className="text-xs text-zinc-500">JPG, PNG ou WebP</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={processingPhoto}
                  onChange={(e) => void handlePhotoChange(e)}
                  className="sr-only"
                />
              </label>
            )}

            {fotos.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {fotos.map((foto, idx) => (
                  <div
                    key={`${foto.nomeArquivo}-${idx}`}
                    className="relative rounded-xl border border-zinc-200 overflow-hidden bg-zinc-100 aspect-[4/3]"
                  >
                    <img
                      src={foto.imagemDataUrl}
                      alt={foto.nomeArquivo}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFotos((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`Remover ${foto.nomeArquivo}`}
                      className="absolute top-1.5 right-1.5 h-9 w-9 rounded-lg bg-zinc-950/85 text-white flex items-center justify-center hover:bg-zinc-950"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || processingPhoto}
            className="w-full min-h-[48px] rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-60 transition"
          >
            {submitting ? 'Registrando chamado...' : 'Enviar chamado'}
          </button>
        </div>
      </form>

      <AddressSelectorModal
        open={selectorOpen}
        uid={usuario.uid}
        enderecos={enderecos}
        selectedId={selectedEndereco?.id || null}
        onSelect={(item) => {
          setSelectedEnderecoId(item.id);
          setUseManualRegion(false);
        }}
        onAddNew={() => {
          setEditingEndereco(null);
          setFormModalOpen(true);
        }}
        onEdit={(item) => {
          setEditingEndereco(item);
          setFormModalOpen(true);
        }}
        onClose={() => setSelectorOpen(false)}
      />

      <AddressFormModal
        open={formModalOpen}
        uid={usuario.uid}
        editingEndereco={editingEndereco}
        allEnderecos={enderecos}
        regioes={regioes}
        hasMapsProvider={hasMapsProvider}
        onRegiaoCreated={onRegiaoCreated}
        onSaved={(savedId) => {
          setSelectedEnderecoId(savedId);
          setUseManualRegion(false);
          setFormModalOpen(false);
          setEditingEndereco(null);
        }}
        onClose={() => {
          setFormModalOpen(false);
          setEditingEndereco(null);
        }}
      />
    </div>
  );
};
