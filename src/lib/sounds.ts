import { useCallback, useRef, useEffect, useState } from 'react';

export type SoundType = 
  | 'letter-input'
  | 'word-complete'
  | 'cell-select'
  | 'block-toggle'
  | 'save'
  | 'page-turn'
  | 'success'
  | 'error'
  | 'achievement'
  | 'coffee-pour'
  | 'clock-tick'
  | 'book-open';

interface SoundConfig {
  volume: number;
  playbackRate: number;
  delay: number;
}

const defaultConfig: SoundConfig = {
  volume: 0.3,
  playbackRate: 1,
  delay: 0,
};

interface UseSoundReturn {
  play: (type: SoundType, config?: Partial<SoundConfig>) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: boolean;
}

export function useSound(): UseSoundReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isEnabled, setEnabled] = useState(true);
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    const initAudio = async () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    };

    const handleInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  const generateTone = useCallback((type: SoundType): { frequency: number; duration: number; type: OscillatorType } => {
    const tones: Record<SoundType, { frequency: number; duration: number; type: OscillatorType }> = {
      'letter-input': { frequency: 880, duration: 0.08, type: 'sine' },
      'word-complete': { frequency: 523.25, duration: 0.4, type: 'sine' },
      'cell-select': { frequency: 440, duration: 0.05, type: 'triangle' },
      'block-toggle': { frequency: 220, duration: 0.1, type: 'square' },
      'save': { frequency: 659.25, duration: 0.15, type: 'sine' },
      'page-turn': { frequency: 300, duration: 0.2, type: 'triangle' },
      'success': { frequency: 783.99, duration: 0.3, type: 'sine' },
      'error': { frequency: 196, duration: 0.2, type: 'sawtooth' },
      'achievement': { frequency: 1046.5, duration: 0.5, type: 'sine' },
      'coffee-pour': { frequency: 150, duration: 0.6, type: 'sine' },
      'clock-tick': { frequency: 1000, duration: 0.02, type: 'square' },
      'book-open': { frequency: 400, duration: 0.3, type: 'triangle' },
    };
    return tones[type] || { frequency: 440, duration: 0.1, type: 'sine' };
  }, []);

  const play = useCallback((type: SoundType, config: Partial<SoundConfig> = {}) => {
    if (!isEnabled) return;
    
    const settings = { ...defaultConfig, ...config };
    const ctx = audioContextRef.current;
    
    if (!ctx) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const audioCtx = audioContextRef.current;
    if (!audioCtx || audioCtx.state === 'suspended') return;

    try {
      const { frequency, duration, type: waveType } = generateTone(type);
      
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = waveType;
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      
      // Add harmonics for richer sound
      if (type === 'success' || type === 'achievement') {
        const harmonic = audioCtx.createOscillator();
        const harmonicGain = audioCtx.createGain();
        harmonic.type = 'sine';
        harmonic.frequency.setValueAtTime(frequency * 1.5, audioCtx.currentTime);
        harmonicGain.gain.setValueAtTime(settings.volume * 0.3, audioCtx.currentTime);
        harmonic.connect(harmonicGain);
        harmonicGain.connect(audioCtx.destination);
        harmonic.start(audioCtx.currentTime);
        harmonic.stop(audioCtx.currentTime + duration);
      }

      // Envelope for smooth sound
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(settings.volume, audioCtx.currentTime + 0.01);
      
      // Different decay for different sounds
      const decayTime = type === 'letter-input' ? 0.05 : 
                       type === 'word-complete' ? 0.3 : 
                       type === 'achievement' ? 0.4 : 0.1;
      
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + decayTime);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start(audioCtx.currentTime + settings.delay);
      oscillator.stop(audioCtx.currentTime + duration + settings.delay);
      
      activeSourcesRef.current.add(oscillator as any);
      oscillator.onended = () => activeSourcesRef.current.delete(oscillator as any);
      
    } catch (e) {
      console.warn('Sound playback error:', e);
    }
  }, [isEnabled, generateTone]);

  return { play, setEnabled, isEnabled };
}

// Ambient sound generator for atmosphere
export function useAmbientSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<AudioBufferSourceNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [intensity, setIntensity] = useState(0.1);

  const createCafeAmbience = useCallback(async () => {
    const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = ctx;

    // Create brown noise for ambient cafe hum
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }

    return { buffer, ctx };
  }, []);

  const start = useCallback(async () => {
    if (isPlaying) return;
    
    try {
      const { buffer, ctx } = await createCafeAmbience();
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 200;

      const gain = ctx.createGain();
      gain.gain.value = intensity * 0.1;

      source.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(ctx.destination);

      source.start();
      noiseRef.current = source;
      setIsPlaying(true);
    } catch (e) {
      console.warn('Ambient sound error:', e);
    }
  }, [isPlaying, intensity, createCafeAmbience]);

  const stop = useCallback(() => {
    if (noiseRef.current) {
      noiseRef.current.stop();
      noiseRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else start();
  }, [isPlaying, start, stop]);

  useEffect(() => {
    return () => {
      if (noiseRef.current) {
        noiseRef.current.stop();
      }
    };
  }, []);

  return { start, stop, toggle, isPlaying, setIntensity };
}