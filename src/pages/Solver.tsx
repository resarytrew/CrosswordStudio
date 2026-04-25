import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { db, handleFirestoreError } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useCafe } from "../contexts/CafeContext";
import { BoardState, Crossword, Progress } from "../types";
import clsx from "clsx";
import {
  Clock, CheckCircle2, ArrowRight, ArrowDown, ArrowLeft,
  ChevronLeft, ChevronRight, Coffee, BookOpen, Feather, Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Steam, FloatingParticles, CoffeeBean } from "../components/CafeAnimations";
import { CanvasGrid } from "../components/CanvasGrid";
import { CanvasGrid } from "../components/CanvasGrid";

/* ═══════════════════════════════════════════════════════════════
   SOLVER  — Читальный зал Кафе Эрудитов
   ═══════════════════════════════════════════════════════════════ */
export function Solver() {
  const { id } = useParams();
  const { user, login } = useAuth();
  const { language, t } = useLanguage();
  const { playSound, effectsEnabled } = useCafe();

  const [cw, setCw] = useState<Crossword | null>(null);
  const [board, setBoard] = useState<BoardState | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timer, setTimer] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null);
  const [direction, setDirection] = useState<"across" | "down">("across");
  const [recentCell, setRecentCell] = useState<string | null>(null);
  const clueRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ── DATA LOADING ── */
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const d = await getDoc(doc(db, "crosswords", id));
        if (!d.exists()) return;
        const data = d.data() as Crossword;
        setCw(data);
        const b = JSON.parse(data.boardState) as BoardState;
        setBoard(b);
        for (let y = 0; y < b.height; y++) {
          for (let x = 0; x < b.width; x++) {
            const c = b.grid.find(c => c.x === x && c.y === y);
            if (c && !c.isBlock && !c.isHidden) { setSelectedCell({ x, y }); return; }
          }
        }
      } catch (err) { handleFirestoreError(err, "get", `/crosswords/${id}`); }
    })();
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const pid = `${user.uid}_${id}`;
      setProgressId(pid);
      try {
        const pr = await getDoc(doc(db, "progress", pid));
        if (pr.exists()) {
          const p = pr.data() as Progress;
          setAnswers(JSON.parse(p.answers));
          setTimer(p.timer);
          setIsCompleted(p.isCompleted);
        }
      } catch (err) { handleFirestoreError(err, "get", `/progress/${pid}`); }
    })();
  }, [id, user]);

  /* ── TIMER ── */
  useEffect(() => {
    if (isCompleted || !cw) return;
    const iv = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [isCompleted, cw]);

  /* ── COMPLETION CHECK ── */
  useEffect(() => {
    if (!board || isCompleted) return;
    let ok = true;
    for (const cell of board.grid) {
      if (!cell.isBlock && !cell.isHidden) {
        if ((answers[`${cell.x},${cell.y}`] || "") !== cell.value) { ok = false; break; }
      }
    }
    if (ok && Object.keys(answers).length > 0) { setIsCompleted(true); playSound("success"); }
  }, [answers, board, isCompleted]);

  /* ── SAVE PROGRESS ── */
  useEffect(() => {
    if (!id || !user || !progressId || !board) return;
    const t = setTimeout(async () => {
      try {
        await setDoc(doc(db, "progress", progressId), {
          userId: user.uid, crosswordId: id,
          answers: JSON.stringify(answers), timer, isCompleted, lastUpdated: Date.now(),
        } as Progress);
      } catch (err) { handleFirestoreError(err, "create", `/progress/${progressId}`); }
    }, 2000);
    return () => clearTimeout(t);
  }, [answers, timer, isCompleted, id, user, progressId, board]);

  /* ── HELPERS ── */
  const getCell = (x: number, y: number) => board?.grid.find(c => c.x === x && c.y === y);

  const setAnswer = (x: number, y: number, letter: string) => {
    if (isCompleted) return;
    setAnswers(prev => ({ ...prev, [`${x},${y}`]: letter }));
    if (letter) {
      playSound("letter-input");
      setRecentCell(`${x},${y}`);
      setTimeout(() => setRecentCell(null), 300);
    }
  };

  const activeClueInfo = React.useMemo(() => {
    if (!selectedCell || !board) return null;
    if (direction === "across") {
      let cx = selectedCell.x;
      while (cx > 0 && !getCell(cx - 1, selectedCell.y)?.isBlock) cx--;
      const num = getCell(cx, selectedCell.y)?.number;
      if (num) return board.clues.across.find(c => c.number === num) || null;
    } else {
      let cy = selectedCell.y;
      while (cy > 0 && !getCell(selectedCell.x, cy - 1)?.isBlock) cy--;
      const num = getCell(selectedCell.x, cy)?.number;
      if (num) return board.clues.down.find(c => c.number === num) || null;
    }
    return null;
  }, [selectedCell, direction, board]);

  const getWordBounds = useCallback((x: number, y: number, dir: 'across' | 'down') => {
    if (!board) return null;
    const cell = getCell(x, y);
    if (!cell || cell.isBlock || cell.isHidden) return null;
    
    let startX = x, startY = y;
    let endX = x, endY = y;
    
    if (dir === 'across') {
      while (startX > 0 && !getCell(startX - 1, y)?.isBlock && !getCell(startX - 1, y)?.isHidden) startX--;
      while (endX < board.width - 1 && !getCell(endX + 1, y)?.isBlock && !getCell(endX + 1, y)?.isHidden) endX++;
    } else {
      while (startY > 0 && !getCell(x, startY - 1)?.isBlock && !getCell(x, startY - 1)?.isHidden) startY--;
      while (endY < board.height - 1 && !getCell(x, endY + 1)?.isBlock && !getCell(x, endY + 1)?.isHidden) endY++;
    }
    
    return { startX, startY, endX, endY, length: dir === 'across' ? endX - startX + 1 : endY - startY + 1 };
  }, [board, getCell]);

  const allWordBounds = React.useMemo(() => {
    if (!selectedCell || !board) return { across: null, down: null };
    const cell = getCell(selectedCell.x, selectedCell.y);
    if (!cell || cell.isBlock || cell.isHidden) return { across: null, down: null };
    return {
      across: getWordBounds(selectedCell.x, selectedCell.y, 'across'),
      down: getWordBounds(selectedCell.x, selectedCell.y, 'down')
    };
  }, [selectedCell, board, getWordBounds]);

  /* scroll active clue into view */
  useEffect(() => {
    if (!activeClueInfo) return;
    const key = `${direction}-${activeClueInfo.number}`;
    const el = clueRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeClueInfo, direction]);

  const navigateClue = (delta: number) => {
    if (!board || !activeClueInfo) return;
    const clues = board.clues[direction];
    const idx = clues.findIndex(c => c.number === activeClueInfo.number);
    const next = clues[idx + delta];
    if (next) { setSelectedCell({ x: next.x, y: next.y }); playSound("cell-select"); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const progressPercent = React.useMemo(() => {
    if (!board) return 0;
    const play = board.grid.filter(c => !c.isBlock && !c.isHidden);
    const filled = play.filter(c => (answers[`${c.x},${c.y}`] || "") !== "").length;
    return play.length > 0 ? Math.round((filled / play.length) * 100) : 0;
  }, [answers, board]);

  /* ── KEYBOARD ── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedCell || !board || isCompleted) return;
    if (e.key === "Backspace") {
      setAnswer(selectedCell.x, selectedCell.y, "");
      const move = direction === "across"
        ? { dx: -1, dy: 0 } : { dx: 0, dy: -1 };
      let nx = selectedCell.x + move.dx, ny = selectedCell.y + move.dy;
      while (nx >= 0 && ny >= 0 && nx < board.width && ny < board.height) {
        const c = getCell(nx, ny);
        if (c && !c.isBlock && !c.isHidden) { setSelectedCell({ x: nx, y: ny }); break; }
        nx += move.dx; ny += move.dy;
      }
      return;
    }
    if (/^[a-zA-Zа-яА-ЯёЁ]$/.test(e.key)) {
      setAnswer(selectedCell.x, selectedCell.y, e.key.toUpperCase());
      const move = direction === "across" ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
      let nx = selectedCell.x + move.dx, ny = selectedCell.y + move.dy;
      while (nx >= 0 && ny >= 0 && nx < board.width && ny < board.height) {
        const c = getCell(nx, ny);
        if (c && !c.isBlock && !c.isHidden) { setSelectedCell({ x: nx, y: ny }); break; }
        nx += move.dx; ny += move.dy;
      }
      return;
    }
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      let { x, y } = selectedCell;
      if (e.key === "ArrowUp") y = Math.max(0, y - 1);
      if (e.key === "ArrowDown") y = Math.min(board.height - 1, y + 1);
      if (e.key === "ArrowLeft") x = Math.max(0, x - 1);
      if (e.key === "ArrowRight") x = Math.min(board.width - 1, x + 1);
      const t = getCell(x, y);
      if (t && !t.isBlock && !t.isHidden) setSelectedCell({ x, y });
    }
  };

  const handleCellClick = (x: number, y: number) => {
    if (selectedCell?.x === x && selectedCell?.y === y) {
      setDirection(d => d === "across" ? "down" : "across");
    } else {
      setSelectedCell({ x, y });
      playSound("cell-select");
    }
  };

  /* ── LOADING ── */
  if (!board || !cw) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-cafe-cream gap-4">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-2 border-cafe-leather/10 border-t-cafe-gold rounded-full" />
      <p className="font-subhead text-cafe-espresso/50 italic">{language === "ru" ? "Завариваем кроссворд..." : "Brewing your puzzle..."}</p>
    </div>
  );

  const totalCells = board.grid.filter(c => !c.isBlock && !c.isHidden).length;

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full bg-cafe-cream overflow-hidden relative" onKeyDown={handleKeyDown} tabIndex={0}>

      {/* ── ambient background ── */}
      {effectsEnabled && <FloatingParticles count={6} className="opacity-15 z-0" />}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[50%] bg-cafe-lamp/8 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-8%] w-[45%] h-[45%] bg-cafe-wine/6 blur-[90px] rounded-full" />
      </div>

      {/* ═══ VICTORY OVERLAY ═══ */}
      <AnimatePresence>
        {isCompleted && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-cafe-leather/70 backdrop-blur-lg" />

            {/* floating beans */}
            {effectsEnabled && Array.from({ length: 20 }).map((_, i) => (
              <motion.div key={i}
                initial={{ x: Math.random() * 600 - 300, y: 400, opacity: 0, rotate: 0 }}
                animate={{ y: -600, opacity: [0, 1, 0], rotate: 720 }}
                transition={{ duration: 3 + Math.random() * 2, delay: Math.random() * 0.8, repeat: Infinity }}
                className="absolute w-3 h-4"
              >
                <CoffeeBean count={1} className="text-cafe-gold/60" />
              </motion.div>
            ))}

            <motion.div
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.4, delay: 0.1 }}
              className="relative bg-cafe-paper rounded-sm shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            >
              <div className="h-1.5 bg-gradient-to-r from-cafe-gold via-cafe-lamp to-cafe-gold" />

              <div className="p-10 sm:p-12 flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <Steam intensity="high" className="absolute -top-6 left-1/2 -translate-x-1/2" />
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", bounce: 0.6, delay: 0.3 }}
                    className="w-20 h-20 bg-cafe-gold/10 rounded-full flex items-center justify-center"
                  >
                    <Trophy size={40} className="text-cafe-gold drop-shadow-lg" />
                  </motion.div>
                </div>

                <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  className="font-display text-4xl font-bold text-cafe-leather mb-2">{t("congrats")}</motion.h2>

                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                  className="font-body text-cafe-espresso/60 mb-8 text-lg">
                  {t("solvedIn")} <span className="text-cafe-honey font-bold font-mono">{formatTime(timer)}</span>
                </motion.p>

                {/* stats row */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                  className="flex gap-6 mb-8">
                  {[
                    { label: language === "ru" ? "Время" : "Time", value: formatTime(timer) },
                    { label: language === "ru" ? "Слов" : "Words", value: `${board.clues.across.length + board.clues.down.length}` },
                    { label: language === "ru" ? "Клеток" : "Cells", value: `${totalCells}` },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <div className="font-mono text-xl font-bold text-cafe-leather">{s.value}</div>
                      <div className="font-subhead text-xs text-cafe-espresso/40 uppercase tracking-wider">{s.label}</div>
                    </div>
                  ))}
                </motion.div>

                <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { playSound("page-turn"); window.location.href = "/"; }}
                  className="w-full py-4 bg-cafe-leather text-cafe-paper rounded-sm font-subhead font-bold text-lg hover:bg-cafe-espresso transition-all shadow-lg">
                  {t("returnToPuzzles")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ HEADER BAR ═══ */}
      <div className="h-14 flex items-center justify-between px-4 sm:px-6 bg-cafe-paper/80 backdrop-blur-xl border-b border-cafe-leather/8 shrink-0 relative z-20">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => (window.location.href = "/")}
            className="text-cafe-espresso/40 hover:text-cafe-leather transition-colors p-1.5 hover:bg-cafe-leather/5 rounded-sm">
            <ArrowLeft size={18} />
          </motion.button>
          <div className="h-5 w-px bg-cafe-leather/10" />
          <h1 className="text-lg font-display font-bold text-cafe-leather truncate max-w-[200px] sm:max-w-none">{cw.title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* progress ring */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="relative w-8 h-8">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-cafe-leather/8" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-cafe-gold"
                  strokeDasharray={`${progressPercent * 0.94} 100`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-cafe-leather">{progressPercent}</span>
            </div>
          </div>

          <div className="h-5 w-px bg-cafe-leather/10 hidden sm:block" />

          {/* timer */}
          <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-cafe-leather bg-cafe-parchment/40 px-2.5 py-1 rounded-sm border border-cafe-leather/8">
            <Clock size={13} className="text-cafe-gold" />
            <span>{formatTime(timer)}</span>
          </div>

          {!user && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={login}
              className="px-3 py-1.5 text-xs font-subhead font-semibold bg-cafe-leather text-cafe-paper rounded-sm hover:bg-cafe-espresso transition-all">
              {t("saveProgress")}
            </motion.button>
          )}
        </div>
      </div>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 overflow-hidden flex flex-col xl:flex-row p-0 sm:p-4 md:p-6 gap-4 xl:gap-6 max-w-[1700px] mx-auto w-full relative z-10 xl:items-start">

        {/* ── LEFT: GRID AREA ── */}
        <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto overflow-x-hidden p-3 pb-[22rem] xl:pb-4 max-h-[85vh] xl:sticky xl:top-4">

          {/* mobile clue bar */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="xl:hidden w-full max-w-[600px] mb-3 flex items-stretch bg-cafe-paper rounded-sm border border-cafe-leather/10 shadow-md overflow-hidden"
          >
            <button onClick={() => navigateClue(-1)} className="w-10 flex items-center justify-center text-cafe-espresso/30 hover:text-cafe-honey hover:bg-cafe-leather/5 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 px-3 py-2.5 flex items-center gap-2 cursor-pointer min-w-0"
              onClick={() => setDirection(d => d === "across" ? "down" : "across")}>
              <span className="font-display font-bold text-cafe-gold text-base shrink-0">{activeClueInfo?.number}</span>
              <span className="font-body text-sm text-cafe-leather leading-tight truncate">{activeClueInfo?.text || "..."}</span>
              <span className="text-cafe-espresso/30 shrink-0 ml-auto">
                {direction === "across" ? <ArrowRight size={14} /> : <ArrowDown size={14} />}
              </span>
            </div>
            <button onClick={() => navigateClue(1)} className="w-10 flex items-center justify-center text-cafe-espresso/30 hover:text-cafe-honey hover:bg-cafe-leather/5 transition-colors">
              <ChevronRight size={20} />
            </button>
</motion.div>

          {/* ── THE GRID ── */}
          <div className="w-full max-w-[680px]" style={{ aspectRatio: '1/1' }}>
            <CanvasGrid
              board={board}
              selectedCell={selectedCell}
              direction={direction}
              allWordBounds={allWordBounds}
              onCellClick={handleCellClick}
              answers={answers}
isCompleted={isCompleted}
            />
          </div>

          {/* ── desktop clue bar (below grid) ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="hidden xl:flex w-full max-w-[680px] mt-5 items-stretch bg-cafe-paper/80 backdrop-blur-xl rounded-sm border border-cafe-leather/8 shadow-lg overflow-hidden">
            <button onClick={() => navigateClue(-1)}
              className="w-14 flex items-center justify-center hover:bg-cafe-leather/5 transition-all text-cafe-espresso/30 hover:text-cafe-honey">
              <ChevronLeft size={24} />
            </button>
            <div className="flex-1 px-5 py-3.5 flex items-center gap-4 cursor-pointer hover:bg-cafe-leather/[0.02] transition-colors"
              onClick={() => setDirection(d => d === "across" ? "down" : "across")}>
              <span className="font-display font-bold text-cafe-gold text-xl w-8 text-right shrink-0">{activeClueInfo?.number}</span>
              <span className="font-body text-cafe-leather text-lg leading-snug">{activeClueInfo?.text || <span className="text-cafe-espresso/30 italic text-base">{t("noClue")}</span>}</span>
              <span className="text-cafe-espresso/30 shrink-0 ml-auto">
                {direction === "across" ? <ArrowRight size={20} /> : <ArrowDown size={20} />}
              </span>
            </div>
            <button onClick={() => navigateClue(1)}
              className="w-14 flex items-center justify-center hover:bg-cafe-leather/5 transition-all text-cafe-espresso/30 hover:text-cafe-honey">
              <ChevronRight size={24} />
            </button>
          </motion.div>
        </div>

        {/* ── RIGHT: CLUES PANEL ── */}
        <div className="w-full xl:w-[480px] shrink-0 xl:h-[calc(100vh-7rem)] fixed bottom-0 left-0 right-0 xl:static h-[42vh] bg-cafe-paper z-20 xl:z-10 shadow-[0_-10px_30px_rgba(44,24,16,0.08)] xl:shadow-lg border-t border-cafe-leather/10 xl:border xl:border-cafe-leather/8 xl:rounded-sm flex flex-col overflow-hidden">

          {(["across", "down"] as const).map(dir => (
            <div key={dir} className="flex flex-col flex-1 overflow-hidden border-b border-cafe-leather/5 last:border-b-0">
              {/* section header */}
              <div className="px-4 py-2.5 bg-cafe-leather/[0.03] border-b border-cafe-leather/10 sticky top-0 z-10 shrink-0 flex items-center justify-between">
                <h2 className="font-subhead text-sm font-bold uppercase tracking-[0.15em] text-cafe-leather/70 flex items-center gap-2">
                  {dir === "across" ? <ArrowRight size={13} /> : <ArrowDown size={13} />}
                  {t(dir)}
                </h2>
                <span className="font-mono text-[10px] text-cafe-leather/40">{board.clues[dir].length}</span>
              </div>

              {/* clue list */}
              <div className="flex-1 overflow-y-auto scroll-smooth">
                {board.clues[dir].map(clue => {
                  const isActive = activeClueInfo?.number === clue.number && direction === dir;
                  const refKey = `${dir}-${clue.number}`;
                  return (
                    <div key={clue.number}
                      ref={el => { clueRefs.current[refKey] = el; }}
                      onClick={() => { setSelectedCell({ x: clue.x, y: clue.y }); setDirection(dir); playSound("cell-select"); }}
                      className={clsx(
                        "flex gap-2.5 px-4 py-2.5 cursor-pointer transition-all duration-150 border-l-[3px]",
                        isActive
                          ? "bg-cafe-gold/15 border-l-cafe-gold text-cafe-leather"
                          : "border-l-transparent hover:bg-cafe-parchment/50 text-cafe-leather/85",
                      )}
                    >
                      <span className={clsx("font-display font-bold text-sm min-w-[22px] text-right shrink-0", isActive ? "text-cafe-gold" : "text-cafe-leather/60")}>
                        {clue.number}
                      </span>
                      <span className="font-body text-[13.5px] leading-relaxed text-cafe-espresso">
                        {clue.text || <span className="text-cafe-espresso/35 italic">{t("noClue")}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}