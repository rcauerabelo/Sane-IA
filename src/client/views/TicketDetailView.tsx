import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  Copy,
  Loader2,
  MapPin,
  Phone,
  Sparkles,
  X,
} from 'lucide-react';
import { StatusLabel, UrgenciaLabel } from '../components/StatusIndicator';
import { TicketMapPreview } from '../components/TicketMapPreview';
import { STATUS_LABELS, StatusChamado } from '../lib/blueprint';
import { processImageFile } from '../lib/imageUtils';
import {
  AnaliseIADoc,
  attachFotoToChamado,
  ChamadoDoc,
  FotoDoc,
  OrgaoResponsavelDoc,
  runChamadoAIAnalysis,
  subscribeChamadoDetail,
  updateChamadoStatus,
} from '../lib/saneiaApi';

interface TicketDetailViewProps {
  chamadoId: string;
  orgaos: OrgaoResponsavelDoc[];
  hasMapsProvider: boolean;
  initialAiError?: string;
  onBack: () => void;
}

const NEXT_STATUSES: Array<{ value: Exclude<StatusChamado, 'ABERTO'>; label: string }> = [
  { value: 'EM_ANALISE', label: 'Em análise' },
  { value: 'ENCAMINHADO', label: 'Encaminhado' },
  { value: 'RESOLVIDO', label: 'Resolvido' },
];

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({
  chamadoId,
  orgaos,
  hasMapsProvider,
  initialAiError = '',
  onBack,
}) => {
  const [chamado, setChamado] = useState<ChamadoDoc | null>(null);
  const [fotos, setFotos] = useState<FotoDoc[]>([]);
  const [analise, setAnalise] = useState<AnaliseIADoc | null>(null);
  const [loading, setLoading] = useState(true);

  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copiedProtocol, setCopiedProtocol] = useState(false);
  const [error, setError] = useState(initialAiError);
  const [zoomFoto, setZoomFoto] = useState<FotoDoc | null>(null);

  useEffect(() => {
    setError(initialAiError);
  }, [initialAiError, chamadoId]);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeChamadoDetail(
      chamadoId,
      (docData) => {
        setChamado(docData);
        setLoading(false);
      },
      (fotosList) => setFotos(fotosList),
      (analiseData) => setAnalise(analiseData),
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [chamadoId]);

  const handleAttachPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chamado) return;
    setError('');
    setUploadingFoto(true);
    try {
      const processed = await processImageFile(file);
      await attachFotoToChamado(chamado.id, chamado.usuarioId, processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao anexar foto.');
    } finally {
      setUploadingFoto(false);
      e.target.value = '';
    }
  };

  const handleRunAI = async () => {
    if (!chamado) return;
    setError('');
    setAnalyzing(true);
    try {
      await runChamadoAIAnalysis(chamado, orgaos, fotos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao solicitar análise da IA.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStatusChange = async (next: Exclude<StatusChamado, 'ABERTO'>) => {
    if (!chamado || chamado.status === 'RESOLVIDO') return;
    setError('');
    setUpdatingStatus(true);
    try {
      await updateChamadoStatus(chamado.id, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCopyProtocol = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedProtocol(true);
      window.setTimeout(() => setCopiedProtocol(false), 2000);
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o texto do protocolo manualmente.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-36 rounded-xl bg-zinc-200" />
        <div className="h-64 rounded-2xl bg-zinc-100 border border-zinc-200" />
      </div>
    );
  }

  if (!chamado) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
        <p className="text-sm text-zinc-700">Chamado não encontrado.</p>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </button>
      </div>
    );
  }

  const dataFormatada = chamado.dataAbertura
    ? chamado.dataAbertura.toDate().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Agora';

  const passos =
    analise?.passosResolucao && analise.passosResolucao.length > 0
      ? analise.passosResolucao
      : [];

  const protocoloTexto =
    analise?.modeloProtocolo ||
    (analise
      ? `Solicitação de atendimento — ${analise.orgaoNome || 'Órgão Responsável'}\n` +
        `Ocorrência: ${chamado.titulo} (${chamado.tipoProblemaNome})\n` +
        `Local: ${chamado.enderecoResumo || chamado.regiaoResumo}\n` +
        `Descrição: ${chamado.descricao || 'Solicito vistoria técnica no local.'}`
      : '');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-50 transition whitespace-nowrap"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </button>

        <StatusLabel status={chamado.status} />
      </div>

      {/* Occurrence Title Banner */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>{chamado.tipoProblemaNome}</span>
          <span aria-hidden="true">·</span>
          <span>{chamado.regiaoResumo}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{dataFormatada}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 [text-wrap:balance]">
          {chamado.titulo}
        </h1>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-2"
        >
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Primary Focal Anchor: AI Diagnosis & Resolution Plan */}
        <section
          aria-label="Plano de resolução gerado pela IA"
          className="lg:col-span-7 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-zinc-950 shrink-0" />
                <h2 className="text-lg font-bold text-zinc-950">
                  Plano de resolução da IA
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-zinc-600">
                Diagnóstico por imagem e descrição, órgão indicado, passos práticos e protocolo pronto.
              </p>
            </div>

            {analise?.dataAnalise && (
              <span className="text-xs font-mono tabular-nums text-zinc-500 whitespace-nowrap shrink-0">
                {analise.dataAnalise.toDate().toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>

          {analise ? (
            <div className="space-y-5 pt-4 border-t border-zinc-200">
              {/* Priority & Timeline */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
                <UrgenciaLabel urgencia={analise.urgencia} />
                {analise.prazoEstimado && (
                  <>
                    <span aria-hidden="true" className="text-zinc-300">
                      ·
                    </span>
                    <span className="text-zinc-700 font-medium">
                      Prazo sugerido: {analise.prazoEstimado}
                    </span>
                  </>
                )}
              </div>

              {/* Diagnosis */}
              <div className="space-y-1.5 pt-4 border-t border-zinc-200">
                <h3 className="text-xs font-semibold text-zinc-500">Diagnóstico do problema</h3>
                <p className="text-sm sm:text-[15px] text-zinc-800 leading-relaxed whitespace-pre-wrap">
                  {analise.diagnostico || analise.orientacao}
                </p>
              </div>

              {/* Practical Steps */}
              <div className="space-y-3 pt-4 border-t border-zinc-200">
                <h3 className="text-xs font-semibold text-zinc-500">
                  Como resolver — passos recomendados
                </h3>
                {passos.length > 0 ? (
                  <ol className="space-y-2.5">
                    {passos.map((passo, index) => (
                      <li
                        key={`${index}-${passo.slice(0, 16)}`}
                        className="flex items-start gap-3 text-sm text-zinc-800 leading-relaxed"
                      >
                        <span className="font-mono tabular-nums text-xs font-semibold text-zinc-950 pt-0.5 shrink-0">
                          {String(index + 1).padStart(2, '0')}.
                        </span>
                        <span>{passo}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">
                    {analise.orientacao}
                  </p>
                )}
              </div>

              {/* Responsible Agency */}
              {analise.orgaoNome && (
                <div className="space-y-1.5 pt-4 border-t border-zinc-200">
                  <h3 className="text-xs font-semibold text-zinc-500">
                    Órgão indicado para atendimento
                  </h3>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-950">{analise.orgaoNome}</p>
                    {analise.orgaoContato && (
                      <p className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-mono tabular-nums text-zinc-800">
                        <Phone className="h-3.5 w-3.5 text-zinc-600" />
                        <span>{analise.orgaoContato}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Ready-to-copy Protocol */}
              {protocoloTexto && (
                <div className="space-y-3 pt-4 border-t border-zinc-200">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-semibold text-zinc-500">
                      Modelo de protocolo para envio
                    </h3>
                    <button
                      type="button"
                      onClick={() => void handleCopyProtocol(protocoloTexto)}
                      className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-zinc-50 transition whitespace-nowrap shrink-0"
                    >
                      {copiedProtocol ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-700" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar protocolo</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="rounded-xl bg-zinc-50 p-4 text-xs sm:text-sm text-zinc-800 whitespace-pre-wrap font-sans leading-relaxed">
                    {protocoloTexto}
                  </pre>
                </div>
              )}

              {chamado.status !== 'RESOLVIDO' && (
                <div className="pt-4 border-t border-zinc-200">
                  <button
                    type="button"
                    disabled={analyzing}
                    onClick={() => void handleRunAI()}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-medium text-zinc-950 hover:bg-zinc-50 disabled:opacity-60 transition whitespace-nowrap"
                  >
                    {analyzing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>
                      {analyzing ? 'Atualizando análise...' : 'Atualizar análise com IA'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-4 border-t border-zinc-200">
              <p className="text-sm text-zinc-600 leading-relaxed">
                O plano de resolução da IA ainda não foi gerado para esta ocorrência. Clique abaixo para executar a análise agora.
              </p>
              <button
                type="button"
                disabled={analyzing}
                onClick={() => void handleRunAI()}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-60 transition whitespace-nowrap"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>
                  {analyzing
                    ? 'Gerando plano de resolução...'
                    : error
                    ? 'Tentar análise com IA novamente'
                    : 'Gerar plano de resolução com IA'}
                </span>
              </button>
            </div>
          )}
        </section>

        {/* Secondary Column: Occurrence Context, Status & Photos */}
        <div className="lg:col-span-5 space-y-6">
          <section
            aria-label="Detalhes da ocorrência"
            className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-zinc-950">Dados da ocorrência</h2>

            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
              {chamado.descricao || 'Sem descrição adicional informada.'}
            </p>

            {(chamado.enderecoResumo ||
              (typeof chamado.latitude === 'number' &&
                typeof chamado.longitude === 'number')) && (
              <div className="pt-3 border-t border-zinc-200 space-y-3">
                {chamado.enderecoResumo && (
                  <div className="flex items-start gap-2 text-xs sm:text-sm text-zinc-800">
                    <MapPin className="h-4 w-4 text-zinc-950 shrink-0 mt-0.5" />
                    <span>{chamado.enderecoResumo}</span>
                  </div>
                )}
                {hasMapsProvider &&
                  typeof chamado.latitude === 'number' &&
                  typeof chamado.longitude === 'number' && (
                    <TicketMapPreview
                      latitude={chamado.latitude}
                      longitude={chamado.longitude}
                      title={chamado.titulo}
                    />
                  )}
              </div>
            )}

            {chamado.status !== 'RESOLVIDO' && (
              <div className="pt-4 border-t border-zinc-200 space-y-2.5">
                <p className="text-xs font-medium text-zinc-600">Atualizar andamento</p>
                <div className="flex flex-wrap gap-2">
                  {NEXT_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      disabled={updatingStatus || chamado.status === s.value}
                      onClick={() => void handleStatusChange(s.value)}
                      className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-medium border transition whitespace-nowrap ${
                        chamado.status === s.value
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chamado.status === 'RESOLVIDO' && (
              <p className="pt-3 border-t border-zinc-200 text-xs text-emerald-700 font-medium">
                Chamado marcado como {STATUS_LABELS.RESOLVIDO}.
              </p>
            )}
          </section>

          <section
            aria-label="Fotos anexadas"
            className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-zinc-950">
                  Fotos anexadas ({fotos.length})
                </h2>
                <p className="text-xs text-zinc-500">Toque em uma imagem para ampliar.</p>
              </div>

              {chamado.status !== 'RESOLVIDO' && fotos.length < 20 && (
                <label className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-950 hover:bg-zinc-50 cursor-pointer transition whitespace-nowrap shrink-0">
                  <Camera className="h-4 w-4" />
                  <span>{uploadingFoto ? 'Enviando...' : 'Anexar foto'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingFoto}
                    onChange={(e) => void handleAttachPhoto(e)}
                    className="sr-only"
                  />
                </label>
              )}
            </div>

            {fotos.length === 0 ? (
              <p className="text-sm text-zinc-500 py-2">
                Nenhuma foto anexada a este chamado ainda.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {fotos.map((foto) => (
                  <button
                    key={foto.id}
                    type="button"
                    onClick={() => setZoomFoto(foto)}
                    className="rounded-xl border border-zinc-200 overflow-hidden bg-zinc-100 aspect-[4/3] focus:outline-none focus:ring-2 focus:ring-zinc-950"
                  >
                    <img
                      src={foto.imagemDataUrl}
                      alt={foto.nomeArquivo}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Lightbox modal */}
      {zoomFoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 p-4 flex items-center justify-center"
          onClick={() => setZoomFoto(null)}
        >
          <div
            className="relative max-w-2xl w-full space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-white">
              <span className="text-xs truncate pr-4">{zoomFoto.nomeArquivo}</span>
              <button
                type="button"
                onClick={() => setZoomFoto(null)}
                aria-label="Fechar visualização"
                className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={zoomFoto.imagemDataUrl}
              alt={zoomFoto.nomeArquivo}
              referrerPolicy="no-referrer"
              className="w-full max-h-[78vh] object-contain rounded-xl bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
};
