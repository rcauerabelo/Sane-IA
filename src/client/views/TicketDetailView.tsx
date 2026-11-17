import React, { useEffect, useState } from 'react';
import { ArrowLeft, Camera, MapPin, Phone, Sparkles, X } from 'lucide-react';
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
  onBack,
}) => {
  const [chamado, setChamado] = useState<ChamadoDoc | null>(null);
  const [fotos, setFotos] = useState<FotoDoc[]>([]);
  const [analise, setAnalise] = useState<AnaliseIADoc | null>(null);
  const [loading, setLoading] = useState(true);

  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState('');
  const [zoomFoto, setZoomFoto] = useState<FotoDoc | null>(null);

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
      await runChamadoAIAnalysis(chamado, orgaos);
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

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-36 rounded-xl bg-zinc-200" />
        <div className="h-40 rounded-2xl bg-zinc-100 border border-zinc-200" />
      </div>
    );
  }

  if (!chamado) {
    return (
      <div className="rounded-2xl border border-zinc-200 p-6 space-y-4">
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-50 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </button>

        <StatusLabel status={chamado.status} />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main ticket info + Photos */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>{chamado.tipoProblemaNome}</span>
                <span aria-hidden="true">·</span>
                <span>{chamado.regiaoResumo}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{dataFormatada}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 [text-wrap:balance]">
                {chamado.titulo}
              </h1>
            </div>

            <p className="text-sm sm:text-base text-zinc-700 leading-relaxed whitespace-pre-wrap">
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
              <div className="pt-4 border-t border-zinc-200 space-y-2">
                <p className="text-xs font-medium text-zinc-600">Atualizar andamento</p>
                <div className="flex flex-wrap gap-2">
                  {NEXT_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      disabled={updatingStatus || chamado.status === s.value}
                      onClick={() => void handleStatusChange(s.value)}
                      className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-medium border transition ${
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
          </div>

          {/* Photos Gallery */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-zinc-950">
                  Fotos anexadas ({fotos.length})
                </h2>
                <p className="text-xs text-zinc-500">Toque em uma imagem para ampliar.</p>
              </div>

              {chamado.status !== 'RESOLVIDO' && fotos.length < 20 && (
                <label className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-950 hover:bg-zinc-50 cursor-pointer transition whitespace-nowrap">
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
              <p className="text-sm text-zinc-500 py-4">
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
          </div>
        </div>

        {/* AI Analysis panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-zinc-950">Análise da IA</h2>
                <p className="text-xs text-zinc-600">
                  Classificação de urgência, órgão competente e passos recomendados.
                </p>
              </div>
              <Sparkles className="h-5 w-5 text-zinc-900 shrink-0" />
            </div>

            {analise ? (
              <div className="space-y-4 pt-2 border-t border-zinc-200">
                <div className="flex items-center justify-between gap-2">
                  <UrgenciaLabel urgencia={analise.urgencia} />
                  {analise.dataAnalise && (
                    <span className="text-xs font-mono tabular-nums text-zinc-500">
                      {analise.dataAnalise.toDate().toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>

                {analise.orgaoNome && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-3.5 space-y-1">
                    <p className="text-xs text-zinc-500">Órgão indicado</p>
                    <p className="text-sm font-semibold text-zinc-950">{analise.orgaoNome}</p>
                    {analise.orgaoContato && (
                      <p className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-zinc-700">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{analise.orgaoContato}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-zinc-600">Orientações práticas</p>
                  <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">
                    {analise.orientacao}
                  </p>
                </div>

                {chamado.status !== 'RESOLVIDO' && (
                  <button
                    type="button"
                    disabled={analyzing}
                    onClick={() => void handleRunAI()}
                    className="w-full min-h-[44px] rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-medium text-zinc-950 hover:bg-zinc-100 disabled:opacity-60 transition"
                  >
                    {analyzing ? 'Reanalisando...' : 'Atualizar análise com IA'}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4 pt-2 border-t border-zinc-200">
                <p className="text-sm text-zinc-600 leading-relaxed">
                  Este chamado ainda não foi avaliado pela Inteligência Artificial.
                </p>
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={() => void handleRunAI()}
                  className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-60 transition"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{analyzing ? 'Analisando chamado...' : 'Analisar com IA'}</span>
                </button>
              </div>
            )}
          </div>
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
