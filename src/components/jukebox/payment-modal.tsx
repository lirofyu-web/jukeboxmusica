"use client";

import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Copy, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

interface PaymentModalProps {
  onClose: () => void;
  onSuccess: (amount: number) => void;
  machineId: string;
  mpAccessToken: string;
}

const AMOUNTS = [
  { label: 'R$ 1,00', value: 1.00, credits: 2 },
  { label: 'R$ 2,00', value: 2.00, credits: 4 },
  { label: 'R$ 5,00', value: 5.00, credits: 10 },
  { label: 'R$ 10,00', value: 10.00, credits: 20 },
];
export const PaymentModal: React.FC<PaymentModalProps> = ({ onClose, onSuccess, machineId, mpAccessToken }) => {
  const [selectedIdx, setSelectedIdx] = useState(2); // Inicia no R$ 5,00
  const selectedAmount = AMOUNTS[selectedIdx];


  const [step, setStep] = useState<'select' | 'qr' | 'success'>('select');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [paymentId, setPaymentId] = useState<string>("");
  const [status, setStatus] = useState<string>("pending");
  const [error, setError] = useState<string>("");

  const handleGeneratePix = async () => {
    if (!mpAccessToken) {
      alert("Por favor, configure o Access Token no Painel do Operador primeiro.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch('/api/mercado-pago/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedAmount.value,
          external_reference: machineId,
          accessToken: mpAccessToken
        })
      });
      const data = await res.json();
      if (data.qr_code) {
        setQrCode(data.qr_code);
        setPaymentId(data.id);
        setStep('qr');
      } else {
        const msg = data.message || data.details || "Erro desconhecido";
        setError(msg);
        alert(`Erro: ${msg}`);
      }
    } catch (err: any) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'qr' && paymentId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/mercado-pago/check-status/${paymentId}?accessToken=${mpAccessToken}`);
          const data = await res.json();
          if (data.status === 'approved') {
            setStep('success');
            clearInterval(interval);
            setTimeout(() => {
              onSuccess(selectedAmount.value);
              onClose();
            }, 3000);
          }
        } catch (err) {
          console.error("Erro polling status:", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [step, paymentId, mpAccessToken, onSuccess, onClose, selectedAmount.value]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (step === 'select') {
        if (key === 'arrowright' || key === 'arrowdown') {
          e.preventDefault();
          setSelectedIdx(prev => (prev < AMOUNTS.length - 1 ? prev + 1 : 0));
        } else if (key === 'arrowleft' || key === 'arrowup') {
          e.preventDefault();
          setSelectedIdx(prev => (prev > 0 ? prev - 1 : AMOUNTS.length - 1));
        } else if (key === 'enter') {
          e.preventDefault();
          handleGeneratePix();
        }
      }

      if (key === 'escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, selectedIdx, onClose]);


  const copyToClipboard = () => {
    navigator.clipboard.writeText(qrCode);
    alert("Código PIX copiado!");
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6 animate-in fade-in duration-500">
      <div className="glass-morphism border border-white/10 w-full max-w-md p-10 relative overflow-hidden rounded-sm shadow-[0_0_100px_rgba(249,115,22,0.2)]">
        
        <Button variant="ghost" onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white rounded-full p-2 h-auto transition-all">
          <X className="h-6 w-6" />
        </Button>

        {step === 'select' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-5">
            <div className="text-center">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Adicionar Créditos</h2>
              <p className="text-primary/60 text-[10px] uppercase font-bold tracking-widest">Escolha um valor via PIX</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {AMOUNTS.map((amt, idx) => (
                <button
                  key={amt.label}
                  onClick={() => setSelectedIdx(idx)}
                  className={cn(
                    "p-6 rounded-sm border transition-all flex flex-col items-center justify-center gap-1",
                    selectedIdx === idx 
                      ? "bg-primary text-black border-primary shadow-[0_10px_30px_rgba(249,115,22,0.3)] scale-105" 
                      : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                  )}
                >
                  <span className="text-xl font-black">{amt.label}</span>
                  <span className="text-[9px] uppercase font-bold opacity-60">{amt.credits} Músicas</span>
                </button>
              ))}
            </div>


            <Button 
                onClick={handleGeneratePix} 
                className="w-full h-16 bg-primary hover:bg-white text-black font-black uppercase text-sm rounded-sm transition-all"
                disabled={loading}
            >
              {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : "Gerar QR Code PIX"}
            </Button>
          </div>
        )}

        {step === 'qr' && (
          <div className="space-y-8 text-center animate-in zoom-in-95">
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Escaneie o QR Code</h2>
              <p className="text-green-500 text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-2">
                <RefreshCw className="h-3 w-3 animate-spin" /> Aguardando Pagamento...
              </p>
            </div>

            <div className="bg-white p-6 rounded-sm inline-block mx-auto shadow-2xl scale-110">
              <QRCodeSVG value={qrCode} size={200} />
            </div>

            <div className="space-y-3">
              <Button onClick={copyToClipboard} variant="outline" className="w-full border-white/10 text-white/60 hover:text-white uppercase font-black text-[10px] gap-2">
                <Copy className="h-4 w-4" /> Copia e Cola
              </Button>
              <p className="text-zinc-500 text-[9px] font-bold uppercase leading-relaxed px-4">
                Após o pagamento, os créditos serão adicionados automaticamente à máquina.
              </p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center space-y-6 py-10 animate-in zoom-in">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(34,197,94,0.3)]">
              <CheckCircle2 className="h-12 w-12 text-black" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">Sucesso!</h2>
              <p className="text-green-400 font-bold uppercase text-xs tracking-widest animate-pulse">Pagamento Confirmado</p>
            </div>
            <div className="bg-white/5 border border-white/5 p-6 rounded-sm">
                <p className="text-zinc-500 uppercase font-black text-[10px] mb-1">Créditos Adicionados</p>
                <p className="text-3xl font-black text-primary font-mono">+{selectedAmount.credits}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
