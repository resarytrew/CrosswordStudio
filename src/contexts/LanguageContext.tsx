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
    solverPreludeTagline: "Evening service",
    solverPreludeDesc: "Settle in, pour a cup, and solve this crossword in the calm rhythm of the intellectual cafe.",
    solverStart: "Begin Session",
    solverResume: "Resume Session",
    solverReady: "Ready",
    solverAutosaveSaving: "Saving...",
    solverAutosaveSaved: "Saved",
    solverAutosaveError: "Save issue",
    solverProgress: "Progress",
    makeTemplate: "Make template",
    removeTemplate: "Remove template",
    deleteCrossword: "Delete crossword",
    deleteCrosswordConfirm: "Delete this crossword? This action cannot be undone.",
    myTemplates: "My templates",
    myTemplatesDesc: "Build from your saved template layouts",
    editorSharing: "Share & access",
    visibilityPrivate: "Owner only",
    visibilityLink: "Anyone with link",
    visibilityPublic: "Public listing",
    difficultyEasy: "Easy",
    difficultyMedium: "Medium",
    difficultyHard: "Hard",
    copyPreviewLink: "Copy preview card link",
    shareCardTagline: "Shared crossword",
    shareAuthor: "Author",
    shareSizeWords: "Grid & words",
    shareDifficulty: "Difficulty",
    shareSolveCta: "Solve puzzle",
    shareCopySolveLink: "Copy solve link",
    sharePrivateHint: "This puzzle is restricted to its author. Sign in with the author account to continue.",
    shareLinkCopied: "Link copied",
    solverSharePage: "Preview card",
    duplicateAsTemplate: "Save as copy",
    toastDuplicateReady: "Duplicate saved — opening editor",
    uiCancel: "Cancel",
    uiDelete: "Delete",
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
    solverPreludeTagline: "Вечерняя подача",
    solverPreludeDesc: "Устройтесь поудобнее, налейте кофе и решайте кроссворд в спокойном ритме интеллектуального кафе.",
    solverStart: "Начать сессию",
    solverResume: "Продолжить сессию",
    solverReady: "Готово",
    solverAutosaveSaving: "Сохранение...",
    solverAutosaveSaved: "Сохранено",
    solverAutosaveError: "Ошибка сохранения",
    solverProgress: "Прогресс",
    makeTemplate: "Сделать шаблоном",
    removeTemplate: "Убрать из шаблонов",
    deleteCrossword: "Удалить кроссворд",
    deleteCrosswordConfirm: "Удалить этот кроссворд? Действие нельзя отменить.",
    myTemplates: "Мои шаблоны",
    myTemplatesDesc: "Создавайте по своим сохраненным шаблонам",
    editorSharing: "Поделиться и доступ",
    visibilityPrivate: "Только владелец",
    visibilityLink: "По ссылке",
    visibilityPublic: "Публичный",
    difficultyEasy: "Лёгкий",
    difficultyMedium: "Средний",
    difficultyHard: "Сложный",
    copyPreviewLink: "Копировать ссылку на карточку",
    shareCardTagline: "Кроссворд",
    shareAuthor: "Автор",
    shareSizeWords: "Сетка и слова",
    shareDifficulty: "Сложность",
    shareSolveCta: "Решать",
    shareCopySolveLink: "Копировать ссылку на решение",
    sharePrivateHint: "Этот кроссворд доступен только автору. Войдите в аккаунт автора.",
    shareLinkCopied: "Ссылка скопирована",
    solverSharePage: "Карточка для соцсетей",
    duplicateAsTemplate: "Копия как новый",
    toastDuplicateReady: "Копия сохранена — открываем редактор",
    uiCancel: "Отмена",
    uiDelete: "Удалить",
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
