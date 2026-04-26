import React from 'react';
import { motion } from 'framer-motion';
import { Steam } from '../components/CafeAnimations';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Brewing...' }: LoadingScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center bg-cafe-cream"
    >
      <div className="relative mb-8">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-24 h-24 rounded-full bg-cafe-leather/10 flex items-center justify-center"
        >
          <div className="w-16 h-16 rounded-full bg-cafe-leather" />
        </motion.div>
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Steam intensity="high" />
        </div>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center"
      >
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-display text-2xl font-semibold text-cafe-leather mb-2"
        >
          {message}
        </motion.p>
        <p className="text-body text-cafe-espresso/50 text-sm">
          Please wait while we prepare your crossword...
        </p>
      </motion.div>
    </motion.div>
  );
}

interface PulsingDotProps {
  className?: string;
  color?: string;
}

export function PulsingDot({ className = '', color = 'cafe-gold' }: PulsingDotProps) {
  return (
    <motion.span
      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
      transition={{ duration: 1, repeat: Infinity }}
      className={`inline-block w-2 h-2 rounded-full bg-${color} ${className}`}
      style={{ backgroundColor: 'var(--color-cafe-gold)' }}
    />
  );
}

interface TypingTextProps {
  text: string;
  className?: string;
  speed?: number;
}

export function TypingText({ text, className = '', speed = 50 }: TypingTextProps) {
  const [displayText, setDisplayText] = React.useState('');
  
  React.useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index <= text.length) {
        setDisplayText(text.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span className={className}>
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-0.5 h-1 ml-0.5 bg-cafe-ink align-middle"
      />
    </span>
  );
}