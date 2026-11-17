import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Droplets, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { PWAInstallButton } from '../components/PWAInstallButton';

export const LoginView: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setError('A janela de login foi fechada antes da conclusão.');
      } else if (code === 'auth/popup-blocked') {
        setError('O navegador bloqueou o popup de login. Permita popups para entrar.');
      } else {
        setError('Não foi possível entrar com o Google. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between px-5 py-8 sm:px-8">
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-zinc-950 flex items-center justify-center text-white">
            <Droplets className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-zinc-950 whitespace-nowrap">
            SaneIA
          </span>
        </div>
        <PWAInstallButton variant="compact" />
      </header>

      <main className="w-full max-w-4xl mx-auto my-auto py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-5">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            ODS 6 · Água Potável e Saneamento
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-950 [text-wrap:balance]">
            Registre problemas de água e saneamento direto do seu celular.
          </h1>
          <p className="text-base text-zinc-600 leading-relaxed max-w-xl">
            Abra chamados da sua comunidade, anexe fotos do local e receba uma análise automática de urgência e encaminhamento para o órgão responsável.
          </p>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-zinc-200">
            <div className="pt-3">
              <p className="text-sm font-semibold text-zinc-950">01. Registro rápido</p>
              <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                Informe tipo do problema, bairro e descrição em poucos toques.
              </p>
            </div>
            <div className="pt-3">
              <p className="text-sm font-semibold text-zinc-950">02. Foto do local</p>
              <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                Use a câmera ou galeria para anexar evidências ao chamado.
              </p>
            </div>
            <div className="pt-3">
              <p className="text-sm font-semibold text-zinc-950">03. Análise por IA</p>
              <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                Classificação de prioridade e orientação prática imediata.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-6 sm:p-7 space-y-5">
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-zinc-950">Entrar no aplicativo</h2>
              <p className="text-sm text-zinc-600">
                Use sua conta Google para acessar seus chamados ou concluir seu primeiro cadastro.
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

            <button
              type="button"
              disabled={loading}
              onClick={() => void handleGoogleSignIn()}
              className="w-full min-h-[48px] flex items-center justify-center gap-3 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-60 transition"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              <span>{loading ? 'Conectando...' : 'Entrar com Google'}</span>
            </button>

            <div className="flex items-start gap-2.5 text-xs text-zinc-600 pt-1">
              <ShieldCheck className="h-4 w-4 text-zinc-900 shrink-0 mt-0.5" />
              <span>
                No primeiro acesso você completará seu nome e telefone para contato dos órgãos responsáveis.
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-4xl mx-auto pt-4 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
        <span>SaneIA · Monitoramento Comunitário</span>
        <span>ODS 6</span>
      </footer>
    </div>
  );
};
