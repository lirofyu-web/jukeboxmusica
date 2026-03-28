'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { collection, query, updateDoc, doc, deleteDoc, where, serverTimestamp, addDoc } from 'firebase/firestore';
import { useFirestore, useAuth } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Edit2, Check, X, Trash2, Settings2, Save, 
  LayoutDashboard, HelpCircle, Activity, Wallet, 
  Plus, ExternalLink, Cpu, Zap, Key, Copy, ClipboardCheck, Clock, RotateCcw, TrendingUp
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LoginView } from '@/components/jukebox/login-view';

interface MachineData {
  id: string;
  name?: string;
  status?: string;
  lastPing?: { seconds: number; nanoseconds: number };
  pricePerSong?: number;
  mpAccessToken?: string;
  revenueCash?: number;
  revenuePix?: number;
}

// --- Helper: Format relative time ---
const formatLastSeen = (lastPing?: { seconds: number }): string => {
  if (!lastPing) return 'Nunca conectou';
  const diff = Date.now() / 1000 - lastPing.seconds;
  if (diff < 90) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return 'há 1 dia';
  return `há ${Math.floor(diff / 86400)} dias`;
};

export default function AdminPage() {
  const firestore = useFirestore();
  const auth = useAuth();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (!auth) return;
    return auth.onAuthStateChanged(setUser);
  }, [auth]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  // Create Machine Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMachineName, setNewMachineName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Settings Modal State
  const [configId, setConfigId] = useState<string | null>(null);
  const [price, setPrice] = useState(0.5);
  const [token, setToken] = useState('');
  const [cash, setCash] = useState(0);
  const [pix, setPix] = useState(0);

  // Copy code state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const machinesQuery = useMemo(() => {
    if (!firestore || !user) return null;
    // NOTE: No orderBy here to avoid requiring a Firestore composite index.
    // Sorting is done client-side below.
    return query(
      collection(firestore, 'machines'), 
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user]);

  const { data: rawMachines, loading } = useCollection<MachineData>(machinesQuery);

  // Sort client-side: newest first (by createdAt seconds, fallback to 0)
  const machines = useMemo(() => {
    if (!rawMachines) return [];
    return [...rawMachines].sort((a, b) => {
      const aTime = (a as any).createdAt?.seconds ?? 0;
      const bTime = (b as any).createdAt?.seconds ?? 0;
      return bTime - aTime;
    });
  }, [rawMachines]);

  // A machine is only Online if it's physically linked (has hardwareId)
  // AND has sent a recent heartbeat. New/unlinked machines are always Offline.
  const isOnline = (machine: MachineData) => {
    if (!(machine as any).hardwareId) return false;
    if (!machine.lastPing) return false;
    const now = Date.now() / 1000;
    return now - machine.lastPing.seconds < 75;
  };

  const handleSaveName = async (id: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'machines', id), { name: editName });
      setEditingId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenSettings = (m: MachineData) => {
    setConfigId(m.id);
    setPrice(m.pricePerSong || 0.5);
    setToken(m.mpAccessToken || '');
    // cash/pix are read-only — shown directly from machine data
  };

  const handleResetRevenue = async (machineId: string, type: 'cash' | 'pix' | 'all') => {
    if (!firestore) return;
    const machine = machines.find(m => m.id === machineId);
    if (!machine) return;
    const machineName = machine.name || 'esta máquina';
    const msg = type === 'all' 
      ? `Zerar TODA arrecadação (dinheiro + PIX) de "${machineName}"?`
      : `Zerar arrecadação de ${type === 'cash' ? 'Dinheiro' : 'PIX'} de "${machineName}"?`;
    if (!confirm(msg)) return;
    const update: Record<string, number | string> = {};
    if (type === 'cash' || type === 'all') {
      update.revenueCash = 0;
      update.partialRevenueCash = 0;
    }
    if (type === 'pix' || type === 'all') {
      update.revenuePix = 0;
      update.partialRevenuePix = 0;
    }
    const now = new Date();
    update.lastResetDate = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    try {
      await updateDoc(doc(firestore, 'machines', machineId), update);
    } catch (e: any) {
      alert(`Erro ao zerar: ${e.message}`);
    }
  };

  const handleSaveSettings = async () => {
    if (!firestore || !configId) return;
    try {
      await updateDoc(doc(firestore, 'machines', configId), {
        pricePerSong: price,
        mpAccessToken: token,
        // Note: revenueCash/revenuePix are NOT saved here.
        // They are managed exclusively by the physical machine via addCredit/addPixRevenue.
        // Use the 'Zerar Arrecadação' button to reset them.
      });
      setConfigId(null);
    } catch (e) {
      alert("Erro ao salvar configurações");
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteMachine = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'machines', id));
      setConfirmDeleteId(null);
    } catch (e: any) {
      alert(`Erro ao excluir: ${e.message || "Erro de permissão"}`);
    }
  };

  const stats = useMemo(() => {
    if (!machines) return { total: 0, online: 0, revenue: 0 };
    return {
      total: machines.length,
      online: machines.filter(m => isOnline(m)).length,
      revenue: machines.reduce((acc, m) => acc + (m.revenueCash || 0) + (m.revenuePix || 0), 0)
    };
  }, [machines]);

  const handleCreateMachine = async () => {
    // Debug: check state before attempting to save
    if (!firestore) { alert('Firestore não inicializado'); return; }
    if (!user) { alert('Usuário não autenticado. Recarregue a página.'); return; }
    if (!newMachineName.trim()) return;

    setIsCreating(true);
    console.log('[CREATE MACHINE] user.uid:', user.uid, 'name:', newMachineName.trim());
    try {
      const docRef = await addDoc(collection(firestore, 'machines'), {
        ownerId: user.uid,
        name: newMachineName.trim(),
        createdAt: serverTimestamp(),
        status: 'offline',
        pricePerSong: 0.5,
        hardwareId: null,
        lastPing: serverTimestamp(),
      });
      console.log('[CREATE MACHINE] Sucesso! ID:', docRef.id);
      setIsAddModalOpen(false);
      setNewMachineName('');
    } catch (e: any) {
      console.error('[CREATE MACHINE] Erro:', e);
      alert(`Erro ao criar máquina:\n${e?.message || e?.code || JSON.stringify(e)}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = useCallback(async (machineId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(machineId);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (e) {
      // Fallback for environments without clipboard API
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedId(machineId);
      setTimeout(() => setCopiedId(null), 2500);
    }
  }, []);


  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* Header & Stats */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 flex flex-col justify-center">
          <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">Dashboard</h2>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-[0.2em]">Visão Geral da Rede</p>
        </div>
        
        <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 p-4 md:p-6 rounded-sm space-y-1">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <LayoutDashboard className="w-3 h-3" /> Total de Máquinas
          </p>
          <p className="text-2xl md:text-3xl font-black text-white">{stats.total}</p>
        </div>

        <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 p-4 md:p-6 rounded-sm space-y-1">
          <p className="text-[9px] font-black text-green-500/60 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3 h-3 font-bold" /> Máquinas Online
          </p>
          <div className="flex items-center gap-3">
             <p className="text-2xl md:text-3xl font-black text-white">{stats.online}</p>
             <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-1000" 
                  style={{ width: `${stats.total > 0 ? (stats.online / stats.total) * 100 : 0}%` }} 
                />
             </div>
          </div>
        </div>

        <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 p-4 md:p-6 rounded-sm space-y-1">
          <p className="text-[9px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-2">
            <Wallet className="w-3 h-3" /> Arrecadação Total
          </p>
          <p className="text-2xl md:text-3xl font-black text-white">R$ {stats.revenue.toFixed(2)}</p>
        </div>
      </section>

      {/* Tutorial & Create Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
             <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-3">
               <Cpu className="w-5 h-5 text-primary" /> Minhas Máquinas
             </h3>
             <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-primary hover:bg-orange-600 text-black font-black uppercase text-[9px] md:text-[10px] tracking-widest px-4 md:px-6 h-10 rounded-sm"
              >
                <Plus className="w-4 h-4 mr-2" /> Nova Máquina <span className="hidden sm:inline ml-1">(SHELL)</span>
              </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
               <p className="text-zinc-500 font-black uppercase tracking-[0.3em] animate-pulse">Carregando Rede...</p>
            </div>
          ) : machines && machines.length === 0 ? (
            <div className="py-20 text-center bg-zinc-900/20 border border-dashed border-white/5 rounded-sm">
               <p className="text-zinc-500 font-bold uppercase tracking-widest">Nenhuma máquina cadastrada.</p>
               <p className="text-[10px] text-zinc-700 mt-2">Crie uma máquina "Shell" para começar o vínculo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {machines && machines.map((machine) => {
                const online = isOnline(machine);
                const isCopied = copiedId === machine.id;
                return (
                  <div key={machine.id} className="group relative">
                    <div className={cn(
                      "absolute -inset-0.5 bg-gradient-to-r rounded-sm blur opacity-0 group-hover:opacity-20 transition duration-500",
                      online ? "from-green-500 to-emerald-600" : "from-primary to-orange-600"
                    )} />
                    
                    <div className="relative bg-zinc-900/60 backdrop-blur-xl border border-white/5 p-6 rounded-sm space-y-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 min-w-0 flex-1 pr-3">
                          {editingId === machine.id ? (
                            <div className="flex items-center gap-1">
                              <Input 
                                value={editName} 
                                onChange={e => setEditName(e.target.value)} 
                                className="h-8 bg-black/60 border-white/10 text-sm font-bold uppercase" 
                                autoFocus 
                                onKeyDown={e => e.key === 'Enter' && handleSaveName(machine.id)}
                              />
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" onClick={() => handleSaveName(machine.id)}><Check className="w-4 h-4" /></Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <h4 className="text-xl font-black uppercase tracking-tighter text-white truncate">{machine.name || 'Sem Nome'}</h4>
                              <button className="opacity-40 hover:opacity-100 transition-opacity shrink-0" onClick={() => { setEditingId(machine.id); setEditName(machine.name || ''); }}>
                                <Edit2 className="w-3 h-3 text-zinc-500 hover:text-white" />
                              </button>
                            </div>
                          )}
                          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{machine.id.slice(0, 12)}...</p>
                        </div>
                        
                        {/* Status Badge + Last Seen */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                            online ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-red-500/10 border-red-500/20 text-red-500"
                          )}>
                            {online ? '● Online' : '○ Offline'}
                          </div>
                          <div className="flex items-center gap-1 text-[8px] text-zinc-600 font-bold">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{formatLastSeen(machine.lastPing)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-y border-white/5 py-4">
                        <div className="space-y-0.5">
                           <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Preço/Música</p>
                           <p className="text-sm font-black text-white">R$ {(machine.pricePerSong || 0).toFixed(2)}</p>
                        </div>
                        <div className="space-y-0.5 text-right">
                           <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Arrecadação</p>
                           <p className="text-sm font-black text-primary">R$ {((machine.revenueCash || 0) + (machine.revenuePix || 0)).toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {(!(machine as any).hardwareId) ? (
                          <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-sm space-y-3">
                            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                              <Zap className="w-3 h-3" /> Aguardando Vínculo
                            </p>
                            <div className="flex items-center gap-2">
                             <div className="flex-1 bg-black/40 p-2 rounded-sm border border-white/5 font-mono text-center text-amber-200">
                               {(machine as any).activationCode || "--- ---"}
                               <p className="text-[7px] text-zinc-600 font-bold uppercase mt-1">Código de Vínculo</p>
                             </div>
                             <div className="flex flex-col gap-1.5">
                               {/* Copy Button */}
                               {(machine as any).activationCode && (
                                 <Button
                                   size="sm"
                                   variant="ghost"
                                   className={cn(
                                     "h-8 w-8 p-0 transition-all",
                                     isCopied ? "text-green-400 bg-green-500/10" : "text-zinc-500 hover:text-white hover:bg-white/5"
                                   )}
                                   onClick={() => handleCopyCode(machine.id, (machine as any).activationCode)}
                                   title="Copiar código"
                                 >
                                   {isCopied ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                 </Button>
                               )}
                               {/* Generate/Recreate Button */}
                               <Button 
                                  size="sm" 
                                  variant="secondary"
                                  className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] uppercase tracking-widest px-3"
                                  onClick={async () => {
                                    if (!firestore) return;
                                    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                                    await updateDoc(doc(firestore, 'machines', machine.id), { activationCode: code });
                                  }}
                                >
                                  {(machine as any).activationCode ? "Recriar" : "Gerar"}
                               </Button>
                             </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-green-500/5 border border-green-500/10 p-4 rounded-sm">
                             <p className="text-[9px] font-black text-green-500 uppercase tracking-widest flex items-center gap-2">
                              <Check className="w-3 h-3" /> Máquina Vinculada
                            </p>
                            <p className="text-[8px] font-mono text-zinc-600 mt-1 uppercase truncate">HWID: {(machine as any).hardwareId}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/5">
                          <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest h-10 w-full" asChild>
                            <Link href={`/admin/machine?id=${machine.id}`}><ExternalLink className="w-3 h-3 mr-2" /> Músicas</Link>
                          </Button>
                          <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest h-10 w-full" onClick={() => handleOpenSettings(machine)}>
                            <Settings2 className="w-3 h-3 mr-2" /> Opções
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn(
                                "col-span-2 text-[9px] font-black uppercase tracking-[0.2em] transition-colors h-10",
                                confirmDeleteId === machine.id ? "bg-red-500 text-white hover:bg-red-600" : "text-zinc-600 hover:text-red-500 hover:bg-red-500/5 mt-2"
                            )}
                            onClick={() => confirmDeleteId === machine.id ? handleDeleteMachine(machine.id) : setConfirmDeleteId(machine.id)}
                          >
                             {confirmDeleteId === machine.id ? "CONFIRMAR EXCLUSÃO" : "EXCLUIR MÁQUINA"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tutorial Panel */}
        <aside className="space-y-6">
          <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 p-8 rounded-sm space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-indigo-400" /> Como Ativar uma Máquina?
            </h3>
            
            <div className="space-y-6">
               <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center shrink-0 font-black text-[10px]">1</div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-zinc-300 mb-1">Crie uma Shell</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-bold">Clique em "NOVA MÁQUINA" e dê um nome a ela. Ela aparecerá na lista como Offline.</p>
                  </div>
               </div>

               <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center shrink-0 font-black text-[10px]">2</div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-zinc-300 mb-1">Gere o Código</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-bold">No card da máquina, clique em "GERAR CÓDIGO". Um código de 6 dígitos aparecerá.</p>
                  </div>
               </div>

               <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center shrink-0 font-black text-[10px]">3</div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-zinc-300 mb-1">Prepare o Pendrive</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-bold flex flex-col gap-1">
                      Crie um arquivo chamado <span className="text-primary font-mono select-all uppercase">machine_link.txt</span> no pendrive e cole o código dentro dele.
                    </p>
                  </div>
               </div>

               <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center shrink-0 font-black text-[10px]">4</div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-zinc-300 mb-1">Vincule e Pronto!</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-bold">Insira o pendrive na Jukebox. Ela lerá o código e "adotará" o nome e configurações criadas aqui.</p>
                  </div>
               </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-4">
               <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest leading-relaxed">
                  Dica: Se você deletar uma máquina vinculada, ela voltará a ser "Anônima" na próxima vez que for ligada.
               </p>
               <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-sm flex items-center gap-3">
                  <Key className="w-4 h-4 text-indigo-400" />
                  <p className="text-[9px] font-bold text-indigo-300 uppercase leading-none">Hard Lock Obrigatório</p>
               </div>
            </div>
          </div>
        </aside>
      </section>

      {/* MODAL: CRIAR MÁQUINA */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-sm p-8">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                <Plus className="w-6 h-6 text-primary" /> Nova Máquina
              </DialogTitle>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Inicie o registro de um novo equipamento</p>
           </DialogHeader>

           <div className="space-y-6 py-6">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nome Identificador</Label>
                 <Input 
                   placeholder="EX: BAR DO JOSÉ"
                   value={newMachineName}
                   onChange={e => setNewMachineName(e.target.value.toUpperCase())}
                   className="bg-white/5 border-white/5 h-12 font-bold uppercase"
                   autoFocus
                   onKeyDown={e => e.key === 'Enter' && handleCreateMachine()}
                 />
              </div>

              <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm">
                 <p className="text-[9px] font-bold text-primary/70 uppercase leading-relaxed">
                   Dica: Use nomes fáceis de identificar no mapa ou na lista geral.
                 </p>
              </div>
           </div>

           <DialogFooter className="flex-col sm:flex-row gap-3">
              <Button variant="ghost" onClick={() => setIsAddModalOpen(false)} className="text-zinc-500 hover:text-white uppercase font-black text-[10px]">Cancelar</Button>
              <Button 
                onClick={handleCreateMachine}
                disabled={isCreating || !newMachineName.trim()}
                className="bg-primary hover:bg-orange-600 text-black font-black uppercase text-[10px] px-8 h-12 rounded-sm"
              >
                {isCreating ? "Criando..." : "Registrar Máquina"}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIGURAÇÕES */}
      <Dialog open={!!configId} onOpenChange={() => setConfigId(null)}>
        <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-md p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Configurar Máquina
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="price">Valor por Música (R$)</Label>
              <Input 
                id="price" 
                type="number" 
                step="0.1" 
                value={price} 
                onChange={e => setPrice(Number(e.target.value))} 
                className="bg-zinc-950 border-zinc-800"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="token">Mercado Pago Access Token</Label>
              <Input 
                id="token" 
                type="password" 
                value={token} 
                onChange={e => setToken(e.target.value)} 
                placeholder="APP_USR-..."
                className="bg-zinc-950 border-zinc-800 font-mono text-xs"
              />
            </div>

            {/* Revenue — Read-Only display with reset button */}
            {(() => {
              const m = machines.find(x => x.id === configId);
              const totalCash = m?.revenueCash || 0;
              const totalPix  = m?.revenuePix  || 0;
              const total     = totalCash + totalPix;
              const lastReset = (m as any)?.lastResetDate;
              return (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-zinc-400">
                      <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                      Arrecadação em Campo
                      <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">(sincronizado em tempo real)</span>
                    </Label>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Dinheiro */}
                    <div className="bg-zinc-900 border border-white/5 rounded-sm p-3 text-center">
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">💵 Dinheiro</p>
                      <p className="text-lg font-black text-white font-mono">R$ {totalCash.toFixed(2)}</p>
                      <button
                        onClick={() => handleResetRevenue(configId!, 'cash')}
                        className="mt-2 text-[8px] text-red-400/60 hover:text-red-400 uppercase font-black tracking-widest flex items-center gap-1 mx-auto transition-colors"
                      >
                        <RotateCcw className="w-2.5 h-2.5" /> Zerar
                      </button>
                    </div>

                    {/* PIX */}
                    <div className="bg-zinc-900 border border-white/5 rounded-sm p-3 text-center">
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">📱 PIX</p>
                      <p className="text-lg font-black text-white font-mono">R$ {totalPix.toFixed(2)}</p>
                      <button
                        onClick={() => handleResetRevenue(configId!, 'pix')}
                        className="mt-2 text-[8px] text-red-400/60 hover:text-red-400 uppercase font-black tracking-widest flex items-center gap-1 mx-auto transition-colors"
                      >
                        <RotateCcw className="w-2.5 h-2.5" /> Zerar
                      </button>
                    </div>

                    {/* Total */}
                    <div className="bg-primary/10 border border-primary/20 rounded-sm p-3 text-center">
                      <p className="text-[8px] font-black text-primary/60 uppercase tracking-widest mb-1">🏆 Total</p>
                      <p className="text-lg font-black text-primary font-mono">R$ {total.toFixed(2)}</p>
                      <button
                        onClick={() => handleResetRevenue(configId!, 'all')}
                        className="mt-2 text-[8px] text-red-400/60 hover:text-red-400 uppercase font-black tracking-widest flex items-center gap-1 mx-auto transition-colors"
                      >
                        <RotateCcw className="w-2.5 h-2.5" /> Zerar Tudo
                      </button>
                    </div>
                  </div>

                  {lastReset && (
                    <p className="text-[9px] text-zinc-600 font-mono text-center">
                      Último reset: {lastReset}
                    </p>
                  )}
                </div>
              );
            })()}
            
            <div className="pt-6 border-t border-white/5">
                <Button 
                    variant="destructive" 
                    className="w-full bg-red-600/20 hover:bg-red-600 border border-red-600/50 text-white font-black uppercase text-xs h-14 gap-3 transition-all"
                    onClick={() => {
                        if (confirm(`DESEJA EXCLUIR DEFINITIVAMENTE A MÁQUINA "${machines.find(m => m.id === configId)?.name || 'ESTA MÁQUINA'}"?`)) {
                            handleDeleteMachine(configId!);
                            setConfigId(null);
                        }
                    }}
                >
                    <Trash2 className="w-5 h-5" />
                    Excluir Máquina Permanentemente
                </Button>
            </div>
            
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pt-2">
              ID: {configId}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigId(null)} className="border-zinc-800">
              Cancelar
            </Button>
            <Button onClick={handleSaveSettings} className="bg-primary text-black hover:bg-orange-600 font-bold gap-2">
              <Save className="w-4 h-4" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Padding extra no final para garantir rolagem em todas as telas */}
      <div className="h-40" />
    </div>
  );
}
