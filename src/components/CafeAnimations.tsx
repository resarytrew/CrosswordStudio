import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SteamProps {
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
}

export function Steam({ className = '', intensity = 'medium' }: SteamProps) {
  const particleCount = intensity === 'low' ? 3 : intensity === 'medium' ? 5 : 8;
  const heights = ['h-4', 'h-5', 'h-6', 'h-7', 'h-8'];
  
  return (
    <div className={`relative flex items-end justify-center gap-1 ${className}`}>
      <AnimatePresence>
        {Array.from({ length: particleCount }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ 
              opacity: [0, 0.6, 0.3, 0],
              y: [-30, -50],
              scale: [0.5, 1.2, 1.5],
              x: [0, Math.random() * 10 - 5]
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 2 + Math.random(),
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeOut'
            }}
            className={`w-1 ${heights[i % heights.length]} bg-gradient-to-t from-cafe-leather/20 to-transparent rounded-full blur-sm`}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface CoffeeCupProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  withSteam?: boolean;
  onClick?: () => void;
}

export function CoffeeCup({ className = '', size = 'md', withSteam = true, onClick }: CoffeeCupProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };
  
  const cupSize = sizeClasses[size];
  
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative ${cupSize} ${className}`}
    >
      <svg viewBox="0 0 40 40" className="w-full h-full">
        {/* Cup body */}
        <path
          d="M8 12 L8 32 Q8 38 20 38 Q32 38 32 32 L32 12 Z"
          fill="currentColor"
          className="text-cafe-leather"
        />
        {/* Coffee fill */}
        <path
          d="M10 14 L10 30 Q10 35 20 35 Q30 35 30 30 L30 14 Z"
          fill="currentColor"
          className="text-cafe-espresso"
        />
        {/* Handle */}
        <path
          d="M32 16 Q38 16 38 22 Q38 28 32 28"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-cafe-leather"
        />
        {/* Saucer */}
        <ellipse
          cx="20"
          cy="38"
          rx="14"
          ry="2"
          fill="currentColor"
          className="text-cafe-latte"
        />
      </svg>
      {withSteam && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Steam intensity="low" />
        </div>
      )}
    </motion.button>
  );
}

interface CoffeeBeanProps {
  className?: string;
  count?: number;
  animate?: boolean;
}

export function CoffeeBean({ className = '', count = 1, animate = false }: CoffeeBeanProps) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={animate ? { y: -20, opacity: 0 } : undefined}
          animate={animate ? { 
            y: 0, 
            opacity: 1,
            rotate: [0, 15, -15, 0]
          } : undefined}
          transition={animate ? { 
            duration: 0.6,
            delay: i * 0.1,
            type: 'spring',
            bounce: 0.5
          } : undefined}
          className="w-3 h-4"
        >
          <svg viewBox="0 0 12 16" className="w-full h-full">
            <ellipse
              cx="6"
              cy="8"
              rx="5"
              ry="7"
              fill="currentColor"
              className="text-cafe-leather"
            />
            {/* Bean groove */}
            <path
              d="M6 2 Q8 8 6 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-cafe-espresso"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      ))}
    </div>
  );
}

interface LampGlowProps {
  className?: string;
  intensity?: 'soft' | 'medium' | 'bright';
}

export function LampGlow({ className = '', intensity = 'medium' }: LampGlowProps) {
  const glowClasses = {
    soft: 'animate-lamp-flicker',
    medium: 'animate-lamp-glow',
    bright: 'animate-lamp-glow animate-pulse-glow'
  };
  
  return (
    <div className={`absolute inset-0 pointer-events-none ${glowClasses[intensity]} ${className}`}>
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(245, 166, 35, 0.4) 0%, transparent 70%)'
        }}
      />
    </div>
  );
}

interface BookSpineProps {
  className?: string;
  color?: string;
}

export function BookSpine({ className = '', color = 'cafe-leather' }: BookSpineProps) {
  return (
    <motion.div 
      whileHover={{ rotateY: -15 }}
      transition={{ type: 'spring', bounce: 0.4 }}
      className={`w-4 h-20 rounded-sm ${className}`}
      style={{ 
        background: `linear-gradient(90deg, var(--color-${color}) 0%, var(--color-${color}/80) 50%, var(--color-${color}) 100%)`,
        boxShadow: '-2px 0 4px rgba(0,0,0,0.2)'
      }}
    >
      {/* Spine details */}
      <div className="absolute inset-y-2 left-0.5 w-px bg-cafe-gold/30" />
      <div className="absolute inset-y-4 left-0.5 w-px bg-cafe-gold/20" />
    </motion.div>
  );
}

interface PageCurlProps {
  className?: string;
}

export function PageCurl({ className = '' }: PageCurlProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="absolute bottom-0 right-0 w-8 h-8">
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <path
            d="M0 32 L32 0 L32 32 Z"
            fill="currentColor"
            className="text-cafe-parchment"
          />
          <path
            d="M0 32 L20 32 L32 20 L32 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-cafe-leather/20"
          />
        </svg>
      </div>
    </div>
  );
}

interface FloatingParticleProps {
  className?: string;
  count?: number;
}

export function FloatingParticles({ className = '', count = 5 }: FloatingParticleProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: Math.random() * 100 - 50,
            y: Math.random() * 100 + 100,
            opacity: 0 
          }}
          animate={{ 
            y: -150,
            x: Math.random() * 100 - 50,
            opacity: [0, 0.3, 0]
          }}
          transition={{ 
            duration: 8 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'linear'
          }}
          className="absolute w-1 h-1 rounded-full bg-cafe-gold/40"
        />
      ))}
    </div>
  );
}

interface InkDropProps {
  className?: string;
  animate?: boolean;
}

export function InkDrop({ className = '', animate = true }: InkDropProps) {
  return (
    <motion.div
      initial={animate ? { scale: 0, opacity: 0 } : undefined}
      animate={animate ? { 
        scale: [0, 1.2, 1],
        opacity: [0, 1, 1]
      } : undefined}
      transition={{ 
        duration: 0.4,
        times: [0, 0.6, 1],
        ease: 'easeOut'
      }}
      className={`w-2 h-2 ${className}`}
    >
      <svg viewBox="0 0 8 8" className="w-full h-full">
        <circle
          cx="4"
          cy="4"
          r="4"
          fill="currentColor"
          className="text-cafe-ink"
        />
      </svg>
    </motion.div>
  );
}

interface SuccessBurstProps {
  className?: string;
}

export function SuccessBurst({ className = '' }: SuccessBurstProps) {
  return (
    <div className={`relative ${className}`}>
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: [0, 1.5, 2], opacity: [1, 1, 0] }}
        transition={{ duration: 0.8, times: [0, 0.5, 1] }}
        className="absolute inset-0"
      >
        {[0, 60, 120, 180, 240, 300].map(angle => (
          <motion.div
            key={angle}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ 
              scale: [0, 1],
              opacity: [1, 0],
              x: Math.cos(angle * Math.PI / 180) * 30,
              y: Math.sin(angle * Math.PI / 180) * 30
            }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 w-2 h-2"
            style={{ 
              background: 'var(--color-cafe-gold)',
              borderRadius: '50%'
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}

interface ClockTickProps {
  className?: string;
  showSeconds?: boolean;
}

export function ClockTick({ className = '', showSeconds = true }: ClockTickProps) {
  return (
    <motion.div
      animate={showSeconds ? { rotate: [0, 2, -2, 0] } : undefined}
      transition={showSeconds ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : undefined}
      className={`w-6 h-6 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-full h-full">
        {/* Clock face */}
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-cafe-leather"
        />
        {/* Hour hand */}
        <motion.line
          x1="12"
          y1="12"
          x2="12"
          y2="7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-cafe-leather"
          animate={{ rotate: [0, 30, 60, 90] }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        />
        {/* Minute hand */}
        <motion.line
          x1="12"
          y1="12"
          x2="16"
          y2="12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-cafe-espresso"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        />
        {/* Center dot */}
        <circle
          cx="12"
          cy="12"
          r="1.5"
          fill="currentColor"
          className="text-cafe-gold"
        />
      </svg>
    </motion.div>
  );
}