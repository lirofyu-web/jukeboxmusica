'use client';

import { useMemo, useState } from 'react';
import { collection, query, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2, Check, X, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface MachineData {
  id: string;
  name?: string;
  status?: string;
  lastPing?: { seconds: number; nanoseconds: number };
}

export default function AdminPage() {
  const firestore = useFirestore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
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

  const handleDeleteMachine = async (id: string, name: string) => {
    if (!firestore) return;
    if (!confirm(`Tem certeza que deseja remover a máquina "${name || id}"? Isso não pode ser desfeito.`)) return;
    
    try {
      console.log(`Tentando excluir máquina: ${id}`);
      await deleteDoc(doc(firestore, 'machines', id));
      alert("Máquina excluída com sucesso.");
    } catch (e: any) {
      console.error("Erro ao excluir máquina:", e);
      alert(`Erro ao excluir: ${e.message || "Erro desconhecido. Verifique as permissões do Firebase."}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Connected Machines</h2>
      </div>
      
      {loading ? (
        <p>Loading machines...</p>
      ) : machines.length === 0 ? (
        <p className="text-zinc-500">No machines found.</p>
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
                  <p className="text-sm text-zinc-300">
                    Last Ping: {machine.lastPing ? new Date(machine.lastPing.seconds * 1000).toLocaleString() : 'Never'}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" size="sm" className="w-full" asChild>
                      <Link href={`/admin/${machine.id}`}>Manage Music</Link>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-red-500 hover:border-red-500/50 transition-colors"
                      onClick={() => handleDeleteMachine(machine.id, machine.name || "")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  );
}
