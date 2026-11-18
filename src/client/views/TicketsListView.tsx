import React, { useMemo, useState } from 'react';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { STATUS_LABELS, StatusChamado } from '../lib/blueprint';
import { ChamadoDoc } from '../lib/saneiaApi';
import { StatusLabel } from '../components/StatusIndicator';

interface TicketsListViewProps {
  chamados: ChamadoDoc[];
  loading: boolean;
  onSelectChamado: (id: string) => void;
  onNewChamado: () => void;
}

const FILTER_OPTIONS: Array<{ value: 'TODOS' | StatusChamado; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ABERTO', label: 'Aberto' },
  { value: 'EM_ANALISE', label: 'Em análise' },
  { value: 'ENCAMINHADO', label: 'Encaminhado' },
  { value: 'RESOLVIDO', label: 'Resolvido' },
];

function formatDate(ts: ChamadoDoc['dataAbertura']): string {
  if (!ts) return 'Agora';
  return ts.toDate().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export const TicketsListView: React.FC<TicketsListViewProps> = ({
  chamados,
  loading,
  onSelectChamado,
  onNewChamado,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | StatusChamado>('TODOS');

  const stats = useMemo(() => {
    const abertos = chamados.filter((c) => c.status === 'ABERTO').length;
    const emAnalise = chamados.filter((c) => c.status === 'EM_ANALISE').length;
    const resolvidos = chamados.filter((c) => c.status === 'RESOLVIDO').length;
    return { total: chamados.length, abertos, emAnalise, resolvidos };
  }, [chamados]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chamados.filter((c) => {
      const matchesStatus = statusFilter === 'TODOS' || c.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        c.titulo.toLowerCase().includes(q) ||
        c.regiaoResumo.toLowerCase().includes(q) ||
        (c.enderecoResumo || '').toLowerCase().includes(q) ||
        c.tipoProblemaNome.toLowerCase().includes(q) ||
        c.descricao.toLowerCase().includes(q)
      );
    });
  }, [chamados, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Meus chamados</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Acompanhe suas ocorrências e os planos de resolução gerados pela IA.
          </p>
        </div>

        <button
          type="button"
          onClick={onNewChamado}
          className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 active:scale-[0.98] transition whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Abrir chamado</span>
        </button>
      </div>

      {/* Compact numeric summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Total</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-zinc-950">
            {stats.total}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Abertos</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-700">
            {stats.abertos}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Em análise</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-sky-700">
            {stats.emAnalise}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Resolvidos</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {stats.resolvidos}
          </p>
        </div>
      </div>

      {/* Search & Status filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="h-4 w-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, bairro ou tipo de problema..."
            aria-label="Buscar chamados"
            className="w-full min-h-[48px] rounded-xl border border-zinc-300 bg-white pl-10 pr-4 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950"
          />
        </div>

        <div
          className="flex items-center gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1"
          role="tablist"
          aria-label="Filtrar por status"
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(opt.value)}
                className={`min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-lg transition whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List / Loading / Empty states */}
      {loading ? (
        <div className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 sm:p-5 space-y-2.5 animate-pulse">
              <div className="h-4 w-2/3 rounded bg-zinc-200" />
              <div className="h-3 w-1/2 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-8 text-center space-y-4">
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h2 className="text-base font-bold text-zinc-950">
              {chamados.length === 0
                ? 'Nenhum chamado registrado ainda'
                : 'Nenhum chamado encontrado'}
            </h2>
            <p className="text-sm text-zinc-600">
              {chamados.length === 0
                ? 'Registre o primeiro problema de água ou saneamento da sua região com foto para receber orientação.'
                : `Não há chamados para os filtros selecionados (${
                    statusFilter === 'TODOS' ? 'Todos' : STATUS_LABELS[statusFilter]
                  }).`}
            </p>
          </div>
          {chamados.length === 0 && (
            <button
              type="button"
              onClick={onNewChamado}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Abrir primeiro chamado</span>
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          {filtered.map((chamado) => (
            <button
              key={chamado.id}
              type="button"
              onClick={() => onSelectChamado(chamado.id)}
              className="w-full min-h-[68px] px-4 py-4 sm:px-5 flex items-center justify-between gap-4 text-left hover:bg-zinc-50 active:bg-zinc-100 transition"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm sm:text-base font-semibold text-zinc-950 truncate">
                    {chamado.titulo}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600">
                  <span>{chamado.tipoProblemaNome}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{chamado.enderecoResumo || chamado.regiaoResumo}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{formatDate(chamado.dataAbertura)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {chamado.fotosCount} {chamado.fotosCount === 1 ? 'foto' : 'fotos'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {chamado.status === 'ABERTO' ? 'Aguardando análise IA' : 'Plano IA pronto'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <StatusLabel status={chamado.status} />
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
