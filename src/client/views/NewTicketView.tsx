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
  Sparkles,
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
  OrgaoResponsavelDoc,
  RegiaoDoc,
  runChamadoAIAnalysis,
  suggestChamadoFromPhotoAndDescription,
  TipoProblemaDoc,
  UsuarioProfile,
} from '../lib/saneiaApi';

interface NewTicketViewProps {
  usuario: UsuarioProfile;
  tipos: TipoProblemaDoc[];
  regioes: RegiaoDoc[];
  orgaos: OrgaoResponsavelDoc[];
  enderecos: EnderecoDoc[];
  hasMapsProvider: boolean;
  onRegiaoCreated: (regiao: RegiaoDoc) => void;
  onCreated: (chamadoId: string, aiError?: string) => void;
}

export const NewTicketView: React.FC<NewTicketViewProps> = ({
  usuario,
  tipos,
  regioes,
  orgaos,
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
  const [suggesting, setSuggesting] = useState(false);

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

  const [submitStage, setSubmitStage] = useState<'idle' | 'saving' | 'analyzing'>('idle');
  const [error, setError] = useState('');
  const submitting = submitStage !== 'idle';

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

  const handleSuggestWithAI = async () => {
    if (fotos.length === 0 && descricao.trim().length < 3) {
      setError('Anexe ao menos uma foto ou descreva o problema para a IA preencher.');
      return;
    }
    setError('');
    setSuggesting(true);
    try {
      const sugestao = await suggestChamadoFromPhotoAndDescription({
        descricao,
        fotos,
        tipos,
      });
      if (sugestao.titulo) {
        setTitulo(sugestao.titulo.slice(0, BLUEPRINT_LIMITS.CHAMADO_TITULO_MAX));
      }
      if (sugestao.tipoId && tipos.some((t) => t.id === sugestao.tipoId)) {
        setTipoId(sugestao.tipoId);
      }
      if (!descricao.trim() && sugestao.descricaoSugerida) {
        setDescricao(sugestao.descricaoSugerida.slice(0, BLUEPRINT_LIMITS.CHAMADO_DESCRICAO_MAX));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível sugerir com a IA.');
    } finally {
      setSuggesting(false);
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

    if (fotos.length === 0 && descricao.trim().length < 3 && titulo.trim().length < 3) {
      setError('Anexe uma foto ou escreva uma descrição do problema para abrir a ocorrência.');
      return;
    }

    let resolvedTipo = tipos.find((t) => t.id === (tipoId || tipos[0]?.id));
    if (!resolvedTipo) {
      setError('Selecione o tipo de problema.');
      return;
    }

    setSubmitStage('saving');
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
        setSubmitStage('idle');
        return;
      }

      let finalTitulo = titulo.trim();
      let finalDescricao = descricao.trim();

      // If user went straight with photo + description without typing a title, ask AI to title/categorize first
      if (finalTitulo.length < BLUEPRINT_LIMITS.CHAMADO_TITULO_MIN) {
        try {
          const auto = await suggestChamadoFromPhotoAndDescription({
            descricao: finalDescricao,
            fotos,
            tipos,
          });
          if (auto.titulo && auto.titulo.trim().length >= BLUEPRINT_LIMITS.CHAMADO_TITULO_MIN) {
            finalTitulo = auto.titulo.trim();
          }
          if (auto.tipoId) {
            const matched = tipos.find((t) => t.id === auto.tipoId);
            if (matched) resolvedTipo = matched;
          }
          if (!finalDescricao && auto.descricaoSugerida) {
            finalDescricao = auto.descricaoSugerida;
          }
        } catch {
          // Fallback safely if quick pre-fill fails; main AI analysis step below handles recovery
        }

        if (finalTitulo.length < BLUEPRINT_LIMITS.CHAMADO_TITULO_MIN) {
          finalTitulo =
            finalDescricao.split(/[.!?\n]/)[0]?.trim().slice(0, 80) ||
            `${resolvedTipo.nome} em ${regiao.bairro}`;
        }
      }

      const createdChamado = await createChamadoWithPhotos({
        usuario,
        titulo: finalTitulo,
        descricao: finalDescricao,
        regiao,
        tipo: resolvedTipo,
        fotos,
        endereco: selectedEndereco,
      });

      setSubmitStage('analyzing');
      let aiErrorMessage = '';
      try {
        await runChamadoAIAnalysis(createdChamado, orgaos, fotos);
      } catch (aiErr) {
        aiErrorMessage =
          aiErr instanceof Error
            ? aiErr.message
            : 'O chamado foi salvo, mas não foi possível concluir a análise da IA agora.';
      }

      onCreated(createdChamado.id, aiErrorMessage || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o chamado.');
      setSubmitStage('idle');
    }
  };

  const SelectedIcon =
    selectedEndereco?.apelido.toLowerCase() === 'casa'
      ? Home
      : selectedEndereco?.apelido.toLowerCase() === 'trabalho'
      ? Briefcase
      : MapPin;

  const canSuggest = !suggesting && !submitting && (fotos.length > 0 || descricao.trim().length >= 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950 [text-wrap:balance]">
          Nova ocorrência com análise por IA
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Envie uma foto e descreva o que está acontecendo. A IA analisa a imagem e o relato para classificar a urgência, indicar o órgão e montar o plano de resolução.
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

      <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Primary Column: Photo + Description for AI */}
        <div className="lg:col-span-7 space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-bold text-zinc-950">
                1. Fotos do problema
              </h2>
              <p className="mt-0.5 text-xs text-zinc-600">
                A IA analisa visualmente a imagem enviada junto com sua descrição (até 4 fotos).
              </p>
            </div>

            {fotos.length < 4 && (
              <label className="min-h-[124px] rounded-xl border border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 transition cursor-pointer flex flex-col items-center justify-center gap-2 p-4 text-center">
                <Camera className="h-6 w-6 text-zinc-900" />
                <span className="text-sm font-medium text-zinc-950">
                  {processingPhoto ? 'Processando foto...' : 'Tirar foto ou escolher da galeria'}
                </span>
                <span className="text-xs text-zinc-500">JPG, PNG ou WebP (máx. 5 MB por imagem)</span>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                      className="absolute top-1.5 right-1.5 h-8 w-8 rounded-lg bg-zinc-950/85 text-white flex items-center justify-center hover:bg-zinc-950"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-4 border-t border-zinc-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="chamado-desc" className="block text-sm font-bold text-zinc-950">
                2. Descrição do que está acontecendo
              </label>
              <button
                type="button"
                disabled={!canSuggest}
                onClick={() => void handleSuggestWithAI()}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-zinc-50 disabled:opacity-50 transition whitespace-nowrap"
              >
                {suggesting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>{suggesting ? 'Analisando...' : 'Preencher título e tipo com IA'}</span>
              </button>
            </div>
            <textarea
              id="chamado-desc"
              rows={4}
              maxLength={BLUEPRINT_LIMITS.CHAMADO_DESCRICAO_MAX}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Cano estourado na calçada jorrando água limpa desde ontem à noite, alagando a entrada das casas."
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="chamado-titulo" className="block text-sm font-medium text-zinc-900">
                Título (opcional — a IA completa se vazio)
              </label>
              <input
                id="chamado-titulo"
                type="text"
                maxLength={BLUEPRINT_LIMITS.CHAMADO_TITULO_MAX}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Vazamento de água na calçada"
                className="w-full min-h-[48px] rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="chamado-tipo" className="block text-sm font-medium text-zinc-900">
                Categoria do problema
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
          </div>
        </div>

        {/* Secondary Column: Location + Submit */}
        <div className="lg:col-span-5 space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="block text-base font-bold text-zinc-950">
                3. Local da ocorrência
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingEndereco(null);
                  setFormModalOpen(true);
                }}
                className="min-h-[36px] inline-flex items-center gap-1 text-xs font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Novo endereço</span>
              </button>
            </div>

            {selectedEndereco ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
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

                <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-[11px] text-zinc-500">
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
                  className="w-full min-h-[48px] rounded-xl border border-zinc-300 bg-white text-zinc-950 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium hover:bg-zinc-50 transition"
                >
                  <MapPin className="h-4 w-4" />
                  <span>Buscar CEP e marcar no mapa</span>
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

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="chamado-regiao" className="block text-xs font-medium text-zinc-700">
                      Ou selecione a região / bairro
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

          <div className="pt-4 border-t border-zinc-200 space-y-3">
            <p className="text-xs text-zinc-600 leading-relaxed">
              Ao enviar, o chamado é registrado e a IA gera imediatamente o diagnóstico com base na foto e na descrição, indicando urgência, passos de solução e protocolo.
            </p>
            <button
              type="submit"
              disabled={submitting || processingPhoto || suggesting}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-60 transition whitespace-nowrap"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>
                {submitStage === 'saving'
                  ? 'Registrando ocorrência...'
                  : submitStage === 'analyzing'
                  ? 'Analisando foto e descrição com IA...'
                  : 'Registrar e analisar com IA'}
              </span>
            </button>
          </div>
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
