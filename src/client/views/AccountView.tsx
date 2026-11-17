import React, { useState } from 'react';
import { User, signOut } from 'firebase/auth';
import {
  Briefcase,
  Check,
  Edit3,
  Home,
  LogOut,
  MapPin,
  Plus,
  Smartphone,
  Star,
  Trash2,
} from 'lucide-react';
import { AddressFormModal } from '../components/AddressFormModal';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { BLUEPRINT_LIMITS } from '../lib/blueprint';
import { auth } from '../lib/firebase';
import { formatCep } from '../lib/locationApi';
import {
  deleteUserEndereco,
  EnderecoDoc,
  RegiaoDoc,
  saveUserProfile,
  setPrincipalEndereco,
  UsuarioProfile,
} from '../lib/saneiaApi';

interface AccountViewProps {
  authUser: User;
  usuario: UsuarioProfile;
  regioes: RegiaoDoc[];
  enderecos: EnderecoDoc[];
  hasMapsProvider: boolean;
  onRegiaoCreated: (regiao: RegiaoDoc) => void;
  onUpdated: (profile: UsuarioProfile) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  authUser,
  usuario,
  regioes,
  enderecos,
  hasMapsProvider,
  onRegiaoCreated,
  onUpdated,
}) => {
  const [nome, setNome] = useState(usuario.nome);
  const [telefone, setTelefone] = useState(usuario.telefone);
  const [regiaoPadraoId, setRegiaoPadraoId] = useState(usuario.regiaoPadraoId || '');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingEndereco, setEditingEndereco] = useState<EnderecoDoc | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyEnderecoId, setBusyEnderecoId] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSavedMsg('');
    setSaving(true);
    try {
      const updated = await saveUserProfile(authUser, {
        nome,
        telefone,
        regiaoPadraoId,
      });
      onUpdated(updated);
      setSavedMsg('Informações da conta atualizadas.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar conta.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrincipal = async (enderecoId: string) => {
    setError('');
    setBusyEnderecoId(enderecoId);
    try {
      await setPrincipalEndereco(usuario.uid, enderecoId, enderecos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao definir endereço principal.');
    } finally {
      setBusyEnderecoId(null);
    }
  };

  const handleDeleteEndereco = async (enderecoId: string) => {
    setError('');
    setBusyEnderecoId(enderecoId);
    try {
      await deleteUserEndereco(usuario.uid, enderecoId);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir endereço.');
    } finally {
      setBusyEnderecoId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Minha conta</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Gerencie suas informações cadastrais, endereços salvos e preferências do aplicativo.
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Meus Endereços (iFood / Mercado Livre style) */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-zinc-950">Meus endereços</h2>
                <p className="text-xs text-zinc-500">
                  Salve locais por CEP e toque no mapa para abrir chamados rapidamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingEndereco(null);
                  setFormOpen(true);
                }}
                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>Novo endereço</span>
              </button>
            </div>

            {enderecos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center space-y-2">
                <p className="text-sm font-medium text-zinc-900">
                  Você ainda não salvou nenhum endereço
                </p>
                <p className="text-xs text-zinc-500">
                  Adicione Casa, Trabalho ou um ponto da sua rua usando CEP e toque no mapa.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {enderecos.map((item) => {
                  const Icon =
                    item.apelido.toLowerCase() === 'casa'
                      ? Home
                      : item.apelido.toLowerCase() === 'trabalho'
                      ? Briefcase
                      : MapPin;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 space-y-3 ${
                        item.principal
                          ? 'border-zinc-950/30 bg-zinc-50/70'
                          : 'border-zinc-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-950">
                              {item.apelido}
                            </span>
                            {item.principal && (
                              <span className="text-[11px] font-semibold text-zinc-700">
                                · Principal
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-zinc-800">
                            {item.logradouro}
                            {item.numero ? `, ${item.numero}` : ', s/n'}
                            {item.complemento ? ` — ${item.complemento}` : ''}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {item.bairro}, {item.cidade} - {item.estado}
                            {item.cep ? ` · CEP ${formatCep(item.cep)}` : ''}
                          </p>
                          {item.referencia && (
                            <p className="text-[11px] text-zinc-500">
                              Ref.: {item.referencia}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-zinc-200/70 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-mono tabular-nums text-zinc-400">
                          {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!item.principal && (
                            <button
                              type="button"
                              disabled={busyEnderecoId === item.id}
                              onClick={() => void handleSetPrincipal(item.id)}
                              className="min-h-[36px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                            >
                              <Star className="h-3.5 w-3.5" />
                              <span>Principal</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEndereco(item);
                              setFormOpen(true);
                            }}
                            className="min-h-[36px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </button>
                          {confirmDeleteId === item.id ? (
                            <button
                              type="button"
                              disabled={busyEnderecoId === item.id}
                              onClick={() => void handleDeleteEndereco(item.id)}
                              className="min-h-[36px] inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700"
                            >
                              <span>Confirmar</span>
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
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <form
            onSubmit={(e) => void handleSave(e)}
            className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-5"
          >
            <h2 className="text-base font-bold text-zinc-950">Dados pessoais</h2>

            {savedMsg && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2"
              >
                <Check className="h-4 w-4 shrink-0" />
                <span>{savedMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="acc-email" className="block text-sm font-medium text-zinc-900">
                E-mail vinculado (Google)
              </label>
              <input
                id="acc-email"
                type="email"
                value={usuario.email}
                disabled
                className="w-full min-h-[48px] rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-sm text-zinc-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="acc-nome" className="block text-sm font-medium text-zinc-900">
                Nome completo
              </label>
              <input
                id="acc-nome"
                type="text"
                required
                minLength={BLUEPRINT_LIMITS.USUARIO_NOME_MIN}
                maxLength={BLUEPRINT_LIMITS.USUARIO_NOME_MAX}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="acc-telefone" className="block text-sm font-medium text-zinc-900">
                Telefone / WhatsApp
              </label>
              <input
                id="acc-telefone"
                type="tel"
                required
                maxLength={BLUEPRINT_LIMITS.USUARIO_TELEFONE_MAX}
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-mono tabular-nums text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="acc-regiao" className="block text-sm font-medium text-zinc-900">
                Região padrão para novos chamados
              </label>
              <select
                id="acc-regiao"
                value={regiaoPadraoId}
                onChange={(e) => setRegiaoPadraoId(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              >
                <option value="">Sem região padrão</option>
                {regioes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.bairro}, {r.cidade} - {r.estado}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto min-h-[48px] rounded-xl bg-zinc-950 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 transition"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 space-y-3">
            <div className="flex items-center gap-2 text-zinc-950">
              <Smartphone className="h-4 w-4" />
              <h2 className="text-sm font-bold">Aplicativo no celular</h2>
            </div>
            <PWAInstallButton variant="card" />
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-950">Sessão</p>
              <p className="text-xs text-zinc-500 font-mono break-all">ID: {usuario.uid}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair da conta</span>
            </button>
          </div>
        </div>
      </div>

      <AddressFormModal
        open={formOpen}
        uid={usuario.uid}
        editingEndereco={editingEndereco}
        allEnderecos={enderecos}
        regioes={regioes}
        hasMapsProvider={hasMapsProvider}
        onRegiaoCreated={onRegiaoCreated}
        onSaved={() => {
          setFormOpen(false);
          setEditingEndereco(null);
        }}
        onClose={() => {
          setFormOpen(false);
          setEditingEndereco(null);
        }}
      />
    </div>
  );
};
