import React, { useState } from 'react';
import {
  Briefcase,
  Check,
  Edit3,
  Home,
  MapPin,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteUserEndereco,
  EnderecoDoc,
  setPrincipalEndereco,
} from '../lib/saneiaApi';
import { formatCep } from '../lib/locationApi';

interface AddressSelectorModalProps {
  open: boolean;
  uid: string;
  enderecos: EnderecoDoc[];
  selectedId: string | null;
  onSelect: (endereco: EnderecoDoc) => void;
  onAddNew: () => void;
  onEdit: (endereco: EnderecoDoc) => void;
  onClose: () => void;
}

export const AddressSelectorModal: React.FC<AddressSelectorModalProps> = ({
  open,
  uid,
  enderecos,
  selectedId,
  onSelect,
  onAddNew,
  onEdit,
  onClose,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSetPrincipal = async (endereco: EnderecoDoc) => {
    setError('');
    setBusyId(endereco.id);
    try {
      await setPrincipalEndereco(uid, endereco.id, enderecos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao definir principal.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (enderecoId: string) => {
    setError('');
    setBusyId(enderecoId);
    try {
      await deleteUserEndereco(uid, enderecoId);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir endereço.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="selector-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[88vh] bg-white rounded-t-2xl sm:rounded-2xl border border-zinc-200 flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 id="selector-modal-title" className="text-base font-bold text-zinc-950">
              Meus endereços
            </h2>
            <p className="text-xs text-zinc-500">
              Escolha onde o problema está acontecendo ou cadastre um novo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="h-11 w-11 rounded-xl border border-zinc-200 flex items-center justify-center text-zinc-700 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              onAddNew();
            }}
            className="w-full min-h-[52px] rounded-xl border border-dashed border-zinc-400 bg-zinc-50 hover:bg-zinc-100 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium text-zinc-950 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar novo endereço (CEP e Mapa)</span>
          </button>

          {enderecos.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 p-6 text-center space-y-1">
              <p className="text-sm font-semibold text-zinc-900">
                Nenhum endereço salvo ainda
              </p>
              <p className="text-xs text-zinc-500">
                Salve endereços como Casa ou Trabalho para abrir chamados em poucos toques.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {enderecos.map((item) => {
                const isSelected = selectedId === item.id;
                const Icon =
                  item.apelido.toLowerCase() === 'casa'
                    ? Home
                    : item.apelido.toLowerCase() === 'trabalho'
                    ? Briefcase
                    : MapPin;

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 transition ${
                      isSelected
                        ? 'border-zinc-950 bg-zinc-50/80 ring-1 ring-zinc-950'
                        : 'border-zinc-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(item);
                        onClose();
                      }}
                      className="w-full text-left flex items-start gap-3"
                    >
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-zinc-950 text-white'
                            : 'bg-zinc-100 text-zinc-800'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-950 truncate">
                            {item.apelido}
                          </span>
                          {item.principal && (
                            <span className="text-[11px] font-semibold text-zinc-700">
                              · Principal
                            </span>
                          )}
                          {isSelected && (
                            <Check className="h-4 w-4 text-zinc-950 ml-auto shrink-0" />
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-zinc-800 leading-snug">
                          {item.logradouro}
                          {item.numero ? `, ${item.numero}` : ', s/n'}
                          {item.complemento ? ` — ${item.complemento}` : ''}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {item.bairro}, {item.cidade} - {item.estado}
                          {item.cep ? ` · CEP ${formatCep(item.cep)}` : ''}
                        </p>
                      </div>
                    </button>

                    <div className="mt-3 pt-2.5 border-t border-zinc-100 flex flex-wrap items-center justify-end gap-2">
                      {!item.principal && (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void handleSetPrincipal(item)}
                          className="min-h-[36px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          <Star className="h-3.5 w-3.5" />
                          <span>Tornar principal</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onEdit(item);
                        }}
                        className="min-h-[36px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Editar</span>
                      </button>

                      {confirmDeleteId === item.id ? (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void handleDelete(item.id)}
                          className="min-h-[36px] inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700"
                        >
                          <span>Confirmar exclusão</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="min-h-[36px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Excluir</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
