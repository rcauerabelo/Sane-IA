import React, { useState } from 'react';
import { User, signOut } from 'firebase/auth';
import { ArrowRight, LogOut } from 'lucide-react';
import { BLUEPRINT_LIMITS } from '../lib/blueprint';
import { auth } from '../lib/firebase';
import { RegiaoDoc, saveUserProfile, UsuarioProfile } from '../lib/saneiaApi';

interface CompleteProfileViewProps {
  authUser: User;
  existingProfile: UsuarioProfile | null;
  regioes: RegiaoDoc[];
  onSaved: (profile: UsuarioProfile) => void;
}

export const CompleteProfileView: React.FC<CompleteProfileViewProps> = ({
  authUser,
  existingProfile,
  regioes,
  onSaved,
}) => {
  const [nome, setNome] = useState(
    existingProfile?.nome || authUser.displayName || ''
  );
  const [telefone, setTelefone] = useState(existingProfile?.telefone || '');
  const [regiaoPadraoId, setRegiaoPadraoId] = useState(
    existingProfile?.regiaoPadraoId || regioes[0]?.id || ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const saved = await saveUserProfile(authUser, {
        nome,
        telefone,
        regiaoPadraoId,
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cadastro.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between">
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-sm border-b border-zinc-200 px-4 flex items-center justify-between">
        <span className="text-base font-bold text-zinc-950">Completar Cadastro</span>
        <button
          type="button"
          onClick={() => void signOut(auth)}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 transition"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </button>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-5 py-6 pb-28">
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl font-bold text-zinc-950">Seus dados de morador</h1>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Confirme seu nome e telefone para vincular seus chamados no banco de dados.
          </p>
        </div>

        <form id="complete-profile-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="cad-email" className="block text-sm font-medium text-zinc-900">
              E-mail da conta Google
            </label>
            <input
              id="cad-email"
              type="email"
              value={authUser.email || ''}
              disabled
              className="w-full min-h-[48px] rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-sm text-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cad-nome" className="block text-sm font-medium text-zinc-900">
              Nome completo
            </label>
            <input
              id="cad-nome"
              type="text"
              required
              minLength={BLUEPRINT_LIMITS.USUARIO_NOME_MIN}
              maxLength={BLUEPRINT_LIMITS.USUARIO_NOME_MAX}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Maria da Silva"
              className="w-full min-h-[48px] rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cad-telefone" className="block text-sm font-medium text-zinc-900">
              Telefone / WhatsApp
            </label>
            <input
              id="cad-telefone"
              type="tel"
              required
              maxLength={BLUEPRINT_LIMITS.USUARIO_TELEFONE_MAX}
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full min-h-[48px] rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-mono tabular-nums text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>

          {regioes.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="cad-regiao" className="block text-sm font-medium text-zinc-900">
                Região principal (opcional)
              </label>
              <select
                id="cad-regiao"
                value={regiaoPadraoId}
                onChange={(e) => setRegiaoPadraoId(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              >
                <option value="">Selecionar depois</option>
                {regioes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.bairro} — {r.cidade}/{r.estado}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur-sm p-4 pb-safe">
        <div className="max-w-lg mx-auto">
          <button
            type="submit"
            form="complete-profile-form"
            disabled={saving}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-60 transition"
          >
            <span>{saving ? 'Salvando cadastro...' : 'Concluir cadastro e entrar'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
