"use client";

import { useCallback, useEffect } from 'react';

interface KeyboardNavigationProps {
  onVolumeChange: (delta: number) => void;
  onAdminToggle: () => void;
  onAddCredit: () => void;
  onNavigate: (key: string) => void;
  onBack: () => void;
  onSelect: () => void;
  isVideoMode: boolean;
  showAdmin: boolean;
  selectedAlbumId: string | null;
  showAlphabetBar: boolean;
  onToggleAlphabetBar: (show: boolean) => void;
  onAlphabetNavigate: (key: string) => void;
  onAlphabetSelect: () => void;
  onEscVideoMode: () => void;
  onPaymentToggle: () => void;
  showPaymentModal: boolean;
}


export const useKeyboardNavigation = ({
  onVolumeChange,
  onAdminToggle,
  onAddCredit,
  onNavigate,
  onBack,
  onSelect,
  isVideoMode,
  showAdmin,
  selectedAlbumId,
  showAlphabetBar,
  onToggleAlphabetBar,
  onAlphabetNavigate,
  onAlphabetSelect,
  onEscVideoMode,
  onPaymentToggle,
  showPaymentModal
}: KeyboardNavigationProps) => {


  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    
    // Volume
    if (key === '+' || key === '=' || key === '-') {
      e.preventDefault();
      onVolumeChange(key === '-' ? -0.05 : 0.05);
      return;
    }

    // Modo Vídeo / Descanso
    if (isVideoMode) {
      if (['enter', 'escape', 'backspace', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
        onEscVideoMode();
        return;
      }
    }

    // Menu Admin
    if (key === 'm') {
      e.preventDefault();
      onAdminToggle();
      return;
    }

    // Modal de Pagamento (PIX)
    if (key === 'p') {
      e.preventDefault();
      onPaymentToggle();
      return;
    }


    // Créditos
    if (key === 'c' || key === '5') {
      e.preventDefault();
      onAddCredit();
      return;
    }

    if (showAdmin || showPaymentModal) return;

    // Detalhe do Álbum
    if (selectedAlbumId) {
      if (key === 'escape' || key === 'backspace') {
        e.preventDefault();
        onBack();
      }
      return;
    }

    // Barra de Alfabeto Ativa
    if (showAlphabetBar) {
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
        e.preventDefault();
        onAlphabetNavigate(e.key);
      } else if (key === 'enter') {
        e.preventDefault();
        onAlphabetSelect();
      } else if (key === 'escape' || key === 'backspace') {
        e.preventDefault();
        onToggleAlphabetBar(false);
      }
      return;
    }

    // Navegação Normal
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
      e.preventDefault();
      onNavigate(e.key);
    } else if (key === 'enter') {
      e.preventDefault();
      onSelect();
    } else if (key === 'escape' || key === 'backspace') {
      onBack();
    }
  }, [
    onVolumeChange, onAdminToggle, onAddCredit, onNavigate, onBack, onSelect,
    isVideoMode, showAdmin, selectedAlbumId, showAlphabetBar, onToggleAlphabetBar,
    onAlphabetNavigate, onAlphabetSelect, onEscVideoMode, onPaymentToggle, showPaymentModal
  ]);


  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};
