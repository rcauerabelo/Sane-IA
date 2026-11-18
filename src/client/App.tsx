import React, { useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Droplets, ListChecks, PlusCircle, User as UserIcon } from 'lucide-react';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { auth } from './lib/firebase';
import { fetchMapsApiKey } from './lib/locationApi';
import {
  ChamadoDoc,
  EnderecoDoc,
  ensureInitialCatalogs,
  fetchCatalogs,
  fetchUserProfile,
  OrgaoResponsavelDoc,
  RegiaoDoc,
  subscribeUserChamados,
  subscribeUserEnderecos,
  TipoProblemaDoc,
  UsuarioProfile,
} from './lib/saneiaApi';
import { AccountView } from './views/AccountView';
import { CompleteProfileView } from './views/CompleteProfileView';
import { LoginView } from './views/LoginView';
import { NewTicketView } from './views/NewTicketView';
import { TicketDetailView } from './views/TicketDetailView';
import { TicketsListView } from './views/TicketsListView';

type TabKey = 'chamados' | 'abrir' | 'conta';

export const App: React.FC = () => {
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);

  const [bootingUser, setBootingUser] = useState(false);
  const [profile, setProfile] = useState<UsuarioProfile | null>(null);
  const [tipos, setTipos] = useState<TipoProblemaDoc[]>([]);
  const [orgaos, setOrgaos] = useState<OrgaoResponsavelDoc[]>([]);
  const [regioes, setRegioes] = useState<RegiaoDoc[]>([]);

  const [chamados, setChamados] = useState<ChamadoDoc[]>([]);
  const [loadingChamados, setLoadingChamados] = useState(true);
  const [enderecos, setEnderecos] = useState<EnderecoDoc[]>([]);

  const [mapsApiKey, setMapsApiKey] = useState<string>(() =>
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim()
  );
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('chamados');
  const [selectedChamadoId, setSelectedChamadoId] = useState<string | null>(null);
  const [initialAiError, setInitialAiError] = useState('');
  const [bootError, setBootError] = useState('');

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  useEffect(() => {
    if (mapsApiKey) return;
    let cancelled = false;
    void fetchMapsApiKey().then((key) => {
      if (!cancelled && key) {
        setMapsApiKey(key);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mapsApiKey]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setProfile(null);
        setChamados([]);
        setEnderecos([]);
        setSelectedChamadoId(null);
        setActiveTab('chamados');
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;

    const load = async () => {
      setBootingUser(true);
      setBootError('');
      try {
        await ensureInitialCatalogs(authUser.uid);
        const [userProfile, catalogs] = await Promise.all([
          fetchUserProfile(authUser.uid),
          fetchCatalogs(),
        ]);
        if (cancelled) return;
        setProfile(userProfile);
        setTipos(catalogs.tipos);
        setOrgaos(catalogs.orgaos);
        setRegioes(catalogs.regioes);
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : 'Erro ao carregar dados iniciais.');
        }
      } finally {
        if (!cancelled) {
          setBootingUser(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !profile?.cadastroCompleto) return;
    setLoadingChamados(true);
    const unsubChamados = subscribeUserChamados(
      authUser.uid,
      (list) => {
        setChamados(list);
        setLoadingChamados(false);
      },
      (err) => {
        setBootError(err.message);
        setLoadingChamados(false);
      }
    );
    const unsubEnderecos = subscribeUserEnderecos(
      authUser.uid,
      (list) => setEnderecos(list),
      (err) => setBootError(err.message)
    );
    return () => {
      unsubChamados();
      unsubEnderecos();
    };
  }, [authUser, profile?.cadastroCompleto]);

  const quotaBanner = quotaExceeded ? (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
      <span>
        Google Maps Platform quota reached. If you are the app owner, visit{' '}
        <a
          href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold text-amber-950 hover:text-amber-800"
        >
          maps developer site
        </a>{' '}
        for instructions to update your account.
      </span>
    </div>
  ) : null;

  if (!authReady || (authUser && bootingUser)) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3 p-6">
        <div className="h-10 w-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center">
          <Droplets className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-zinc-600">Carregando SaneIA...</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <>
        {quotaBanner}
        <OfflineIndicator />
        <LoginView />
      </>
    );
  }

  if (bootError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 p-6 space-y-4">
          <h1 className="text-lg font-bold text-zinc-950">Erro ao conectar ao banco</h1>
          <p className="text-sm text-zinc-600 break-words">{bootError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full min-h-[48px] rounded-xl bg-zinc-950 text-white text-sm font-medium"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!profile || !profile.cadastroCompleto || !profile.telefone) {
    return (
      <>
        {quotaBanner}
        <OfflineIndicator />
        <CompleteProfileView
          authUser={authUser}
          existingProfile={profile}
          regioes={regioes}
          onSaved={(saved) => setProfile(saved)}
        />
      </>
    );
  }

  const navigateTab = (tab: TabKey) => {
    setInitialAiError('');
    setSelectedChamadoId(null);
    setActiveTab(tab);
  };

  const handleRegiaoCreated = (nova: RegiaoDoc) => {
    setRegioes((prev) => {
      if (prev.some((r) => r.id === nova.id)) return prev;
      return [...prev, nova].sort((a, b) => a.bairro.localeCompare(b.bairro));
    });
  };

  const hasMapsProvider = Boolean(mapsApiKey);

  const shell = (
    <div className="min-h-screen bg-zinc-50/40 flex flex-col">
      {quotaBanner}
      <OfflineIndicator />

      {/* Top App Bar (compact 56px) */}
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-sm border-b border-zinc-200 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto h-full flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => navigateTab('chamados')}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0"
          >
            <div className="h-8 w-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
              <Droplets className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-zinc-950">SaneIA</span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => navigateTab('chamados')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition ${
                activeTab === 'chamados'
                  ? 'border-zinc-950 text-zinc-950'
                  : 'border-transparent text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Meus chamados
            </button>
            <button
              type="button"
              onClick={() => navigateTab('abrir')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition ${
                activeTab === 'abrir'
                  ? 'border-zinc-950 text-zinc-950'
                  : 'border-transparent text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Abrir chamado
            </button>
            <button
              type="button"
              onClick={() => navigateTab('conta')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition ${
                activeTab === 'conta'
                  ? 'border-zinc-950 text-zinc-950'
                  : 'border-transparent text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Minha conta
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton variant="compact" />
            <button
              type="button"
              onClick={() => navigateTab('abrir')}
              className="hidden md:inline-flex min-h-[38px] items-center rounded-lg bg-zinc-950 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition whitespace-nowrap shrink-0"
            >
              Novo chamado
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-10">
        {selectedChamadoId ? (
          <TicketDetailView
            chamadoId={selectedChamadoId}
            orgaos={orgaos}
            hasMapsProvider={hasMapsProvider}
            initialAiError={initialAiError}
            onBack={() => {
              setInitialAiError('');
              setSelectedChamadoId(null);
            }}
          />
        ) : activeTab === 'chamados' ? (
          <TicketsListView
            chamados={chamados}
            loading={loadingChamados}
            onSelectChamado={(id) => {
              setInitialAiError('');
              setSelectedChamadoId(id);
            }}
            onNewChamado={() => navigateTab('abrir')}
          />
        ) : activeTab === 'abrir' ? (
          <NewTicketView
            usuario={profile}
            tipos={tipos}
            regioes={regioes}
            orgaos={orgaos}
            enderecos={enderecos}
            hasMapsProvider={hasMapsProvider}
            onRegiaoCreated={handleRegiaoCreated}
            onCreated={(id, aiError) => {
              setInitialAiError(aiError || '');
              setActiveTab('chamados');
              setSelectedChamadoId(id);
            }}
          />
        ) : (
          <AccountView
            authUser={authUser}
            usuario={profile}
            regioes={regioes}
            enderecos={enderecos}
            hasMapsProvider={hasMapsProvider}
            onRegiaoCreated={handleRegiaoCreated}
            onUpdated={(updated) => setProfile(updated)}
          />
        )}
      </main>

      {/* Fixed Mobile Bottom Tab Bar */}
      <nav
        aria-label="Navegação principal do aplicativo"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200 pb-safe"
      >
        <div className="grid grid-cols-3 h-16 items-center">
          <button
            type="button"
            onClick={() => navigateTab('chamados')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition ${
              activeTab === 'chamados' ? 'text-zinc-950' : 'text-zinc-500'
            }`}
          >
            <ListChecks className="h-5 w-5" strokeWidth={activeTab === 'chamados' ? 2.4 : 1.8} />
            <span className="text-[11px] font-medium tracking-tight">Chamados</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTab('abrir')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition ${
              activeTab === 'abrir' ? 'text-zinc-950' : 'text-zinc-500'
            }`}
          >
            <PlusCircle className="h-5 w-5" strokeWidth={activeTab === 'abrir' ? 2.4 : 1.8} />
            <span className="text-[11px] font-medium tracking-tight">Abrir</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTab('conta')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition ${
              activeTab === 'conta' ? 'text-zinc-950' : 'text-zinc-500'
            }`}
          >
            <UserIcon className="h-5 w-5" strokeWidth={activeTab === 'conta' ? 2.4 : 1.8} />
            <span className="text-[11px] font-medium tracking-tight">Conta</span>
          </button>
        </div>
      </nav>
    </div>
  );

  if (mapsApiKey) {
    return (
      <APIProvider
        apiKey={mapsApiKey}
        language="pt-BR"
        region="BR"
        libraries={['marker']}
      >
        {shell}
      </APIProvider>
    );
  }

  return shell;
};

export default App;
