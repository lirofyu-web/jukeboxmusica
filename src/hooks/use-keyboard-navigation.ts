import { useCallback, useEffect, useRef } from 'react';

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
  onToggleVolume: () => void;
  showPaymentModal: boolean;
  showVolumeBar: boolean;
  mappings: Record<string, string>;
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
  onToggleVolume,
  showPaymentModal,
  showVolumeBar,
  mappings
}: KeyboardNavigationProps) => {
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef<boolean>(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    
    if (e.repeat && [mappings.KEY_LEFT, mappings.KEY_RIGHT].includes(key)) return;

    // Volume toggle
    if (key === mappings.KEY_VOL_CONTROL) {
      e.preventDefault();
      onToggleVolume();
      return;
    }

    // Volume Direto
    if (key === mappings.KEY_VOL_UP || (mappings.KEY_VOL_UP === '+' && key === '=')) {
      e.preventDefault();
      onVolumeChange(0.05);
      if (!showVolumeBar) onToggleVolume();
      return;
    }
    if (key === mappings.KEY_VOL_DOWN) {
      e.preventDefault();
      onVolumeChange(-0.05);
      if (!showVolumeBar) onToggleVolume();
      return;
    }

    if (showVolumeBar) {
      if ([mappings.KEY_LEFT, mappings.KEY_RIGHT, mappings.KEY_UP, mappings.KEY_DOWN].includes(key)) {
        e.preventDefault();
        const delta = (key === mappings.KEY_LEFT || key === mappings.KEY_DOWN) ? -0.05 : 0.05;
        onVolumeChange(delta);
      } else if (key === 'escape' || key === 'enter' || key === 'backspace') {
        onToggleVolume();
      }
      return;
    }

    if (isVideoMode) {
      if (['enter', 'escape', 'backspace', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
        onEscVideoMode();
        return;
      }
    }

    if (key === mappings.KEY_MENU) {
      e.preventDefault();
      onAdminToggle();
      return;
    }

    if (key === mappings.KEY_PIX) {
      e.preventDefault();
      onPaymentToggle();
      return;
    }

    if (key === mappings.KEY_CREDIT) {
      e.preventDefault();
      onAddCredit();
      return;
    }

    if (showAdmin || showPaymentModal) return;

    if (selectedAlbumId) {
      if (key === mappings.KEY_BACK || (mappings.KEY_BACK === 'backspace' && key === 'escape') || key === mappings.KEY_CHOOSE_ALBUM) {
        e.preventDefault();
        onBack();
      }
      return;
    }

    if (showAlphabetBar) {
      if (key === mappings.KEY_CHOOSE_ALBUM || key === '1' || key === 'escape') {
        e.preventDefault();
        onToggleAlphabetBar(false);
        return;
      }
      
      if (key === mappings.KEY_PLAY_TRACK || key === '2') {
        e.preventDefault();
        onAlphabetSelect();
        return;
      }

      if (key === mappings.KEY_LEFT || key === 'arrowleft') {
        e.preventDefault();
        onAlphabetNavigate('ArrowLeft');
      }
      if (key === mappings.KEY_RIGHT || key === 'arrowright') {
        e.preventDefault();
        onAlphabetNavigate('ArrowRight');
      }
      // No return here, allowing other keys to be processed if needed,
      // but the original logic had a return after the alphabet bar block.
      // Assuming the intent is to handle these keys and then return.
      return;
    }

    // Navegação Normal
    if ([mappings.KEY_UP, mappings.KEY_DOWN].includes(key)) {
      e.preventDefault();
      onNavigate(key === mappings.KEY_UP ? 'ArrowUp' : 'ArrowDown');
    } else if ([mappings.KEY_LEFT, mappings.KEY_RIGHT].includes(key)) {
      e.preventDefault();
      // Start Long Press Timer (10 seconds)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      isHoldingRef.current = true;
      holdTimerRef.current = setTimeout(() => {
        onToggleAlphabetBar(true);
        isHoldingRef.current = false;
        holdTimerRef.current = null;
      }, 5000); // 5 seconds per requirements
    } else if (key === mappings.KEY_CHOOSE_ALBUM || key === mappings.KEY_SELECT || key === 'enter') {
      e.preventDefault();
      onSelect();
    } else if (key === mappings.KEY_BACK || (mappings.KEY_BACK === 'backspace' && key === 'escape')) {
      onBack();
    }
  }, [
    onVolumeChange, onAdminToggle, onAddCredit, onNavigate, onBack, onSelect,
    isVideoMode, showAdmin, selectedAlbumId, showAlphabetBar, onToggleAlphabetBar,
    onAlphabetNavigate, onAlphabetSelect, onEscVideoMode, onPaymentToggle, onToggleVolume,
    showPaymentModal, showVolumeBar, mappings
  ]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if ([mappings.KEY_LEFT, mappings.KEY_RIGHT].includes(key)) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        if (isHoldingRef.current) {
          isHoldingRef.current = false;
          let direction = e.key;
          if (key === mappings.KEY_LEFT) direction = 'ArrowLeft';
          if (key === mappings.KEY_RIGHT) direction = 'ArrowRight';
          onNavigate(direction);
        }
      }
    }
  }, [mappings, onNavigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
};
