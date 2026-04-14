import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  Plus, 
  Trash2, 
  Edit2, 
  LogOut, 
  CheckCircle2, 
  Settings,
  TrendingUp,
  Download,
  Calendar as CalendarIcon,
  Github,
  Cloud,
  CloudOff
} from 'lucide-react';
// Importações do Firebase (será necessário instalar: npm install firebase)
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  deleteDoc, 
  updateDoc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  PieChart,
  Pie,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format, isSameDay, isSameWeek, isSameMonth, isSameYear, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DemandLog, ButtonConfig, Period } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Função para gerar uma cor vibrante e consistente baseada no nome do serviço
const getServiceColor = (name: string) => {
  const palette = [
    '#38bdf8', '#4ade80', '#fbbf24', '#f87171', '#818cf8', 
    '#2dd4bf', '#fb7185', '#a78bfa', '#f472b6', '#60a5fa'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validação básica de ambiente para evitar tela branca em produção
if (!firebaseConfig.apiKey) {
  console.error("ERRO: Variáveis de ambiente do Firebase não encontradas. Verifique seu arquivo .env");
}

const app = initializeApp(firebaseConfig);
// Inicializa o Firestore com cache local persistente (Modo Offline)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const auth = getAuth(app);

// Initial Data
const DEFAULT_BUTTONS: ButtonConfig[] = [
  { id: '1', label: 'LEILÃO' },
  { id: '2', label: 'RETIRA CLIENTE' },
  { id: '3', label: 'LAST MILE' },
  { id: '4', label: 'ROTA' },
  { id: '5', label: 'VISITANTE' },
  { id: '6', label: 'PRESTADOR' },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'registro' | 'stats' | 'settings'>('registro');
  
  const [isAdmin, setIsAdmin] = useState(false);
  // Estados para controle de conexão (Correção da Tela Branca)
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // Data State
  const [buttons, setButtons] = useState<ButtonConfig[]>(DEFAULT_BUTTONS);
  const [logs, setLogs] = useState<DemandLog[]>([]);

  // Modal State para substituição do prompt()
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalValue, setModalValue] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
  const [modalConfirmAction, setModalAction] = useState<{ type: 'add' | 'edit' | 'delete_log' | 'delete_button' | 'error', id?: string, serviceLabel?: string } | null>(null);

  // Sincronização em tempo real com Firebase (Logs e Botões)
  useEffect(() => {
    let unsubAdmin: (() => void) | null = null;
    let unsubLogs: (() => void) | null = null;
    let unsubButtons: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // SEMPRE limpa os ouvintes de dados ao mudar de usuário (Login ou Logout)
      if (unsubAdmin) unsubAdmin();
      if (unsubLogs) unsubLogs();
      if (unsubButtons) unsubButtons();

      if (user) {
        console.log("Usuário detectado:", user.uid, user.email || 'Anônimo');
        
        // Se o usuário logou com o e-mail de admin, permissão total imediata
        const isEmailAdmin = user.email === 'admin@admin.com';
        
        unsubAdmin = onSnapshot(doc(db, "admins", user.uid), (docSnap) => {
          const hasAdminAccess = docSnap.exists() || isEmailAdmin;
          
          if (hasAdminAccess) {
            setIsAdmin(true);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
            setIsAdmin(false);
          }
        });

        // Ativa os listeners de dados apenas quando temos um usuário logado
        // Isso garante que eles usem o "token" de acesso atualizado
        const qLogs = query(collection(db, "logs"), orderBy("timestamp", "desc"));
        unsubLogs = onSnapshot(qLogs, { includeMetadataChanges: true }, (snapshot) => {
          setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DemandLog)));
          setIsSyncing(snapshot.metadata.hasPendingWrites);
        });

        const qButtons = collection(db, "buttons");
        unsubButtons = onSnapshot(qButtons, (snapshot) => {
          const firebaseButtons = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ButtonConfig));
          if (firebaseButtons.length > 0) {
            setButtons(firebaseButtons);
          } 
        });

      } else {
        setIsAuthenticated(false);
        setIsAdmin(false);
        // Só conecta anonimamente se não houver um erro de auth pendente
        console.log("Sessão finalizada.");
        signInAnonymously(auth).catch(err => console.error("Erro ao iniciar sessão anônima:", err));
      }
    });

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (unsubLogs) unsubLogs();
      if (unsubButtons) unsubButtons();
      unsubAuth();
      if (unsubAdmin) unsubAdmin();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Efeito para persistir o tema no localStorage
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Auth Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Transforma o username 'admin' em 'admin@admin.com' para o Firebase
      const email = username.includes('@') ? username : `${username}@admin.com`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Erro no login:", error);
      let errorMsg = 'Erro ao acessar o Firebase: ' + error.message;
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMsg = 'Usuário ou senha inválidos.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMsg = 'Este domínio (github.io) não está autorizado no Console do Firebase > Authentication > Settings.';
      }

      setModalTitle('Erro de Acesso');
      setModalValue(errorMsg);
      setModalAction({ type: 'error' });
      setIsModalOpen(true);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // Modal Action Handler
  const handleModalConfirm = async () => {
    try {
      if (modalConfirmAction?.type === 'add') {
        if (!modalValue.trim()) return;
        await addDoc(collection(db, "buttons"), { label: modalValue.toUpperCase() });
      } else if (modalConfirmAction?.type === 'edit' && modalConfirmAction.id) {
        if (!modalValue.trim()) return;
        await updateDoc(doc(db, "buttons", modalConfirmAction.id), { label: modalValue.toUpperCase() });
      } else if (modalConfirmAction?.type === 'delete_log' && modalConfirmAction.id) {
        await deleteDoc(doc(db, "logs", modalConfirmAction.id));
        if (deleteAudio.readyState >= 2) deleteAudio.play().catch(() => {});
      } else if (modalConfirmAction?.type === 'delete_button' && modalConfirmAction.id) {
        await deleteDoc(doc(db, "buttons", modalConfirmAction.id));
        if (deleteAudio.readyState >= 2) deleteAudio.play().catch(() => {});
      }
      
      // Fecha o modal e limpa o estado
      closeModal();
      setModalValue('');
      setModalAction(null);
    } catch (error: any) {
      console.error("Erro ao salvar botão:", error);
      setModalTitle('Erro de Permissão');
      setModalValue(error.code === 'permission-denied' ? "Você não tem permissão para alterar as configurações." : error.message);
      setModalAction({ type: 'error' });
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalValue('');
    setModalAction(null);
  };

  // Audio para feedback de sucesso
  const successAudio = useMemo(() => {
    const audio = new Audio('sounds/success.mp3');
    audio.load();
    return audio;
  }, []);
  const deleteAudio = useMemo(() => {
    const audio = new Audio('sounds/delete.mp3');
    audio.load();
    return audio;
  }, []);

  // Demand Handlers
  const registerDemand = async (label: string) => {
    try {
      await addDoc(collection(db, "logs"), {
        service: label.toUpperCase(),
        timestamp: new Date().toISOString(),
      });
      successAudio.play().catch(e => console.warn("Autoplay de áudio bloqueado ou erro:", e));
    } catch (error: any) {
      console.error("Erro ao registrar:", error);
      setModalTitle('Erro de Sincronização');
      setModalValue(error.code === 'permission-denied' 
        ? "Você não tem permissão para registrar dados. Verifique se o login está ativo." 
        : "Falha ao enviar para o servidor. O registro ficará salvo localmente.");
      setModalAction({ type: 'error' });
      setIsModalOpen(true);
    }
  };

  const removeLastDemand = async (label: string) => {
    // Busca o último log (o mais recente da lista) para este serviço
    // Removi a trava de 'isSameDay' para evitar problemas de fuso horário na hora de encontrar o clique
    const lastLog = logs.find(log => log.service === label);
    
    if (!lastLog) {
      alert(`Não encontrei nenhum registro de "${label}" para excluir.`);
      return;
    }

    // Em vez de confirm(), usamos nosso modal
    setModalTitle(`Excluir registro de ${label}?`);
    setModalValue(`Confirmar exclusão do atendimento realizado às ${format(parseISO(lastLog.timestamp), 'HH:mm:ss')}?`);
    setModalAction({ type: 'delete_log', id: lastLog.id });
    setIsModalOpen(true);
  };

  const exportToCSV = () => {
    if (logs.length === 0) return alert('Não há dados para exportar');
    
    const headers = ['ID', 'Servico', 'Data_Hora'];
    const rows = logs.map(log => {
      const date = parseISO(log.timestamp);
      const formattedDate = format(date, 'dd/MM/yyyy HH:mm:ss');
      return `${log.id},"${log.service.replace(/"/g, '""')}",${formattedDate}`;
    });
    
    // Adiciona o Byte Order Mark (BOM) \uFEFF para que o Excel identifique como UTF-8
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_demanda_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  // Stats Processing
  const todayLogs = useMemo(() => 
    logs.filter(log => isSameDay(parseISO(log.timestamp), new Date())),
  [logs]);

  const countsToday = useMemo(() => {
    const counts: Record<string, number> = {};
    buttons.forEach(b => counts[b.label] = 0);
    todayLogs.forEach(log => {
      counts[log.service] = (counts[log.service] || 0) + 1;
    });
    return counts;
  }, [buttons, todayLogs]);

  const totalToday = todayLogs.length;

  // Cálculo dos totais para os cards de resumo das estatísticas
  const statsTotals = useMemo(() => {
    const now = new Date();
    return {
      day: totalToday,
      week: logs.filter(log => isSameWeek(parseISO(log.timestamp), now, { weekStartsOn: 0 })).length,
      month: logs.filter(log => isSameMonth(parseISO(log.timestamp), now)).length,
      year: logs.filter(log => isSameYear(parseISO(log.timestamp), now)).length,
    };
  }, [logs, totalToday]);

  if (!isAuthenticated) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4 relative overflow-hidden", theme === 'dark' ? 'bg-[#020617]' : 'bg-gray-50')}>
        {/* Background Decorative Elements */}
        <div className={cn("absolute top-[-10%] left-[-10%] w-[50%] h-[50%] blur-[140px] rounded-full animate-pulse", theme === 'dark' ? 'bg-blue-600/20' : 'bg-blue-300/30')} />
        <div className={cn("absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] blur-[140px] rounded-full animate-pulse", theme === 'dark' ? 'bg-indigo-600/20' : 'bg-indigo-300/30')} style={{ animationDelay: '2s' }} />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("w-full max-w-md backdrop-blur-2xl rounded-[2.5rem] p-10 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] relative z-10", theme === 'dark' ? 'bg-white/[0.03] border border-white/10' : 'bg-white border border-gray-200')}
        >
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-[0_20px_40px_-10px_rgba(59,130,246,0.5)] rotate-3 hover:rotate-0 transition-transform duration-500 group">
              <div className={cn("p-3 rounded-xl backdrop-blur-sm -rotate-3 group-hover:rotate-0", theme === 'dark' ? 'bg-white/20' : 'bg-white/50')}>
                <LayoutDashboard className="text-white w-8 h-8" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">CONTROLE DE ATENDIMENTO</h1>
            <p className="text-[#D2DAE2]/60 text-sm mt-1">Acesse o sistema de registro</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className={cn("block text-xs font-semibold uppercase tracking-wider mb-2", theme === 'dark' ? 'text-[#D2DAE2]' : 'text-gray-700')}>Usuário</label>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                className={cn("w-full rounded-2xl px-5 py-4 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none", theme === 'dark' ? 'bg-black/40 border border-white/10 text-white placeholder:text-slate-600' : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400')}
                placeholder="admin"
              />
            </div>
            <div>
              <label className={cn("block text-xs font-semibold uppercase tracking-wider mb-2", theme === 'dark' ? 'text-[#D2DAE2]' : 'text-gray-700')}>Senha</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                className={cn("w-full rounded-2xl px-5 py-4 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none", theme === 'dark' ? 'bg-black/40 border border-white/10 text-white placeholder:text-slate-600' : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400')}
                placeholder="••••"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] active:scale-[0.98] text-white font-bold py-5 rounded-2xl shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] transition-all uppercase tracking-widest text-sm"
            >
              ACESSAR SISTEMA
            </button>
          </form>
          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <a 
              href="https://github.com/notyalcc" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] text-[#D2DAE2]/20 uppercase tracking-[0.2em] font-bold hover:text-[#00A8FF]/40 transition-colors inline-flex items-center gap-2"
            >
              Desenvolvido por Clayton S. Silva <Github className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen flex flex-col font-sans selection:bg-blue-500/30", theme === 'dark' ? 'bg-[#020617] text-[#D2DAE2]' : 'bg-gray-100 text-gray-800')}>
      {/* Header */}
      <header className={cn("backdrop-blur-xl border-b px-8 py-5 flex items-center justify-between sticky top-0 z-20", theme === 'dark' ? 'bg-slate-950/50 border-white/5' : 'bg-white/80 border-gray-200')}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <LayoutDashboard className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className={cn("font-bold leading-none", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Controle de Atendimento</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-[#D2DAE2]/50 uppercase tracking-widest font-semibold">Painel Pro</span>
              <div className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter",
                isOffline ? "bg-amber-500/10 text-amber-500" : isSyncing ? "bg-blue-500/10 text-blue-400 animate-pulse" : "bg-emerald-500/10 text-emerald-400"
              )}>
                {isOffline ? (
                  <><CloudOff className="w-2.5 h-2.5" /> Offline</>
                ) : isSyncing ? (
                  <><Cloud className="w-2.5 h-2.5" /> Sincronizando...</>
                ) : (
                  <><Cloud className="w-2.5 h-2.5" /> Online</>
                )}
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className={cn("p-2.5 rounded-xl transition-all border border-transparent", theme === 'dark' ? 'hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 hover:border-rose-500/20' : 'hover:bg-rose-100 text-gray-600 hover:text-rose-600 hover:border-rose-200')}
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'registro' && (
            <motion.div 
              key="registro"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className={cn("text-4xl font-black tracking-tight", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Registro Diário</h1>
                  <p className={cn("mt-1 flex items-center gap-2", theme === 'dark' ? 'text-[#D2DAE2]/60' : 'text-gray-600')}>
                    <CalendarIcon className="w-4 h-4 text-blue-500" />
                    {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
                <div className={cn("backdrop-blur-md px-7 py-5 rounded-[2rem] flex items-center gap-5 shadow-2xl", theme === 'dark' ? 'bg-white/[0.03] border border-white/10' : 'bg-white border border-gray-200')}>
                  <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                    <TrendingUp className="text-blue-400 w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Hoje</p>
                    <p className="text-2xl font-black text-white">{totalToday}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {buttons.map((btn) => (
                  <div key={btn.id} className="relative group">
                    <motion.button
                      whileHover={{ 
                        scale: 1.03, 
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'rgba(56, 189, 248, 0.4)' 
                      }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => registerDemand(btn.label)}
                      className={cn("w-full p-8 rounded-[2.5rem] text-left transition-all shadow-xl relative overflow-hidden h-full group/btn", theme === 'dark' ? 'bg-white/[0.02] border border-white/5' : 'bg-white border border-gray-200')}
                    >
                      <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover/btn:opacity-10 transition-opacity group-hover/btn:scale-110 duration-500">
                        <CheckCircle2 className="w-12 h-12" />
                      </div>
                      <h3 className={cn("font-black text-xl mb-2 tracking-tight", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{btn.label}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Hoje</span>
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg text-xs font-bold ring-1 ring-blue-500/20">
                            {countsToday[btn.label] || 0}
                          </span>
                        </div>
                      </div>
                    </motion.button>
                    
                    {/* Ícone de Lixeira: Agora é um botão separado que flutua sobre o card */}
                    {isAdmin && (countsToday[btn.label] || 0) > 0 && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          removeLastDemand(btn.label);
                        }}
                        className="absolute top-6 right-6 p-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-2xl transition-all z-20 border border-rose-500/20 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
                        title="Remover último clique errado"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div 
              key="stats"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-8"
            >
              <h1 className={cn("text-3xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Estatísticas</h1>
              
              {/* Cards de Resumo Geral */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard label="Hoje" value={statsTotals.day} icon={<CalendarIcon className="w-5 h-5" />} gradient="from-sky-500 to-blue-600" theme={theme} />
                <SummaryCard label="Semana" value={statsTotals.week} icon={<TrendingUp className="w-5 h-5" />} gradient="from-indigo-500 to-violet-600" theme={theme} />
                <SummaryCard label="Mês" value={statsTotals.month} icon={<BarChart3 className="w-5 h-5" />} gradient="from-emerald-500 to-teal-600" theme={theme} />
                <SummaryCard label="Ano" value={statsTotals.year} icon={<LayoutDashboard className="w-5 h-5" />} gradient="from-amber-400 to-orange-500" theme={theme} />
              </div>

              <div className="grid grid-cols-1 gap-6">
                <StatsSection title="Hoje" logs={logs} period="day" theme={theme} />
                <StatsSection title="Semana Atual" logs={logs} period="week" theme={theme} />
                <StatsSection title="Mês Atual" logs={logs} period="month" theme={theme} />
                <StatsSection title="Ano Atual" logs={logs} period="year" theme={theme} />
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h1 className={cn("text-3xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Configurações</h1>
                <div className="flex gap-3">
                  <button 
                    onClick={exportToCSV}
                    className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-xl font-bold transition-all text-sm"
                  >
                    <Download className="w-5 h-5" />
                    CSV
                  </button>
                  <button 
                    onClick={() => {
                      setModalTitle('Adicionar Novo Botão');
                      setModalValue('');
                      setModalAction({ type: 'add' });
                      setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 text-sm"
                  >
                    <Plus className="w-5 h-5" />
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Seção de Tema */}
              <div className={cn("p-6 rounded-3xl border shadow-xl transition-all", theme === 'dark' ? 'bg-slate-800/30 border-white/5' : 'bg-white border-gray-200')}>
                <h2 className={cn("text-xl font-bold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Tema</h2>
                <div className="flex items-center justify-between">
                  <p className={cn("text-sm", theme === 'dark' ? 'text-[#D2DAE2]/80' : 'text-gray-700')}>Escolha o tema do aplicativo:</p>
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className={cn("px-4 py-2 rounded-xl font-bold transition-all text-sm",
                      theme === 'dark' 
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800 border border-gray-300'
                    )}
                  >
                    {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                  </button>
                </div>
              </div>

              {/* Tabela de Botões */}
              <div className={cn("rounded-3xl overflow-hidden border shadow-xl", theme === 'dark' ? 'bg-slate-800/30 border-white/5' : 'bg-white border-gray-200')}>
                <table className="w-full text-left">
                  <thead className={cn("text-[10px] font-bold uppercase tracking-widest", theme === 'dark' ? 'bg-slate-950/30 text-slate-500' : 'bg-gray-100 text-gray-600')}>
                    <tr>
                      <th className="px-6 py-4">Botão</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className={cn("divide-y", theme === 'dark' ? 'divide-white/5' : 'divide-gray-200')}>
                    {buttons.map((btn) => (
                      <tr key={btn.id} className={cn("transition-colors group", theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50')}>
                        <td className={cn("px-6 py-4 font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{btn.label}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {isAdmin && (
                            <button 
                            onClick={() => {
                              setModalTitle('Renomear Botão');
                              setModalValue(btn.label);
                              setModalAction({ type: 'edit', id: btn.id });
                              setIsModalOpen(true);
                            }}
                            className={cn("p-2 rounded-lg transition-colors", theme === 'dark' ? 'hover:bg-blue-500/10 text-blue-400' : 'hover:bg-blue-100 text-blue-600')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>)}
                          {isAdmin && (
                            <button 
                            onClick={() => {
                              setModalTitle('Excluir Botão');
                              setModalValue(`Tem certeza que deseja excluir o botão "${btn.label}"? Esta ação não pode ser desfeita.`);
                              setModalAction({ type: 'delete_button', id: btn.id });
                              setIsModalOpen(true);
                            }}
                            className={cn("p-2 rounded-lg transition-colors", theme === 'dark' ? 'hover:bg-rose-500/10 text-rose-400' : 'hover:bg-rose-100 text-rose-600')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          <footer className="mt-12 pb-8 text-center opacity-30">
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#D2DAE2] flex items-center justify-center gap-2">
              © {new Date().getFullYear()} • 
              <a 
                href="https://github.com/notyalcc" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-blue-400 transition-colors flex items-center gap-1"
              >
                CLAYTON S. SILVA <Github className="w-2.5 h-2.5" />
              </a>
              • Controle de Atendimento Pro
            </p>
          </footer>
        </AnimatePresence>
      </main>

      {/* Custom Input Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn("w-full max-w-sm rounded-3xl p-6 shadow-2xl", theme === 'dark' ? 'bg-slate-900 border border-white/10' : 'bg-white border border-gray-200')}
            >
              <h3 className={cn("text-lg font-bold mb-2 uppercase tracking-tight", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{modalTitle}</h3>
              
              {modalConfirmAction?.type === 'delete_log' || modalConfirmAction?.type === 'delete_button' || modalConfirmAction?.type === 'error' ? (
                <p className={cn("mb-6 text-sm", theme === 'dark' ? 'text-slate-400' : 'text-gray-600')}>
                  {modalValue}
                </p>
              ) : (
                <input 
                  autoFocus
                  type="text"
                  value={modalValue}
                  onChange={(e) => setModalValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()}
                  className={cn("w-full rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 transition-all outline-none mb-6", theme === 'dark' ? 'bg-slate-950 border border-white/5 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900')}
                  placeholder="Digite o nome..."
                />
              )}

              <div className="flex justify-end gap-3">
                <button 
                  onClick={closeModal}
                  className={cn("px-4 py-2 font-semibold transition-colors", theme === 'dark' ? 'text-[#D2DAE2]/60 hover:text-white' : 'text-gray-600 hover:text-gray-900')}
                >
                  {modalConfirmAction?.type === 'error' ? 'Fechar' : 'Cancelar'}
                </button>
                {modalConfirmAction?.type !== 'error' && (
                  <button 
                    onClick={handleModalConfirm}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/20"
                  >
                    Confirmar
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className={cn("backdrop-blur-lg border-t p-2 flex justify-around items-center sticky bottom-0 z-10 shadow-2xl transition-all", theme === 'dark' ? 'bg-slate-950/90 border-white/5' : 'bg-white/90 border-gray-200')}>
        <NavButton 
          active={activeTab === 'registro'} 
          onClick={() => setActiveTab('registro')} 
          icon={<LayoutDashboard className="w-6 h-6" />} 
          label="Registro" 
          theme={theme}
        />
        <NavButton 
          active={activeTab === 'stats'} 
          onClick={() => setActiveTab('stats')} 
          icon={<BarChart3 className="w-6 h-6" />} 
          label="Estatísticas" 
          theme={theme}
        />
        <NavButton 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')} 
          icon={<Settings className="w-6 h-6" />} 
          label="Ajustes" 
          theme={theme}
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, theme }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, theme: 'dark' | 'light' }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all relative",
        active 
          ? (theme === 'dark' ? "text-blue-400" : "text-blue-600") 
          : (theme === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600")
      )}
    >
      {active && (
        <motion.div 
          layoutId="nav-bg"
          className={cn("absolute inset-0 rounded-xl", theme === 'dark' ? "bg-blue-500/10" : "bg-blue-500/5")}
        />
      )}
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

function SummaryCard({ label, value, icon, gradient, theme }: { label: string, value: number, icon: React.ReactNode, gradient: string, theme: 'dark' | 'light' }) {
  return (
    <div className={cn( // SummaryCard já tem um gradiente, então a borda e sombra são mais importantes
      "p-5 rounded-3xl border shadow-xl flex items-center gap-4 bg-gradient-to-br transition-all hover:scale-[1.02] hover:shadow-2xl relative overflow-hidden group",
      gradient,
      theme === 'dark' ? 'border-white/5' : 'border-black/5'
    )}>
      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0 text-white backdrop-blur-sm shadow-inner group-hover:rotate-6 transition-transform">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-2xl font-black text-white leading-none drop-shadow-md">{value}</p>
      </div>
    </div>
  );
}

function StatsSection({ title, logs, period, theme }: { title: string, logs: DemandLog[], period: Period, theme: 'dark' | 'light' }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    const now = new Date();
    
    logs.forEach(log => {
      const date = parseISO(log.timestamp);
      let match = false;
      if (period === 'day') match = isSameDay(date, now);
      else if (period === 'week') match = isSameWeek(date, now, { weekStartsOn: 0 });
      else if (period === 'month') match = isSameMonth(date, now);
      else if (period === 'year') match = isSameYear(date, now);
      
      if (match) {
        counts[log.service] = (counts[log.service] || 0) + 1;
      }
    });

    const chartDataRaw = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const total = chartDataRaw.reduce((sum, item) => sum + item.value, 0);

    return chartDataRaw.map(item => ({
      ...item,
      percentage: total > 0 ? Math.round((item.value / total) * 100) : 0,
      displayLabel: `${item.value} (${total > 0 ? Math.round((item.value / total) * 100) : 0}%)`
    }));
  }, [logs, period]);

  const subtitle = useMemo(() => {
    const now = new Date();
    if (period === 'day') return format(now, "dd/MM/yyyy");
    if (period === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 0 });
      const end = endOfWeek(now, { weekStartsOn: 0 });
      return `${format(start, 'dd/MM')} a ${format(end, 'dd/MM')}`;
    }
    if (period === 'month') return format(now, "MMMM 'de' yyyy", { locale: ptBR });
    if (period === 'year') return format(now, "yyyy");
    return '';
  }, [period]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn("p-6 rounded-3xl border shadow-xl transition-all", 
        theme === 'dark' ? 'bg-slate-800/30 border-white/5 hover:border-blue-500/20' : 'bg-white border-gray-200 hover:border-blue-200'
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-blue-400 w-5 h-5" />
          <h2 className={cn("text-lg font-bold tracking-tight", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{title}</h2>
        </div>
        <span className={cn("text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider", theme === 'dark' ? 'text-[#D2DAE2]/40 bg-[#1E272E]' : 'text-gray-500 bg-gray-100')}>
          {subtitle}
        </span>
      </div>

      {data.length === 0 ? (
        <div className={cn("h-[300px] flex flex-col items-center justify-center border-2 border-dashed rounded-2xl", theme === 'dark' ? 'text-slate-600 border-white/5' : 'text-gray-400 border-gray-300')}>
          <BarChart3 className="w-12 h-12 mb-2 opacity-20" />
          <p className="text-sm">Nenhum registro encontrado para este período</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Distribuição Percentual (Pizza) */}
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                  // Ajuste da cor da etiqueta dentro da pizza
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percentage }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return percentage > 5 ? (
                      <text x={x} y={y} fill={theme === 'dark' ? '#fff' : '#1f2937'} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
                        {`${percentage}%`}
                      </text>
                    ) : null;
                  }}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getServiceColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip // Tooltip para o gráfico de pizza
                  contentStyle={theme === 'dark' ? { backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' } : { backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                  formatter={(value: number, name: string, props: any) => [`${value} atendimentos (${props.payload.percentage}%)`, 'Total']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Barras */}
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 5, right: 80, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1E272E' : '#e5e7eb'} horizontal={false} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                stroke={theme === 'dark' ? '#D2DAE2' : '#4a4a4a'} 
                fontSize={12} 
                width={120}
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme === 'dark' ? '#D2DAE2' : '#4a4a4a', fontWeight: 600 }}
              />
              <Tooltip // Tooltip para o gráfico de barras
                cursor={{ fill: theme === 'dark' ? '#00A8FF' : '#a0c4ff', opacity: 0.05 }}
                contentStyle={theme === 'dark' ? { backgroundColor: '#2F3640', border: '1px solid #1E272E', borderRadius: '12px' } : { backgroundColor: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                itemStyle={{ color: '#00A8FF', fontWeight: 'bold' }}
                formatter={(value: number) => [`${value} atendimentos`, 'Total']}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                {data.map((entry, index) => {
                  const color = getServiceColor(entry.name);
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={color}
                      style={{ filter: theme === 'dark' ? `drop-shadow(0px 0px 8px ${color}44)` : `drop-shadow(0px 0px 4px ${color}22)` }}
                    />
                  );
                })}
                <LabelList 
                  dataKey="value" 
                  position="right" 
                  fill={theme === 'dark' ? '#FFFFFF' : '#333333'} 
                  fontSize={12} 
                  fontWeight="bold"
                  offset={15}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        </div>
      )}
    </motion.div>
  );
}
