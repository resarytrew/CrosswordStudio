import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useSound, useAmbientSound } from '../lib/sounds';

interface CafeContextType {
  // Sound
  playSound: (type: any) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  
  // Ambient
  ambientEnabled: boolean;
  toggleAmbient: () => void;
  ambientIntensity: number;
  setAmbientIntensity: (intensity: number) => void;
  
  // Visual effects
  effectsEnabled: boolean;
  toggleEffects: () => void;
  
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const CafeContext = createContext<CafeContextType | undefined>(undefined);

export function CafeProvider({ children }: { children: React.ReactNode }) {
  const { play, setEnabled: setSoundEnabled, isEnabled: soundEnabled } = useSound();
  const { start: startAmbient, stop: stopAmbient, toggle: toggleAmbient, isPlaying: ambientEnabled, setIntensity } = useAmbientSound();
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const playSound = useCallback((type: any) => {
    if (soundEnabled && effectsEnabled) {
      play(type);
    }
  }, [play, soundEnabled, effectsEnabled]);
  
  const toggleSound = useCallback(() => {
    setSoundEnabled(!soundEnabled);
  }, [setSoundEnabled, soundEnabled]);
  
  const toggleEffects = useCallback(() => {
    setEffectsEnabled(prev => !prev);
  }, []);
  
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);
  
  const setAmbientIntensity = useCallback((intensity: number) => {
    setIntensity(intensity);
  }, [setIntensity]);
  
  const value: CafeContextType = {
    playSound,
    soundEnabled,
    toggleSound,
    ambientEnabled,
    toggleAmbient,
    ambientIntensity: ambientEnabled ? 0.1 : 0,
    setAmbientIntensity,
    effectsEnabled,
    toggleEffects,
    theme,
    toggleTheme,
  };
  
  return (
    <CafeContext.Provider value={value}>
      {children}
    </CafeContext.Provider>
  );
}

export function useCafe() {
  const context = useContext(CafeContext);
  if (!context) {
    throw new Error('useCafe must be used within a CafeProvider');
  }
  return context;
}

// HOC to wrap components with cafe context
export function withCafe<P extends object>(Component: React.ComponentType<P>) {
  return function WrappedComponent(props: P) {
    return (
      <CafeProvider>
        <Component {...props} />
      </CafeProvider>
    );
  };
}