import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Send } from 'lucide-react';
import { STATUS_LABELS, StatusChamado, URGENCIA_LABELS, UrgenciaIA } from '../lib/blueprint';

export const StatusLabel: React.FC<{ status: StatusChamado }> = ({ status }) => {
  const iconMap: Record<StatusChamado, React.ReactNode> = {
    ABERTO: <Clock className="h-3.5 w-3.5 text-amber-700 shrink-0" />,
    EM_ANALISE: <AlertCircle className="h-3.5 w-3.5 text-sky-700 shrink-0" />,
    ENCAMINHADO: <Send className="h-3.5 w-3.5 text-zinc-800 shrink-0" />,
    RESOLVIDO: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />,
  };

  const colorMap: Record<StatusChamado, string> = {
    ABERTO: 'text-amber-700',
    EM_ANALISE: 'text-sky-700',
    ENCAMINHADO: 'text-zinc-900',
    RESOLVIDO: 'text-emerald-700',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${colorMap[status]}`}>
      {iconMap[status]}
      <span>{STATUS_LABELS[status]}</span>
    </span>
  );
};

export const UrgenciaLabel: React.FC<{ urgencia: UrgenciaIA }> = ({ urgencia }) => {
  const colorMap: Record<UrgenciaIA, string> = {
    BAIXA: 'text-emerald-700',
    MEDIA: 'text-amber-700',
    ALTA: 'text-red-700',
    INDEFINIDA: 'text-zinc-600',
  };

  return (
    <span className={`text-xs font-semibold uppercase tracking-wide ${colorMap[urgencia]}`}>
      Urgência {URGENCIA_LABELS[urgencia]}
    </span>
  );
};
