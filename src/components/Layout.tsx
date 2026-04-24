import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LogOut, LogIn, Grid3X3, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, login, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 sm:px-8 shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-slate-900 flex items-center justify-center text-white font-bold rounded-sm group-hover:scale-105 transition-transform duration-200">
              <Grid3X3 size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight">{t('appTitle')}</span>
          </Link>
        </div>
          
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium"
          >
            <Globe size={16} />
            {language === 'en' ? 'RU' : 'EN'}
          </button>
          {!user ? (
            <button 
              onClick={login}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              <LogIn size={16} />
              {t('signIn')}
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-500 hidden sm:block">{user.displayName}</span>
              <button 
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                <LogOut size={16} />
                {t('signOut')}
              </button>
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
