"use client";

import React, { useState } from 'react';
import { useAuth } from '@/firebase/provider';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Lock, Mail, Loader2, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export const LoginView = () => {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      setError("Credenciais inválidas. Verifique o login e senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      </div>

      <Card className="glass-morphism border-white/10 w-full max-w-md p-10 space-y-8 z-10 relative shadow-[0_0_100px_rgba(249,115,22,0.15)]">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 mx-auto shadow-[0_0_30px_rgba(249,115,22,0.2)]">
            <Music className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Entrar na Rede</h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">Autenticação de Máquina de Música</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">E-mail da Máquina</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input 
                type="email" 
                placeholder="operador@jukebox.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/60 border-white/5 h-14 pl-12 text-white font-bold rounded-sm focus:border-primary transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">Senha do Administrador</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/60 border-white/5 h-14 pl-12 text-white font-bold rounded-sm focus:border-primary transition-all"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-[10px] font-black uppercase text-center bg-red-500/10 py-3 rounded-sm border border-red-500/20 animate-in fade-in slide-in-from-top-2">
              {error}
            </p>
          )}

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full h-16 bg-primary hover:bg-orange-600 text-black font-black uppercase tracking-widest text-sm shadow-[0_10px_30px_rgba(249,115,22,0.3)] transition-all active:scale-[0.98] rounded-sm flex items-center justify-center gap-3"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>Conectar Máquina</>
            )}
          </Button>
        </form>

        <p className="text-center text-[9px] text-zinc-600 font-bold uppercase tracking-widest pt-4">© 2026 Jukebox System • Conexão Criptografada</p>
      </Card>
    </div>
  );
};
