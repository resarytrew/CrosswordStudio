import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'ru';

interface Translations {
  [key: string]: {
    [key: string]: string;
  };
}

const translations: Translations = {
  en: {
    appTitle: "Crossword Studio",
    dashboard: "Your Puzzles",
    dashboardDesc: "Manage and create new crosswords.",
    newCrossword: "New Crossword",
    noCrosswords: "No crosswords yet",
    startBuildingDesc: "Start building your first grid with the new tools.",
    startBuilding: "Start Building",
    edit: "Edit",
    play: "Play",
    publish: "Publish",
    published: "Published",
    save: "Save",
    saving: "Saving...",
    across: "Across",
    down: "Down",
    size: "Size",
    signIn: "Sign In",
    signInGoogle: "Sign in with Google",
    signOut: "Sign Out",
    welcome: "GRID MASTER",
    welcomeDesc: "Create, share, and solve crosswords.",
    returnToPuzzles: "Return to Puzzles",
    congrats: "Congratulations!",
    solvedIn: "You solved the crossword in",
    saveProgress: "Save Progress",
    symmetric: "Symmetric",
    pressBlock: "Press \".\" for block",
    pressSpace: "Press \"Space\" for void cell",
    enterClue: "Enter clue...",
    noClue: "No clue provided",
    untitled: "Untitled Crossword",
    live: "Live",
    loadingEditor: "Loading editor...",
    loadingPuzzle: "Loading puzzle...",
    templates: "Templates",
    templatesDesc: "Start with a pre-designed grid layout",
    statsTotalWords: "Total words",
    statsBlockPct: "Blocks",
    statsEmptyClues: "Empty clues",
    statsGridSize: "Grid area",
    clearGrid: "Clear letters",
    connectedWarning: "Grid has disconnected sections",
    result: "Result",
  },
  ru: {
    appTitle: "Студия кроссвордов",
    dashboard: "Ваши кроссворды",
    dashboardDesc: "Управляйте и создавайте новые кроссворды.",
    newCrossword: "Новый кроссворд",
    noCrosswords: "Пока нет кроссвордов",
    startBuildingDesc: "Начните создавать свою первую сетку с новыми инструментами.",
    startBuilding: "Начать создание",
    edit: "Изменить",
    play: "Играть",
    publish: "Опубликовать",
    published: "Опубликовано",
    save: "Сохранить",
    saving: "Сохранение...",
    across: "По горизонтали",
    down: "По вертикали",
    size: "Размер",
    signIn: "Войти",
    signInGoogle: "Войти через Google",
    signOut: "Выйти",
    welcome: "МАСТЕР КРОССВОРДОВ",
    welcomeDesc: "Создавайте, делитесь и решайте кроссворды.",
    returnToPuzzles: "К кроссвордам",
    congrats: "Поздравляем!",
    solvedIn: "Вы решили кроссворд за",
    saveProgress: "Сохранить прогресс",
    symmetric: "Симметрично",
    pressBlock: "Нажмите \".\" для черной клетки",
    pressSpace: "Нажмите \"Пробел\" для пустоты",
    enterClue: "Введите подсказку...",
    noClue: "Нет подсказки",
    untitled: "Кроссворд без названия",
    live: "В сети",
    loadingEditor: "Загрузка редактора...",
    loadingPuzzle: "Загрузка кроссворда...",
    templates: "Шаблоны",
    templatesDesc: "Начните работу с готовым макетом",
    statsTotalWords: "Всего слов",
    statsBlockPct: "Блоки",
    statsEmptyClues: "Пустых подсказок",
    statsGridSize: "Размер сетки",
    clearGrid: "Очистить буквы",
    connectedWarning: "Сетка содержит изолированные участки",
    result: "Результат",
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    if (saved === 'en' || saved === 'ru') return saved;
    const browserLang = navigator.language.slice(0, 2);
    if (browserLang === 'ru') return 'ru';
    // default to ru as requested by user
    return 'ru';
  });

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
