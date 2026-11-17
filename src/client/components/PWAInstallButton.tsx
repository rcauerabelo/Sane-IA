import React, { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          variant === 'card'
            ? 'w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 active:scale-[0.98] transition whitespace-nowrap'
            : 'min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-950 hover:bg-zinc-50 transition whitespace-nowrap shrink-0'
        }
      >
        <Download className="h-4 w-4" />
        <span>Instalar aplicativo</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'card'
              ? 'w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-950 hover:bg-zinc-50 transition whitespace-nowrap'
              : 'min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-950 hover:bg-zinc-50 transition whitespace-nowrap shrink-0'
          }
        >
          <Share className="h-4 w-4" />
          <span>Instalar no iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6">
              <h3 className="text-lg font-bold text-zinc-950">Instalar SaneIA no iOS</h3>
              <ol className="mt-3 space-y-2 text-sm text-zinc-700">
                <li>1. Toque no ícone de <strong>Compartilhar</strong> na barra do Safari.</li>
                <li>2. Role até encontrar e toque em <strong>Adicionar à Tela de Início</strong>.</li>
                <li>3. Confirme tocando em <strong>Adicionar</strong>.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-zinc-950 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 transition"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (variant === 'card') {
    return (
      <p className="text-xs text-zinc-600 leading-relaxed">
        No navegador do celular (Chrome ou Safari), use o menu do navegador e selecione{' '}
        <strong className="text-zinc-950">Adicionar à tela inicial</strong> para abrir o SaneIA como aplicativo.
      </p>
    );
  }

  return null;
};
