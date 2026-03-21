'use client';

import { useMemo, useState } from 'react';
import { collection, query, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2, Check, X, Trash2, Settings2, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

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

export default function AdminPage() {
  const firestore = useFirestore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  // Settings Modal State
  const [configId, setConfigId] = useState<string | null>(null);
  const [price, setPrice] = useState(0.5);
  const [token, setToken] = useState('');
  const [cash, setCash] = useState(0);
  const [pix, setPix] = useState(0);
  
  const machinesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'machines'), orderBy('lastPing', 'desc'));
  }, [firestore]);

  const { data: machines, loading } = useCollection<MachineData>(machinesQuery);

  const isOnline = (lastPing?: { seconds: number }) => {
    if (!lastPing) return false;
    const now = Date.now() / 1000;
    return now - lastPing.seconds < 75; // 2.5x heartbeat (30s * 2.5)
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
    setCash(m.revenueCash || 0);
    setPix(m.revenuePix || 0);
  };

  const handleSaveSettings = async () => {
    if (!firestore || !configId) return;
    try {
      await updateDoc(doc(firestore, 'machines', configId), {
        pricePerSong: price,
        mpAccessToken: token,
        revenueCash: cash,
        revenuePix: pix
      });
      setConfigId(null);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar configurações");
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteMachine = async (id: string) => {
    if (!firestore) return;
    
    try {
      console.log(`Tentando excluir máquina: ${id}`);
      await deleteDoc(doc(firestore, 'machines', id));
      setConfirmDeleteId(null);
    } catch (e: any) {
      console.error("Erro ao excluir máquina:", e);
      alert(`Erro ao excluir: ${e.message || "Erro de permissão"}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Máquinas Conectadas</h2>
      </div>
      
      {loading ? (
        <p>Carregando máquinas...</p>
      ) : machines.length === 0 ? (
        <p className="text-zinc-500">Nenhuma máquina encontrada.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map((machine) => {
            const online = isOnline(machine.lastPing);
            return (
              <Card key={machine.id} className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    {editingId === machine.id ? (
                      <div className="flex items-center gap-1">
                        <Input 
                          value={editName} 
                          onChange={e => setEditName(e.target.value)} 
                          className="h-8 max-w-[140px] bg-zinc-950 px-2 text-sm" 
                          autoFocus 
                          placeholder="Ex: Bar do Zé"
                          onKeyDown={e => e.key === 'Enter' && handleSaveName(machine.id)}
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500 hover:text-green-400" onClick={() => handleSaveName(machine.id)}><Check className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-500 hover:text-red-400" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <CardTitle className="text-lg">{machine.name || `Máquina ${machine.id.slice(0, 8)}`}</CardTitle>
                        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditingId(machine.id); setEditName(machine.name || ''); }}>
                          <Edit2 className="w-3 h-3 text-zinc-400" />
                        </Button>
                      </div>
                    )}
                    <Badge variant={online ? "default" : "destructive"} className={online ? "bg-green-600 text-white hover:bg-green-500" : ""}>
                      {online ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  <CardDescription className="text-zinc-400 font-mono text-xs">
                    {machine.id}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <p className="text-sm text-zinc-300">
                      Visto em: {machine.lastPing ? new Date(machine.lastPing.seconds * 1000).toLocaleString() : 'Nunca'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Preço: R$ {(machine.pricePerSong || 0).toFixed(2)} | Total: R$ {((machine.revenueCash || 0) + (machine.revenuePix || 0)).toFixed(2)}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button variant="secondary" size="sm" className="w-full" asChild>
                      <Link href={`/admin/${machine.id}`}>Gerenciar Músicas</Link>
                    </Button>
                    
                    {confirmDeleteId === machine.id ? (
                      <div className="flex gap-1">
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="flex-1 font-bold"
                          onClick={(e) => { e.preventDefault(); handleDeleteMachine(machine.id); }}
                        >
                          Confirmar?
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="px-2"
                          onClick={(e) => { e.preventDefault(); setConfirmDeleteId(null); }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-red-500 hover:border-red-500/50 transition-colors gap-2"
                        onClick={(e) => { e.preventDefault(); setConfirmDeleteId(machine.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Excluir</span>
                      </Button>
                    )}

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full col-span-2 border-zinc-800 hover:bg-zinc-800 transition-colors gap-2"
                      onClick={() => handleOpenSettings(machine)}
                    >
                      <Settings2 className="w-3 h-3" />
                      Configurações
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL DE CONFIGURAÇÕES */}
      <Dialog open={!!configId} onOpenChange={() => setConfigId(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cash">Arrecadação Dinheiro (R$)</Label>
                <Input 
                  id="cash" 
                  type="number" 
                  step="0.1" 
                  value={cash} 
                  onChange={e => setCash(Number(e.target.value))} 
                  className="bg-zinc-950 border-zinc-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pix">Arrecadação PIX (R$)</Label>
                <Input 
                  id="pix" 
                  type="number" 
                  step="0.1" 
                  value={pix} 
                  onChange={e => setPix(Number(e.target.value))} 
                  className="bg-zinc-950 border-zinc-800"
                />
              </div>
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
    </div>
  );
}
