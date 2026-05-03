import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { BookMarked, BookOpen, Clock, Coffee, CopyPlus, Feather, Grid3X3, PenTool, Play, Plus, Sparkles, Trash2, Bookmark } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCafe } from '../contexts/CafeContext';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, getDocs, setDoc, doc, orderBy, limit, deleteDoc, updateDoc } from 'firebase/firestore';
import { Crossword, BoardState } from '../types';
import { createEmptyGrid, updateGridNumbers } from '../lib/gridUtils';
import { computeAnswersHash } from '../lib/crypto';
import { parseBoardState } from '../lib/boardParser';
import { templates, type Template } from '../lib/templates';
import { Steam, FloatingParticles, LampGlow, CoffeeBean, BookSpine, PageCurl } from '../components/CafeAnimations';
import { useConfirm } from '../components/ConfirmDialog';
import { removeShareLink } from '../lib/shareLinkWrites';

/* ─────────────── helpers ─────────────── */
function MiniGrid({ tpl }: { tpl: Template }) {
  return (
    <div
      className="grid w-full h-full gap-[0.5px]"
      style={{
        gridTemplateColumns: `repeat(${tpl.width}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${tpl.height}, minmax(0, 1fr))`,
      }}
    >
      {tpl.layout.map((row, y) =>
        row.split('').map((char, x) => (
          <div
            key={`${x}-${y}`}
            className={
              char === '#'
                ? 'bg-cafe-leather rounded-[1px]'
                : char === ' '
                  ? 'bg-cafe-parchment/40 rounded-[1px]'
                  : 'bg-cafe-paper border-[0.3px] border-cafe-leather/15 rounded-[1px]'
            }
          />
        )),
      )}
    </div>
  );
}

function RelativeTime({ timestamp }: { timestamp: number }) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return <span>just now</span>;
  if (mins < 60) return <span>{mins}m ago</span>;
  if (hrs < 24) return <span>{hrs}h ago</span>;
  if (days < 30) return <span>{days}d ago</span>;
  return (
    <span>
      {new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })}
    </span>
  );
}

/* ═══════════════════════════════════════════════ */
export function Dashboard() {
  const { user, login } = useAuth();
  const { language, t } = useLanguage();
  const { playSound, effectsEnabled } = useCafe();
  const navigate = useNavigate();
  const confirm = useConfirm();
const [crosswords, setCrosswords] = useState<Crossword[]>([]);
  const [userTemplates, setUserTemplates] = useState<Crossword[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function fetchPuzzles() {
      if (!user) { setLoading(false); return; }
      try {
        const q = query(
          collection(db, 'crosswords'),
          where('authorId', '==', user.uid),
          orderBy('updatedAt', 'desc'),
          limit(20),
        );
        const snapshot = await getDocs(q);
        setCrosswords(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Crossword)));
        setUserTemplates(snapshot.docs.filter(d => d.data().isTemplate === true).map(d => ({ id: d.id, ...d.data() } as Crossword)));
      } catch (err) {
        handleFirestoreError(err, 'list');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPuzzles();
  }, [user]);

const toCrosswordPayload = (data: Omit<Crossword, 'id'>): Omit<Crossword, 'id'> => {
  const plainBoard = JSON.parse(JSON.stringify(data.boardState)) as BoardState;
  return {
    authorId: data.authorId,
    title: data.title,
    boardState: plainBoard,
    answersHash: data.answersHash,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    isPublished: Boolean(data.isPublished),
    isTemplate: data.isTemplate === true,
    visibility: data.visibility,
    difficulty: data.difficulty,
    authorDisplayName: data.authorDisplayName,
  };
};

