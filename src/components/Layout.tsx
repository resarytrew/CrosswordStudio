import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCafe } from '../contexts/CafeContext';
import { LogOut, LogIn, BookOpen, Globe, Volume2, VolumeX, Coffee } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Steam, CoffeeCup } from './CafeAnimations';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, login, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { soundEnabled, toggleSound, effectsEnabled, ambientEnabled, toggleAmbient } = useCafe();

  return (
    <div className="min-h-screen flex flex-col bg-cafe-cream text-cafe-ink font-body">
      <header className="h-16 border-b border-cafe-leather/10 bg-cafe-paper/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 shrink-0 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3 group">
            <motion.div 
              whileHover={{ rotate: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-9 h-9 bg-cafe-leather flex items-center justify-center text-cafe-paper rounded-sm shadow-md group-hover:shadow-lg transition-shadow relative"
            >
              <BookOpen size={20} />
              <AnimatePresence>
                {effectsEnabled && user && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute -top-2 -right-1"
                  >
                    <Steam intensity="low" className="scale-50" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <span className="text-xl font-display font-semibold tracking-tight text-cafe-leather">{t('appTitle')}</span>
          </Link>
        </div>
          
        <div className="flex items-center gap-4">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')}
            className="flex items-center gap-1.5 text-cafe-espresso/70 hover:text-cafe-leather transition-colors text-sm font-subhead font-medium"
          >
            <Globe size={16} />
            <span className="hidden sm:inline">{language === 'en' ? 'RU' : 'EN'}</span>
          </motion.button>

          <div className="flex items-center gap-1">
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleSound}
              className="p-2 text-cafe-espresso/50 hover:text-cafe-leather transition-colors"
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </motion.button>
            
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleAmbient}
              className={`p-2 transition-colors ${ambientEnabled ? 'text-cafe-honey' : 'text-cafe-espresso/30'}`}
              title={ambientEnabled ? 'Disable ambient' : 'Enable ambient'}
            >
              <Coffee size={18} />
            </motion.button>
          </div>

          <div className="h-6 w-px bg-cafe-leather/10" />

          {!user ? (
            <motion.button 
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={login}
              className="flex items-center gap-2 px-4 py-2 text-sm font-subhead font-semibold bg-cafe-leather text-cafe-paper rounded-sm hover:bg-cafe-espresso transition-colors shadow-md hover:shadow-lg"
            >
              <LogIn size={16} />
              {t('signIn')}
            </motion.button>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-sm font-body text-cafe-espresso/60 hidden sm:block">{user.displayName}</span>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-subhead font-medium border border-cafe-leather/20 rounded-sm hover:bg-cafe-leather/5 transition-colors"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">{t('signOut')}</span>
              </motion.button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col h-[calc(100vh-4rem)]">
        {children}
      </main>
    </div>
  );
}