const createCrossword = async (id: string, payload: Omit<Crossword, 'id'>) => {
    const ref = doc(db, 'crosswords', id);
    await setDoc(ref, toCrosswordPayload(payload));
  };

  /* ── creators ── */
  const handleCreateFromTemplate = async (template: Template) => {
    if (!user || creating) return;
    setCreating(true);
    playSound('page-turn');
    const newId = crypto.randomUUID();
    const grid = [];
    for (let y = 0; y < template.height; y++) {
      const row = template.layout[y] || '';
      for (let x = 0; x < template.width; x++) {
        const char = row[x] || ' ';
        grid.push({ x, y, isBlock: char === '#', isHidden: char === ' ', value: '', number: null });
      }
    }
    let boardState: BoardState = { width: template.width, height: template.height, grid, clues: { across: [], down: [] } };
    boardState = updateGridNumbers(boardState);
    const answersHash = computeAnswersHash(boardState);
    const newPw: Crossword = {
      authorId: user.uid,
      title: language === 'ru' ? template.nameRu : template.name,
      boardState,
      answersHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublished: false,
      isTemplate: false,
      visibility: 'private',
      difficulty: 'medium',
      authorDisplayName: user.displayName ?? '',
    };
try {
      await createCrossword(newId, newPw);
      navigate(`/editor/${newId}`);
    } catch (err: any) {
      console.error('Create crossword error:', err);
      const errorMsg = err?.message || err?.code || JSON.stringify(err);
      toast.error(language === 'ru' ? `Ошибка: ${errorMsg}` : `Error: ${errorMsg}`);
    } finally {
      setCreating(false);
    }
  };

  const handleCreate = async () => {
    if (!user || creating) return;
    setCreating(true);
    playSound('book-open');
    const newId = crypto.randomUUID();
    const boardState = createEmptyGrid(15, 15);
    const answersHash = computeAnswersHash(boardState);
    const newPw: Crossword = {
      authorId: user.uid,
      title: language === 'ru' ? 'Кроссворд без названия' : 'Untitled Crossword',
      boardState,
      answersHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublished: false,
      isTemplate: false,
      visibility: 'private',
      difficulty: 'medium',
      authorDisplayName: user.displayName ?? '',
    };
    try {
      await createCrossword(newId, newPw);
      navigate(`/editor/${newId}`);
} catch (err) {
      handleFirestoreError(err, 'create', `/crosswords/${newId}`);
      toast.error(language === 'ru' ? 'Не удалось создать кроссворд. Проверьте правила Firestore для коллекции crosswords.' : 'Failed to create crossword. Check Firestore rules for crosswords collection.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCrossword = async (cwRow: Crossword) => {
    const ok = await confirm({
      title: language === 'ru' ? 'Удалить кроссворд?' : 'Delete crossword?',
      message: language === 'ru' ? t('deleteCrosswordConfirm') : 'Delete this crossword? This action cannot be undone.',
      confirmLabel: t('uiDelete'),
      cancelLabel: t('uiCancel'),
      destructive: true,
    });
    if (!ok || !cwRow.id) return;
    try {
      if (cwRow.slug) await removeShareLink(cwRow.slug);
      await deleteDoc(doc(db, 'crosswords', cwRow.id));
      setCrosswords(prev => prev.filter(cw => cw.id !== cwRow.id));
      playSound('page-turn');
      toast.success(language === 'ru' ? 'Удалено' : 'Deleted');
    } catch (err) {
      handleFirestoreError(err, 'delete');
      console.error(err);
      toast.error(language === 'ru' ? 'Не удалось удалить' : 'Could not delete');
    }
  };

  const handleDuplicate = async (cwRow: Crossword) => {
    if (!user || creating || !cwRow.id) return;
    const parsed = parseBoardState(cwRow.boardState);
    if (!parsed) {
      toast.error(language === 'ru' ? 'Не удалось прочитать кроссворд' : 'Could not read crossword');
      return;
    }
    setCreating(true);
    playSound('page-turn');
    const newId = crypto.randomUUID();
    const cloneTitle = language === 'ru' ? `Копия: ${cwRow.title}` : `Copy: ${cwRow.title}`;
    const answersHash = cwRow.answersHash ?? computeAnswersHash(parsed);
    const dup: Crossword = {
      authorId: user.uid,
      title: cloneTitle,
      boardState: JSON.parse(JSON.stringify(parsed)) as BoardState,
      answersHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublished: false,
      isTemplate: false,
      visibility: 'private',
      difficulty: cwRow.difficulty ?? 'medium',
      authorDisplayName: user.displayName ?? '',
    };
    try {
      await createCrossword(newId, dup);
      toast.success(t('toastDuplicateReady'));
      navigate(`/editor/${newId}`);
    } catch (err) {
      handleFirestoreError(err, 'create', `/crosswords/${newId}`);
      toast.error(language === 'ru' ? 'Не удалось создать копию' : 'Could not duplicate');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleTemplate = async (cw: Crossword) => {
    try {
      const ref = doc(db, 'crosswords', cw.id);
      await updateDoc(ref, { isTemplate: !cw.isTemplate, updatedAt: Date.now() });
      setCrosswords(prev => prev.map(c => c.id === cw.id ? { ...c, isTemplate: !c.isTemplate } : c));
      playSound('bookmark');
    } catch (err) {
      handleFirestoreError(err, 'update');
      console.error(err);
    }
  };

  /* ════════════════════════════════════════════════════════════
     WELCOME — не авторизован
     ════════════════════════════════════════════════════════════ */
  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[radial-gradient(circle_at_16%_14%,rgba(143,176,138,0.22),transparent_33%),radial-gradient(circle_at_84%_82%,rgba(63,86,62,0.24),transparent_40%),linear-gradient(180deg,#162118_0%,#223126_40%,#2f4333_100%)]">
        {effectsEnabled && (
          <>
            <LampGlow className="absolute inset-0 opacity-40" intensity="soft" />
            <FloatingParticles count={12} className="opacity-20" />
          </>
        )}

        {/* фоновая декорация — кроссвордная сетка */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.035] flex items-center justify-center">
          <div className="grid grid-cols-15 w-[700px] h-[700px] gap-[2px]">
            {Array.from({ length: 225 }).map((_, i) => (
              <div key={i} className={`rounded-sm ${Math.random() > 0.75 ? 'bg-cafe-leather' : 'border border-cafe-leather'}`} />
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-lg w-full bg-[linear-gradient(165deg,#f4eddf_0%,#ece3d2_100%)] rounded-sm shadow-2xl shadow-black/35 border border-[#c4b79f]/45 relative overflow-hidden"
        >
          {/* золотая полоса сверху */}
          <div className="h-1 bg-gradient-to-r from-transparent via-cafe-gold/60 to-transparent" />

          <div className="p-10 sm:p-12 text-center">
            {/* иконка + пар */}
            <div className="relative inline-block mb-8">
              <motion.div
                whileHover={{ rotate: -5 }}
                className="w-20 h-20 bg-cafe-leather text-cafe-paper flex items-center justify-center rounded-sm shadow-xl mx-auto"
              >
                <Coffee size={36} />
              </motion.div>
              <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                <Steam intensity="medium" />
              </div>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl font-bold text-cafe-leather tracking-tight mb-3 leading-tight">
              {language === 'ru' ? 'Кафе Эрудитов' : 'Erudite Cafe'}
            </h1>
            <p className="font-subhead text-xl text-cafe-espresso/60 mb-2 italic">
              {language === 'ru' ? 'Студия кроссвордов' : 'Crossword Studio'}
            </p>

            {/* декоративный разделитель */}
            <div className="flex items-center justify-center gap-3 my-6">
              <div className="h-px w-12 bg-cafe-leather/20" />
              <CoffeeBean count={3} className="text-cafe-leather/30" />
              <div className="h-px w-12 bg-cafe-leather/20" />
            </div>

            <p className="font-body text-cafe-espresso/70 mb-8 max-w-sm mx-auto leading-relaxed">
              {language === 'ru'
                ? 'Создавайте, решайте и делитесь кроссвордами в уютной атмосфере литературного кафе.'
                : 'Create, solve & share crosswords in the cozy atmosphere of a literary cafe.'}
            </p>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { playSound('coffee-pour'); login(); }}
              className="w-full py-4 bg-cafe-leather text-cafe-paper font-subhead text-lg font-semibold rounded-sm hover:bg-cafe-espresso transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
            >
              <BookOpen size={22} />
              {t('signInGoogle')}
            </motion.button>

            <p className="mt-5 text-xs text-cafe-espresso/30 font-body">
              {language === 'ru' ? 'Бесплатно. Без рекламы.' : 'Free. No ads.'}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     MAIN DASHBOARD — авторизован
     ════════════════════════════════════════════════════════════ */
  return (
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 h-full overflow-auto relative bg-[radial-gradient(circle_at_16%_14%,rgba(143,176,138,0.24),transparent_33%),radial-gradient(circle_at_84%_82%,rgba(63,86,62,0.28),transparent_40%),linear-gradient(180deg,#162118_0%,#223126_40%,#2f4333_100%)] rounded-sm">
      {effectsEnabled && <FloatingParticles count={4} className="opacity-10" />}

      {/* ═══ HERO ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 relative overflow-hidden rounded-sm bg-[linear-gradient(145deg,rgba(28,44,28,0.9),rgba(36,48,33,0.78))] text-[#f0f4e9] p-8 sm:p-10 shadow-xl border border-[#8bab84]/28"
      >
        <PageCurl className="absolute top-0 right-0 w-16 h-16" />
        {/* фон — сетка кроссворда */}
        <div className="absolute inset-0 opacity-[0.06]">
          <div className="absolute inset-0 grid grid-cols-[repeat(20,1fr)] gap-[1px]">
            {Array.from({ length: 200 }).map((_, i) => (
              <div key={i} className={Math.random() > 0.7 ? 'bg-cafe-paper' : 'border border-cafe-paper/30'} />
            ))}
          </div>
        </div>
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-cafe-gold/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Coffee size={20} className="text-cafe-gold" />
              <span className="font-subhead text-sm uppercase tracking-[0.2em] text-cafe-gold">
                {language === 'ru' ? 'Добро пожаловать в кафе' : 'Welcome to the cafe'}
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              {language === 'ru' ? `Здравствуйте, ${user.displayName?.split(' ')[0] || 'Автор'}` : `Hello, ${user.displayName?.split(' ')[0] || 'Author'}`}
            </h1>
            <p className="font-body text-cafe-paper/60 text-lg max-w-md">
              {language === 'ru'
                ? 'Ваш столик готов. Что будем сегодня — создадим новый или решим?'
                : 'Your table is ready. Creating or solving today?'}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleCreate}
            className="flex items-center justify-center gap-3 px-7 py-4 bg-[linear-gradient(120deg,rgba(79,109,75,0.72),rgba(24,35,24,0.82))] text-[#eef5e4] font-subhead text-lg font-bold rounded-sm shadow-lg hover:shadow-xl border border-[#8bab84]/36 transition-all shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={creating}
          >
            <Feather size={22} />
            <span>{creating ? (language === 'ru' ? 'Создаем...' : 'Creating...') : t('newCrossword')}</span>
          </motion.button>
        </div>

        {/* статистика-чипсы */}
        {crosswords.length > 0 && (
          <div className="relative z-10 flex gap-6 mt-8 pt-6 border-t border-cafe-paper/10">
            <div className="flex items-center gap-2">
              <BookMarked size={16} className="text-cafe-gold/70" />
              <span className="font-mono text-sm text-cafe-paper/50">{crosswords.length}</span>
              <span className="font-body text-xs text-cafe-paper/40">{language === 'ru' ? 'кроссвордов' : 'puzzles'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-cafe-gold/70" />
              <span className="font-mono text-sm text-cafe-paper/50">{crosswords.filter(c => c.isPublished).length}</span>
              <span className="font-body text-xs text-cafe-paper/40">{language === 'ru' ? 'опубликовано' : 'published'}</span>
            </div>
          </div>
        )}
      </motion.section>

      {/* ═══ МЕНЮ КАФЕ — ШАБЛОНЫ ═══ */}
      <section className="mb-12">
        <div className="flex items-end justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookSpine className="text-cafe-leather/30" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-px bg-cafe-gold" />
                <span className="font-subhead text-xs uppercase tracking-[0.2em] text-cafe-gold font-semibold">
                  {language === 'ru' ? 'Меню' : 'Menu'}
                </span>
              </div>
              <h2 className="font-display text-2xl font-bold text-[#edf2e3]">{t('templates')}</h2>
            </div>
          </div>
          <p className="font-body text-sm text-[#d3dbc8]/70 hidden sm:block">{t('templatesDesc')}</p>
        </div>

<motion.div
          initial="hidden"
          animate="visible"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {templates.map((tpl) => (
            <motion.button
              key={tpl.id}
              onClick={() => handleCreateFromTemplate(tpl)}
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ y: -6, scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="bg-[linear-gradient(165deg,#f4eddf_0%,#ece3d2_100%)] group rounded-sm p-4 shadow-md hover:shadow-xl hover:shadow-black/20 transition-all duration-300 border border-[#c4b79f]/45 flex flex-col items-center text-center relative overflow-hidden"
            >
              {/* hover-лампа */}
              <div className="absolute inset-0 bg-gradient-to-b from-cafe-gold/0 to-cafe-gold/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div className="w-16 h-16 bg-cafe-parchment/50 rounded-sm overflow-hidden p-1.5 border border-cafe-leather/10 group-hover:border-cafe-gold/30 transition-colors mb-3 relative">
                <MiniGrid tpl={tpl} />
              </div>

               <h3 className="font-display text-sm font-semibold text-[#1f2a36] group-hover:text-[#5a7b52] transition-colors leading-tight">
                {language === 'ru' ? tpl.nameRu : tpl.name}
              </h3>
              <span className="font-mono text-[10px] text-[#3b5264]/55 mt-1">{tpl.width}×{tpl.height}</span>
            </motion.button>
          ))}
        </motion.div>
      </section>

      {/* ═══ МОИ ШАБЛОНЫ ═══ */}
      {userTemplates.length > 0 && (
        <section className="mb-12">
          <div className="flex items-end justify-between mb-6">
            <div className="flex items-center gap-3">
              <Bookmark size={24} className="text-cafe-gold/60" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-px bg-cafe-gold" />
                  <span className="font-subhead text-xs uppercase tracking-[0.2em] text-cafe-gold font-semibold">
                    {language === 'ru' ? 'Мои шаблоны' : 'My Templates'}
                  </span>
                </div>
                <h2 className="font-display text-2xl font-bold text-[#edf2e3]">{t('myTemplates')}</h2>
              </div>
            </div>
            <p className="font-body text-sm text-[#d3dbc8]/70 hidden sm:block">{t('myTemplatesDesc')}</p>
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
          >
            {userTemplates.map((tpl) => {
              const board = parseBoardState(tpl.boardState);
              return (
                <motion.button
                  key={tpl.id}
                  onClick={() => { playSound('page-turn'); navigate(`/editor/${tpl.id}`); }}
                  variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                  whileHover={{ y: -6, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="bg-[linear-gradient(165deg,#f4eddf_0%,#ece3d2_100%)] group rounded-sm p-4 shadow-md hover:shadow-xl hover:shadow-black/20 transition-all duration-300 border border-[#c4b79f]/45 flex flex-col items-center text-center relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-cafe-gold/0 to-cafe-gold/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <div className="w-16 h-16 bg-cafe-parchment/50 rounded-sm overflow-hidden p-1.5 border border-cafe-leather/10 group-hover:border-cafe-gold/30 transition-colors mb-3 relative">
                    {board && (
                      <div
                        className="grid w-full h-full gap-[0.5px]"
                        style={{
                          gridTemplateColumns: `repeat(${board.width}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${board.height}, minmax(0, 1fr))`,
                        }}
                      >
                        {board.grid.map((cell, i) => (
                          <div
                            key={i}
                            className={
                              cell.isBlock ? 'bg-cafe-leather rounded-[0.5px]'
                              : cell.isHidden ? 'bg-transparent'
                              : 'bg-cafe-paper border-[0.3px] border-cafe-leather/10 rounded-[0.5px]'
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <h3 className="font-display text-sm font-semibold text-[#1f2a36] group-hover:text-[#5a7b52] transition-colors leading-tight line-clamp-2">
                    {tpl.title}
                  </h3>
                  {board && <span className="font-mono text-[10px] text-[#3b5264]/55 mt-1">{board.width}×{board.height}</span>}
                </motion.button>
              );
            })}
          </motion.div>
        </section>
      )}

      {/* ═══ КНИЖНАЯ ПОЛКА — МОИ КРОССВОРДЫ ═══ */}
      <section>
        <div className="flex items-end justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookSpine className="text-cafe-leather/30" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-px bg-cafe-gold" />
                <span className="font-subhead text-xs uppercase tracking-[0.2em] text-cafe-gold font-semibold">
                  {language === 'ru' ? 'Полка' : 'Shelf'}
                </span>
              </div>
              <h2 className="font-display text-2xl font-bold text-[#edf2e3]">{t('dashboard')}</h2>
            </div>
          </div>
        </div>

        {/* ── loading ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 border-2 border-cafe-leather/10 border-t-cafe-gold rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Coffee size={20} className="text-cafe-leather/40" />
              </div>
            </div>
            <p className="font-subhead text-cafe-espresso/50 italic">
              {language === 'ru' ? 'Завариваем...' : 'Brewing...'}
            </p>
          </div>
        ) : crosswords.length === 0 ? (
          /* ── empty state ── */
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 bg-cafe-paper/60 rounded-sm border border-dashed border-cafe-leather/15 text-center px-6 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-cafe-lamp/5 to-transparent pointer-events-none" />

            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="relative mb-8"
            >
              <div className="w-24 h-24 bg-cafe-parchment/60 rounded-full flex items-center justify-center shadow-inner">
                <Feather size={36} className="text-cafe-leather/30" />
              </div>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Steam intensity="low" />
              </div>
            </motion.div>

            <h3 className="font-display text-2xl font-bold text-cafe-leather mb-2">
              {language === 'ru' ? 'Ваш столик пуст' : 'Your table is empty'}
            </h3>
            <p className="font-body text-cafe-espresso/50 mb-8 max-w-md leading-relaxed">
              {language === 'ru'
                ? 'Пока здесь тихо. Возьмите перо и создайте свой первый кроссворд — или выберите шаблон из меню выше.'
                : 'It\'s quiet here. Pick up the quill and create your first crossword — or choose a template from the menu above.'}
            </p>

            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleCreate}
              className="px-8 py-4 bg-cafe-leather text-cafe-paper rounded-sm font-subhead font-semibold text-lg hover:bg-cafe-espresso transition-all shadow-lg hover:shadow-xl flex items-center gap-3"
            >
              <Feather size={20} />
              {t('startBuilding')}
              <PageCurl className="ml-2 -rotate-12" />
            </motion.button>
          </motion.div>
        ) : (
          /* ── карточки кроссвордов ── */
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {crosswords.map((cw) => {
              const board = parseBoardState(cw.boardState);
              const wordCount = board ? board.clues.across.length + board.clues.down.length : 0;
              const filledLetters = board ? board.grid.filter(c => !c.isBlock && !c.isHidden && c.value).length : 0;

              return (
                <motion.div
                  key={cw.id}
                  variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                  whileHover={{ y: -5 }}
                  className="bg-cafe-paper group rounded-sm shadow-md hover:shadow-xl hover:shadow-cafe-leather/15 transition-all duration-300 border border-cafe-leather/8 flex flex-col relative overflow-hidden"
                >
                  {/* золотая полоска для published */}
                  {cw.isPublished && (
                    <div className="h-0.5 bg-gradient-to-r from-cafe-gold via-cafe-lamp to-cafe-gold" />
                  )}

                  <div className="p-5 flex-1 flex flex-col">
                    {/* заголовок + badge + actions */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-lg font-bold text-cafe-leather group-hover:text-cafe-honey transition-colors line-clamp-2 leading-snug">
                          {cw.title || t('untitled')}
                        </h3>
                        {cw.isTemplate && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono text-cafe-gold/80">
                            <Bookmark size={10} />{language === 'ru' ? 'Шаблон' : 'Template'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {cw.isPublished && (
                          <span className="badge badge-live shrink-0 text-[9px]">{t('live')}</span>
                        )}
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleToggleTemplate(cw)}
                          title={cw.isTemplate ? t('removeTemplate') : t('makeTemplate')}
                          className="p-1.5 rounded-sm text-cafe-leather/40 hover:text-cafe-gold hover:bg-cafe-leather/5 transition-all"
                        >
                          <Bookmark size={14} fill={cw.isTemplate ? 'currentColor' : 'none'} />
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDuplicate(cw)}
                          disabled={creating}
                          title={t('duplicateAsTemplate')}
                          className="p-1.5 rounded-sm text-cafe-leather/40 hover:text-cafe-honey hover:bg-cafe-leather/5 transition-all disabled:opacity-35"
                        >
                          <CopyPlus size={14} />
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => void handleDeleteCrossword(cw)}
                          title={t('deleteCrossword')}
                          className="p-1.5 rounded-sm text-cafe-leather/40 hover:text-red-500 hover:bg-red-500/5 transition-all"
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      </div>
                    </div>

                    {/* мета */}
                    <div className="flex items-center gap-4 text-[11px] font-mono text-cafe-espresso/40 mb-4">
                      <span className="flex items-center gap-1"><Clock size={11} /> <RelativeTime timestamp={cw.updatedAt} /></span>
                      {board && <span className="flex items-center gap-1"><Grid3X3 size={11} /> {board.width}×{board.height}</span>}
                      {wordCount > 0 && <span className="flex items-center gap-1"><BookOpen size={11} /> {wordCount}</span>}
                    </div>

                    {/* мини-превью сетки */}
                    {board && (
                      <div className="w-full aspect-square max-w-[140px] mx-auto bg-cafe-parchment/30 rounded-sm overflow-hidden p-1 border border-cafe-leather/5 mb-4">
                        <div
                          className="grid w-full h-full gap-[0.5px]"
                          style={{
                            gridTemplateColumns: `repeat(${board.width}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${board.height}, minmax(0, 1fr))`,
                          }}
                        >
                          {board.grid.map((cell) => (
                            <div
                              key={`${cell.x}-${cell.y}`}
                              className={
                                cell.isBlock ? 'bg-cafe-leather rounded-[0.5px]'
                                : cell.isHidden ? 'bg-transparent'
                                : cell.value
                                  ? 'bg-cafe-gold/20 border-[0.3px] border-cafe-leather/10 rounded-[0.5px]'
                                  : 'bg-cafe-paper border-[0.3px] border-cafe-leather/10 rounded-[0.5px]'
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* прогресс-бар заполнения */}
                    {board && (
                      <div className="mt-auto mb-4">
                        <div className="flex items-center justify-between text-[10px] font-mono text-cafe-espresso/40 mb-1">
                          <span>{language === 'ru' ? 'Заполнено' : 'Filled'}</span>
                          <span>{filledLetters} / {board.grid.filter(c => !c.isBlock && !c.isHidden).length}</span>
                        </div>
                        <div className="w-full h-1.5 bg-cafe-parchment/60 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${board.grid.filter(c => !c.isBlock && !c.isHidden).length > 0 ? Math.round((filledLetters / board.grid.filter(c => !c.isBlock && !c.isHidden).length) * 100) : 0}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full bg-cafe-gold/70 rounded-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* кнопки */}
                  <div className="flex items-stretch border-t border-cafe-leather/8">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { playSound('cell-select'); navigate(`/editor/${cw.id}`); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 hover:bg-cafe-leather/5 text-cafe-leather font-subhead font-semibold transition-all text-sm border-r border-cafe-leather/8"
                    >
                      <PenTool size={15} /> {t('edit')}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { playSound('page-turn'); navigate(`/play/${cw.slug ?? cw.id}`); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-cafe-leather/[0.03] hover:bg-cafe-leather text-cafe-leather hover:text-cafe-paper font-subhead font-semibold transition-all text-sm"
                    >
                      <Play size={15} /> {t('play')}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}

            {/* кнопка "New" как последняя карточка */}
            <motion.button
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ y: -5, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreate}
              className="bg-cafe-paper/50 group rounded-sm shadow-sm hover:shadow-lg border-2 border-dashed border-cafe-leather/15 hover:border-cafe-gold/40 flex flex-col items-center justify-center p-8 min-h-[280px] transition-all"
            >
              <motion.div
                animate={{ rotate: [0, 90, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-14 h-14 bg-cafe-parchment/50 rounded-full flex items-center justify-center mb-4 group-hover:bg-cafe-gold/10 transition-colors"
              >
                <Plus size={24} className="text-cafe-leather/40 group-hover:text-cafe-honey transition-colors" />
              </motion.div>
              <span className="font-subhead font-semibold text-cafe-leather/40 group-hover:text-cafe-honey transition-colors text-sm">
                {t('newCrossword')}
              </span>
            </motion.button>
          </motion.div>
        )}
      </section>
    </div>
  );
}
