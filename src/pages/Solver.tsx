import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { db, handleFirestoreError } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useCafe } from "../contexts/CafeContext";
import { BoardState, Crossword, Progress } from "../types";
import { parseBoardState } from "../lib/boardParser";
import clsx from "clsx";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  GripHorizontal,
  Play,
  Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Steam, FloatingParticles, CoffeeBean, ClockTick, SuccessBurst, LampGlow } from "../components/CafeAnimations";
import { CanvasGrid } from "../components/CanvasGrid";
import { hashString } from "../lib/crypto";

type SaveState = "idle" | "saving" | "saved" | "error";
type InkPulse = { x: number; y: number; key: number } | null;

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
  const [hasStarted, setHasStarted] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [inkPulse, setInkPulse] = useState<InkPulse>(null);
  const clueRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const saveStateTimerRef = useRef<number | null>(null);
  const inkPulseTimerRef = useRef<number | null>(null);

  const totalCells = board ? board.grid.filter((c) => !c.isBlock && !c.isHidden).length : 0;
  const totalWords = board ? board.clues.across.length + board.clues.down.length : 0;
  const hasSavedProgress = timer > 0 || Object.keys(answers).length > 0;

  useEffect(() => {
    return () => {
      if (saveStateTimerRef.current) {
        window.clearTimeout(saveStateTimerRef.current);
      }
      if (inkPulseTimerRef.current) {
        window.clearTimeout(inkPulseTimerRef.current);
      }
    };
  }, []);

  const triggerHaptic = useCallback((pattern: number | number[]) => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(pattern);
  }, []);

  const triggerInkPulse = useCallback((x: number, y: number) => {
    setInkPulse({ x, y, key: Date.now() });
    if (inkPulseTimerRef.current) {
      window.clearTimeout(inkPulseTimerRef.current);
    }
    inkPulseTimerRef.current = window.setTimeout(() => {
      setInkPulse(null);
    }, 380);
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const d = await getDoc(doc(db, "crosswords", id));
        if (!d.exists()) return;
        const data = d.data() as Crossword;
        setCw(data);
        const parsedBoard = parseBoardState(data.boardState);
        if (!parsedBoard) return;
        setBoard(parsedBoard);
        for (let y = 0; y < parsedBoard.height; y++) {
          for (let x = 0; x < parsedBoard.width; x++) {
            const c = parsedBoard.grid.find((cell) => cell.x === x && cell.y === y);
            if (c && !c.isBlock && !c.isHidden) {
              setSelectedCell({ x, y });
              return;
            }
          }
        }
      } catch (err) {
        handleFirestoreError(err, "get", `/crosswords/${id}`);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const pid = `${user.uid}_${id}`;
      setProgressId(pid);
      try {
        const pr = await getDoc(doc(db, "progress", pid));
        if (!pr.exists()) return;
        const p = pr.data() as Progress;
        let parsedAnswers: Record<string, string> = {};
        try {
          parsedAnswers = JSON.parse(p.answers || "{}") as Record<string, string>;
        } catch {
          parsedAnswers = {};
        }
        setAnswers(parsedAnswers);
        setTimer(p.timer || 0);
        setIsCompleted(Boolean(p.isCompleted));
        if ((p.timer || 0) > 0 || Object.keys(parsedAnswers).length > 0 || p.isCompleted) {
          setHasStarted(true);
        }
      } catch (err) {
        handleFirestoreError(err, "get", `/progress/${pid}`);
      }
    })();
  }, [id, user]);

  useEffect(() => {
    if (isCompleted || !cw || !hasStarted) return;
    const iv = setInterval(() => setTimer((tPrev) => tPrev + 1), 1000);
    return () => clearInterval(iv);
  }, [isCompleted, cw, hasStarted]);

  const hashUserAnswers = useCallback((userAnswers: Record<string, string>): string => {
    const sorted = Object.keys(userAnswers).sort();
    const combined = sorted
      .filter((k) => userAnswers[k] && userAnswers[k] !== "")
      .map((k) => `${k}:${userAnswers[k].toUpperCase()}`)
      .join("|");
    return hashString(combined);
  }, []);

  const checkCompletion = useCallback(async () => {
    if (!board || isCompleted || !user || !id || !hasStarted) return;

    const totalPlayable = board.grid.filter((c) => !c.isBlock && !c.isHidden).length;
    const filledCount = Object.keys(answers).filter((k) => answers[k] && answers[k] !== "").length;
    if (filledCount < totalPlayable) return;

    try {
      const cwDoc = await getDoc(doc(db, "crosswords", id));
      if (!cwDoc.exists()) return;
      const crossword = cwDoc.data() as Crossword;
      const savedHash = crossword.answersHash;
      if (!savedHash) return;
      const userHash = hashUserAnswers(answers);
      if (userHash === savedHash && !isCompleted) {
        setIsCompleted(true);
        playSound("success");
        triggerHaptic([30, 30, 45]);
      }
    } catch (error) {
      console.error("Verification failed:", error);
    }
  }, [answers, board, hasStarted, hashUserAnswers, id, isCompleted, playSound, triggerHaptic, user]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkCompletion();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [answers, checkCompletion]);

  useEffect(() => {
    if (!id || !user || !progressId || !board || !hasStarted) return;

    const tSave = setTimeout(async () => {
      setSaveState("saving");
      try {
        await setDoc(doc(db, "progress", progressId), {
          userId: user.uid,
          crosswordId: id,
          answers: JSON.stringify(answers),
          timer,
          isCompleted,
          lastUpdated: Date.now(),
        } as Progress);

        setSaveState("saved");
        if (saveStateTimerRef.current) window.clearTimeout(saveStateTimerRef.current);
        saveStateTimerRef.current = window.setTimeout(() => {
          setSaveState("idle");
        }, 1200);
      } catch (err) {
        setSaveState("error");
        handleFirestoreError(err, "create", `/progress/${progressId}`);
      }
    }, 1500);

    return () => clearTimeout(tSave);
  }, [answers, timer, isCompleted, id, user, progressId, board, hasStarted]);

  const getCell = (x: number, y: number) => board?.grid.find((c) => c.x === x && c.y === y);

  const setAnswer = (x: number, y: number, letter: string) => {
    if (isCompleted || !hasStarted) return;
    setAnswers((prev) => ({ ...prev, [`${x},${y}`]: letter }));
    if (letter) {
      playSound("letter-input");
      triggerHaptic(8);
      triggerInkPulse(x, y);
      return;
    }
    triggerHaptic(5);
  };

  const activeClueInfo = React.useMemo(() => {
    if (!selectedCell || !board) return null;
    if (direction === "across") {
      let cx = selectedCell.x;
      while (cx > 0 && !getCell(cx - 1, selectedCell.y)?.isBlock) cx--;
      const num = getCell(cx, selectedCell.y)?.number;
      if (num) return board.clues.across.find((c) => c.number === num) || null;
      return null;
    }
    let cy = selectedCell.y;
    while (cy > 0 && !getCell(selectedCell.x, cy - 1)?.isBlock) cy--;
    const num = getCell(selectedCell.x, cy)?.number;
    if (num) return board.clues.down.find((c) => c.number === num) || null;
    return null;
  }, [selectedCell, direction, board]);

  const getWordBounds = useCallback((x: number, y: number, dir: "across" | "down") => {
    if (!board) return null;
    const cell = getCell(x, y);
    if (!cell || cell.isBlock || cell.isHidden) return null;

    let startX = x;
    let startY = y;
    let endX = x;
    let endY = y;

    if (dir === "across") {
      while (startX > 0 && !getCell(startX - 1, y)?.isBlock && !getCell(startX - 1, y)?.isHidden) startX--;
      while (endX < board.width - 1 && !getCell(endX + 1, y)?.isBlock && !getCell(endX + 1, y)?.isHidden) endX++;
    } else {
      while (startY > 0 && !getCell(x, startY - 1)?.isBlock && !getCell(x, startY - 1)?.isHidden) startY--;
      while (endY < board.height - 1 && !getCell(x, endY + 1)?.isBlock && !getCell(x, endY + 1)?.isHidden) endY++;
    }

    return { startX, startY, endX, endY, length: dir === "across" ? endX - startX + 1 : endY - startY + 1 };
  }, [board]);

  const allWordBounds = React.useMemo(() => {
    if (!selectedCell || !board) return { across: null, down: null };
    const cell = getCell(selectedCell.x, selectedCell.y);
    if (!cell || cell.isBlock || cell.isHidden) return { across: null, down: null };
    return {
      across: getWordBounds(selectedCell.x, selectedCell.y, "across"),
      down: getWordBounds(selectedCell.x, selectedCell.y, "down"),
    };
  }, [selectedCell, board, getWordBounds]);

  useEffect(() => {
    if (!activeClueInfo) return;
    const keys = [
      `desktop-${direction}-${activeClueInfo.number}`,
      `mobile-${direction}-${activeClueInfo.number}`,
      `${direction}-${activeClueInfo.number}`,
    ];
    const el = keys.map((k) => clueRefs.current[k]).find(Boolean);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeClueInfo, direction]);

  const navigateClue = (delta: number) => {
    if (!board || !activeClueInfo || !hasStarted) return;
    const clues = board.clues[direction];
    const idx = clues.findIndex((c) => c.number === activeClueInfo.number);
    const next = clues[idx + delta];
    if (!next) return;
    setSelectedCell({ x: next.x, y: next.y });
    playSound("cell-select");
    triggerHaptic(8);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const progressPercent = React.useMemo(() => {
    if (!board) return 0;
    const playable = board.grid.filter((c) => !c.isBlock && !c.isHidden);
    const filled = playable.filter((c) => (answers[`${c.x},${c.y}`] || "") !== "").length;
    return playable.length > 0 ? Math.round((filled / playable.length) * 100) : 0;
  }, [answers, board]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedCell || !board || isCompleted || !hasStarted) return;
    if (e.key === "Backspace") {
      setAnswer(selectedCell.x, selectedCell.y, "");
      const move = direction === "across" ? { dx: -1, dy: 0 } : { dx: 0, dy: -1 };
      let nx = selectedCell.x + move.dx;
      let ny = selectedCell.y + move.dy;
      while (nx >= 0 && ny >= 0 && nx < board.width && ny < board.height) {
        const c = getCell(nx, ny);
        if (c && !c.isBlock && !c.isHidden) {
          setSelectedCell({ x: nx, y: ny });
          break;
        }
        nx += move.dx;
        ny += move.dy;
      }
      return;
    }

    if (/^[a-zA-Zа-яА-ЯёЁ]$/.test(e.key)) {
      setAnswer(selectedCell.x, selectedCell.y, e.key.toUpperCase());
      const move = direction === "across" ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
      let nx = selectedCell.x + move.dx;
      let ny = selectedCell.y + move.dy;
      while (nx >= 0 && ny >= 0 && nx < board.width && ny < board.height) {
        const c = getCell(nx, ny);
        if (c && !c.isBlock && !c.isHidden) {
          setSelectedCell({ x: nx, y: ny });
          break;
        }
        nx += move.dx;
        ny += move.dy;
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
      const c = getCell(x, y);
      if (c && !c.isBlock && !c.isHidden) {
        setSelectedCell({ x, y });
        triggerHaptic(6);
      }
    }
  };

  const handleCellClick = (x: number, y: number) => {
    if (!hasStarted) return;
    if (selectedCell?.x === x && selectedCell?.y === y) {
      setDirection((d) => (d === "across" ? "down" : "across"));
      triggerHaptic(10);
    } else {
      setSelectedCell({ x, y });
      playSound("cell-select");
      triggerHaptic(8);
    }
  };

  const startSession = () => {
    setHasStarted(true);
    playSound(hasSavedProgress ? "page-turn" : "book-open");
    triggerHaptic([12, 20, 12]);
  };

  const saveStatusLabel =
    saveState === "saving"
      ? t("solverAutosaveSaving")
      : saveState === "saved"
        ? t("solverAutosaveSaved")
        : saveState === "error"
          ? t("solverAutosaveError")
          : t("solverReady");

  if (!board || !cw) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-cafe-cream gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-cafe-leather/10 border-t-cafe-gold rounded-full"
        />
        <p className="font-subhead text-cafe-espresso/50 italic">{language === "ru" ? "Завариваем кроссворд..." : "Brewing your puzzle..."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[radial-gradient(circle_at_12%_8%,rgba(176,141,87,0.14),transparent_42%),radial-gradient(circle_at_88%_84%,rgba(63,42,36,0.16),transparent_38%),linear-gradient(180deg,#ece7de_0%,#d8d0c2_100%)] overflow-hidden relative" onKeyDown={handleKeyDown} tabIndex={0}>
      {effectsEnabled && <FloatingParticles count={6} className="opacity-15 z-0" />}
      {effectsEnabled && <LampGlow className="opacity-35" intensity="soft" />}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[50%] bg-cafe-lamp/8 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-8%] w-[45%] h-[45%] bg-cafe-wine/6 blur-[90px] rounded-full" />
      </div>

      <AnimatePresence>
        {isCompleted && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-cafe-leather/70 backdrop-blur-lg" />
            {effectsEnabled &&
              Array.from({ length: 16 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ x: Math.random() * 600 - 300, y: 350, opacity: 0, rotate: 0 }}
                  animate={{ y: -500, opacity: [0, 1, 0], rotate: 720 }}
                  transition={{ duration: 3 + Math.random() * 2, delay: Math.random() * 0.8, repeat: Infinity }}
                  className="absolute w-3 h-4"
                >
                  <CoffeeBean count={1} className="text-cafe-gold/60" />
                </motion.div>
              ))}

            <motion.div
              initial={{ scale: 0.88, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.55 }}
              className="relative bg-cafe-paper rounded-sm shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            >
              <div className="h-1.5 bg-gradient-to-r from-cafe-gold via-cafe-lamp to-cafe-gold" />
              <SuccessBurst className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

              <div className="p-10 sm:p-12 flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <Steam intensity="high" className="absolute -top-6 left-1/2 -translate-x-1/2" />
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", bounce: 0.6, delay: 0.25 }}
                    className="w-20 h-20 bg-cafe-gold/10 rounded-full flex items-center justify-center"
                  >
                    <Trophy size={40} className="text-cafe-gold drop-shadow-lg" />
                  </motion.div>
                </div>

                <h2 className="font-display text-4xl font-bold text-cafe-leather mb-2">{t("congrats")}</h2>
                <p className="font-body text-cafe-espresso/60 mb-8 text-lg">
                  {t("solvedIn")} <span className="text-cafe-honey font-bold font-mono">{formatTime(timer)}</span>
                </p>

                <div className="flex gap-6 mb-8">
                  {[
                    { label: language === "ru" ? "Время" : "Time", value: formatTime(timer) },
                    { label: language === "ru" ? "Слов" : "Words", value: `${totalWords}` },
                    { label: language === "ru" ? "Клеток" : "Cells", value: `${totalCells}` },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <div className="font-mono text-xl font-bold text-cafe-leather">{s.value}</div>
                      <div className="font-subhead text-xs text-cafe-espresso/40 uppercase tracking-wider">{s.label}</div>
                    </div>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    playSound("page-turn");
                    window.location.href = "/";
                  }}
                  className="w-full py-4 bg-cafe-leather text-cafe-paper rounded-sm font-subhead font-bold text-lg hover:bg-cafe-espresso transition-all shadow-lg"
                >
                  {t("returnToPuzzles")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-14 flex items-center justify-between px-4 sm:px-6 bg-cafe-paper/75 backdrop-blur-xl border-b border-cafe-leather/10 shrink-0 relative z-20">
        <div className="flex items-center gap-3 min-w-0">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => (window.location.href = "/")}
            className="text-cafe-espresso/40 hover:text-cafe-leather transition-colors p-1.5 hover:bg-cafe-leather/5 rounded-sm"
          >
            <ArrowLeft size={18} />
          </motion.button>
          <div className="h-5 w-px bg-cafe-leather/10" />
          <h1 className="text-lg font-display font-bold text-cafe-leather truncate">{cw.title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-cafe-espresso/70 bg-[linear-gradient(120deg,rgba(255,255,255,0.78),rgba(228,221,210,0.66))] border border-cafe-leather/15 px-2.5 py-1 rounded-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
            <span>{t("solverProgress")}</span>
            <span className="font-bold text-cafe-leather">{progressPercent}%</span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-cafe-leather bg-[linear-gradient(120deg,rgba(243,238,230,0.88),rgba(255,255,255,0.82))] px-2.5 py-1 rounded-sm border border-cafe-leather/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
            <ClockTick className="text-cafe-gold" />
            <span>{formatTime(timer)}</span>
          </div>

          <div
            className={clsx(
              "hidden md:flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border",
              saveState === "saving" && "text-cafe-honey border-cafe-gold/25 bg-cafe-gold/10",
              saveState === "saved" && "text-emerald-700 border-emerald-200 bg-emerald-50",
              saveState === "error" && "text-cafe-wine border-cafe-wine/20 bg-cafe-wine/10",
              saveState === "idle" && "text-cafe-espresso/55 border-cafe-leather/10 bg-cafe-paper/70"
            )}
          >
            {saveState === "saved" && <Check size={12} />}
            <span>{saveStatusLabel}</span>
          </div>

          {!user && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={login}
              className="px-3 py-1.5 text-xs font-subhead font-semibold bg-cafe-leather text-cafe-paper rounded-sm hover:bg-cafe-espresso transition-all"
            >
              {t("saveProgress")}
            </motion.button>
          )}
        </div>
      </div>

      <div className="relative h-1.5 bg-cafe-leather/8 z-20">
        <motion.div
          initial={false}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          className="h-full bg-[linear-gradient(90deg,#6f4f23_0%,#b08d57_52%,#7a5a2a_100%)] shadow-[0_0_14px_rgba(176,141,87,0.42)]"
        />
      </div>

      <div className={clsx("flex-1 overflow-hidden flex flex-col xl:flex-row p-0 sm:p-4 md:p-6 gap-4 xl:gap-6 max-w-[1700px] mx-auto w-full relative z-10 xl:items-start", !hasStarted && "blur-[1px]") }>
        <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto overflow-x-hidden p-3 pb-[22rem] xl:pb-4 max-h-[85vh] xl:sticky xl:top-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="xl:hidden w-full max-w-[600px] mb-3 flex items-stretch bg-cafe-paper rounded-sm border border-cafe-leather/10 shadow-md overflow-hidden"
          >
            <button
              onClick={() => navigateClue(-1)}
              className="w-10 flex items-center justify-center text-cafe-espresso/30 hover:text-cafe-honey hover:bg-cafe-leather/5 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 px-3 py-2.5 flex items-center gap-2 cursor-pointer min-w-0" onClick={() => setDirection((d) => (d === "across" ? "down" : "across"))}>
              <span className="font-display font-bold text-cafe-gold text-base shrink-0">{activeClueInfo?.number}</span>
              <span className="font-body text-sm text-cafe-leather leading-tight truncate">{activeClueInfo?.text || "..."}</span>
              <span className="text-cafe-espresso/30 shrink-0 ml-auto">{direction === "across" ? <ArrowRight size={14} /> : <ArrowDown size={14} />}</span>
            </div>
            <button
              onClick={() => navigateClue(1)}
              className="w-10 flex items-center justify-center text-cafe-espresso/30 hover:text-cafe-honey hover:bg-cafe-leather/5 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </motion.div>

          <motion.div
            whileTap={{ scale: 0.998 }}
            transition={{ duration: 0.12 }}
            className="relative w-full max-w-[680px] rounded-sm border border-cafe-leather/18 p-2 bg-[linear-gradient(165deg,rgba(252,250,245,0.94)_0%,rgba(224,216,204,0.76)_100%)] shadow-[0_20px_50px_rgba(31,24,18,0.2)]"
            style={{ aspectRatio: "1/1" }}
          >
            <CanvasGrid
              board={board}
              selectedCell={selectedCell}
              direction={direction}
              allWordBounds={allWordBounds}
              onCellClick={handleCellClick}
              answers={answers}
              isCompleted={isCompleted}
            />
            <AnimatePresence>
              {inkPulse && (
                <motion.span
                  key={inkPulse.key}
                  initial={{ opacity: 0.5, scale: 0.1 }}
                  animate={{ opacity: 0, scale: 2.2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.38, ease: "easeOut" }}
                  className="pointer-events-none absolute block rounded-full bg-cafe-gold/45"
                  style={{
                    width: `${100 / board.width}%`,
                    height: `${100 / board.height}%`,
                    left: `${(inkPulse.x * 100) / board.width}%`,
                    top: `${(inkPulse.y * 100) / board.height}%`,
                    transformOrigin: "50% 50%",
                  }}
                />
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="hidden xl:flex w-full max-w-[680px] mt-5 items-stretch bg-[linear-gradient(145deg,rgba(255,255,255,0.86),rgba(229,221,208,0.74))] backdrop-blur-xl rounded-sm border border-cafe-leather/14 shadow-xl overflow-hidden"
          >
            <button onClick={() => navigateClue(-1)} className="w-14 flex items-center justify-center hover:bg-cafe-leather/5 transition-all text-cafe-espresso/30 hover:text-cafe-honey">
              <ChevronLeft size={24} />
            </button>
            <div className="flex-1 px-5 py-3.5 flex items-center gap-4 cursor-pointer hover:bg-cafe-leather/[0.02] transition-colors" onClick={() => setDirection((d) => (d === "across" ? "down" : "across"))}>
              <span className="font-display font-bold text-cafe-gold text-xl w-8 text-right shrink-0">{activeClueInfo?.number}</span>
              <span className="font-body text-cafe-leather text-lg leading-snug">{activeClueInfo?.text || <span className="text-cafe-espresso/30 italic text-base">{t("noClue")}</span>}</span>
              <span className="text-cafe-espresso/30 shrink-0 ml-auto">{direction === "across" ? <ArrowRight size={20} /> : <ArrowDown size={20} />}</span>
            </div>
            <button onClick={() => navigateClue(1)} className="w-14 flex items-center justify-center hover:bg-cafe-leather/5 transition-all text-cafe-espresso/30 hover:text-cafe-honey">
              <ChevronRight size={24} />
            </button>
          </motion.div>
        </div>

        <div
          className={clsx(
            "w-full xl:w-[560px] shrink-0 xl:h-[calc(100vh-7rem)] fixed bottom-0 left-0 right-0 xl:static bg-[linear-gradient(165deg,rgba(247,243,236,0.98)_0%,rgba(214,206,194,0.95)_100%)] z-20 xl:z-10 shadow-[0_-14px_40px_rgba(30,22,16,0.14)] xl:shadow-[0_16px_34px_rgba(30,22,16,0.16)] border-t border-cafe-leather/14 xl:border xl:border-cafe-leather/12 xl:rounded-sm flex flex-col overflow-hidden transition-[height] duration-300",
            sheetExpanded ? "h-[78vh]" : "h-[46vh]",
            "xl:h-[calc(100vh-7rem)]"
          )}
        >
          <button
            onClick={() => setSheetExpanded((v) => !v)}
            className="xl:hidden h-8 border-b border-cafe-leather/8 flex items-center justify-center text-cafe-espresso/40 hover:text-cafe-leather transition-colors"
          >
            <GripHorizontal size={18} />
          </button>

          <div className="xl:hidden px-3 pt-3 pb-2 border-b border-cafe-leather/12 bg-[linear-gradient(145deg,rgba(250,248,243,0.72),rgba(223,214,200,0.46))] backdrop-blur-md">
            <div className="relative grid grid-cols-2 rounded-sm border border-cafe-leather/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.5),rgba(217,208,193,0.32))] p-1">
              <motion.div
                initial={false}
                animate={{ x: direction === "across" ? "0%" : "100%" }}
                transition={{ type: "spring", stiffness: 240, damping: 28 }}
                className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-sm bg-[linear-gradient(140deg,rgba(176,141,87,0.52)_0%,rgba(93,78,54,0.24)_100%)] border border-[#8c6a3b]/45 shadow-[0_5px_16px_rgba(111,79,35,0.26)]"
              />
              {(["across", "down"] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => {
                    setDirection(dir);
                    triggerHaptic(10);
                  }}
                  className={clsx(
                    "relative z-10 h-10 flex items-center justify-center gap-2 rounded-sm text-sm font-subhead font-bold tracking-[0.06em] transition-colors",
                    direction === dir ? "text-cafe-leather" : "text-cafe-espresso/60"
                  )}
                >
                  {dir === "across" ? <ArrowRight size={14} /> : <ArrowDown size={14} />}
                  {t(dir)}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden xl:grid xl:grid-cols-2 gap-3 p-3 border-b border-cafe-leather/12 bg-[linear-gradient(145deg,rgba(252,250,246,0.6),rgba(220,212,199,0.42))] backdrop-blur-md">
            {(["across", "down"] as const).map((dir) => {
              const accent = dir === "across" ? "from-[#d8b06a]/45" : "from-[#6c8197]/35";
              const active = direction === dir;
              return (
                <button
                  key={dir}
                  type="button"
                  onClick={() => {
                    setDirection(dir);
                    triggerHaptic(10);
                  }}
                  className={clsx(
                    "relative rounded-sm border px-4 py-2.5 text-left transition-all",
                    active
                      ? `border-[#8c6a3b]/45 bg-[linear-gradient(140deg,rgba(246,240,228,0.95)_0%,rgba(255,255,255,0.82)_100%)] shadow-[0_8px_20px_rgba(91,66,35,0.24)]`
                      : `border-cafe-leather/20 bg-[linear-gradient(140deg,rgba(255,255,255,0.82)_0%,rgba(226,218,206,0.62)_100%)] hover:border-[#8c6a3b]/35`
                  )}
                >
                  <span className={clsx("absolute inset-0 rounded-sm bg-gradient-to-r to-transparent opacity-35", accent)} />
                  <span className="relative flex items-center justify-between">
                    <span className="flex items-center gap-2 font-subhead text-sm font-bold tracking-[0.08em] text-cafe-leather uppercase">
                      {dir === "across" ? <ArrowRight size={14} /> : <ArrowDown size={14} />}
                      {t(dir)}
                    </span>
                    <span className="font-mono text-xs text-cafe-espresso/55">{board.clues[dir].length}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-hidden xl:grid xl:grid-cols-2 xl:gap-3 xl:p-3">
            {(["across", "down"] as const).map((dir) => {
              const accentRail = dir === "across" ? "from-[#c79a4a]/70" : "from-[#617a93]/65";
              return (
                <motion.section
                  key={dir}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={clsx(
                    "flex flex-col h-full overflow-hidden",
                    direction !== dir ? "hidden xl:flex" : "flex",
                    "xl:rounded-sm xl:border xl:border-cafe-leather/12 xl:bg-[linear-gradient(160deg,rgba(255,255,255,0.7),rgba(225,217,204,0.56))] xl:backdrop-blur-md"
                  )}
                >
                  <div className="px-4 py-3 border-b border-cafe-leather/12 bg-[linear-gradient(140deg,rgba(255,255,255,0.74)_0%,rgba(217,209,195,0.6)_100%)]">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-display text-xl leading-none text-cafe-leather tracking-tight flex items-center gap-2">
                        {dir === "across" ? <ArrowRight size={17} className="text-cafe-honey" /> : <ArrowDown size={17} className="text-cafe-honey" />}
                        {t(dir)}
                      </h2>
                      <span className="font-mono text-xs px-2 py-1 rounded-sm bg-cafe-leather/8 text-cafe-espresso/70">
                        {board.clues[dir].length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto scroll-smooth px-1 py-1">
                    {board.clues[dir].map((clue, index) => {
                      const isActive = activeClueInfo?.number === clue.number && direction === dir;
                      const refKey = `desktop-${dir}-${clue.number}`;
                      const mobileRefKey = `mobile-${dir}-${clue.number}`;
                      return (
                        <motion.button
                          key={`${dir}-${clue.number}`}
                          type="button"
                          ref={(el) => {
                            clueRefs.current[refKey] = el;
                            clueRefs.current[mobileRefKey] = el;
                          }}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(index * 0.012, 0.18) }}
                          whileHover={{ x: 1.5 }}
                          whileTap={{ scale: 0.985 }}
                          onClick={() => {
                            if (!hasStarted) return;
                            setSelectedCell({ x: clue.x, y: clue.y });
                            setDirection(dir);
                            playSound("cell-select");
                            triggerHaptic(10);
                          }}
                          className={clsx(
                            "relative w-full text-left grid grid-cols-[42px_1fr] gap-2.5 items-start px-3 py-3 rounded-sm transition-all border border-transparent",
                            isActive
                              ? "bg-[linear-gradient(96deg,rgba(176,141,87,0.26)_0%,rgba(238,233,225,0.84)_45%,rgba(255,255,255,0.9)_100%)] border-[#8c6a3b]/35 shadow-[0_8px_20px_rgba(101,76,44,0.2)]"
                              : "hover:bg-[linear-gradient(96deg,rgba(255,255,255,0.72),rgba(229,221,208,0.52))] hover:border-cafe-leather/14"
                          )}
                        >
                          <span className={clsx("font-display text-lg leading-none pt-0.5 text-right", isActive ? "text-cafe-honey" : "text-cafe-leather/65")}>{clue.number}</span>
                          <span className={clsx("font-body text-[15px] leading-relaxed", isActive ? "text-cafe-leather" : "text-cafe-espresso")}>{clue.text || <span className="text-cafe-espresso/40 italic">{t("noClue")}</span>}</span>
                          {isActive && (
                            <>
                              <motion.span
                                layoutId="active-clue-rail"
                                className={clsx("absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-sm bg-gradient-to-b to-transparent", accentRail)}
                              />
                              <span className="pointer-events-none absolute inset-y-0 right-2 w-12 bg-gradient-to-l from-cafe-gold/22 to-transparent" />
                            </>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.section>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {!hasStarted && !isCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 pt-14 flex items-center justify-center px-4"
          >
            <div className="absolute inset-0 bg-cafe-leather/35 backdrop-blur-[2px]" />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="relative max-w-lg w-full rounded-sm bg-cafe-paper border border-cafe-leather/10 shadow-2xl overflow-hidden"
            >
              <div className="h-1.5 bg-gradient-to-r from-cafe-gold/20 via-cafe-gold to-cafe-gold/20" />
              <div className="p-8 sm:p-9 text-center">
                <div className="w-16 h-16 rounded-full bg-cafe-gold/10 border border-cafe-gold/20 text-cafe-honey flex items-center justify-center mx-auto mb-5">
                  <Coffee size={28} />
                </div>
                <p className="font-subhead text-xs uppercase tracking-[0.22em] text-cafe-honey mb-2">{t("solverPreludeTagline")}</p>
                <h2 className="font-display text-3xl text-cafe-leather mb-3">{cw.title}</h2>
                <p className="font-body text-cafe-espresso/70 leading-relaxed mb-6">{t("solverPreludeDesc")}</p>

                <div className="grid grid-cols-3 gap-2.5 mb-7 text-left">
                  <div className="bg-cafe-parchment/45 border border-cafe-leather/10 rounded-sm px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-cafe-espresso/50">{language === "ru" ? "Слов" : "Words"}</div>
                    <div className="font-display text-xl text-cafe-leather">{totalWords}</div>
                  </div>
                  <div className="bg-cafe-parchment/45 border border-cafe-leather/10 rounded-sm px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-cafe-espresso/50">{language === "ru" ? "Клеток" : "Cells"}</div>
                    <div className="font-display text-xl text-cafe-leather">{totalCells}</div>
                  </div>
                  <div className="bg-cafe-parchment/45 border border-cafe-leather/10 rounded-sm px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-cafe-espresso/50">{language === "ru" ? "Формат" : "Grid"}</div>
                    <div className="font-display text-xl text-cafe-leather">{board.width}x{board.height}</div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startSession}
                  className="w-full py-3.5 bg-cafe-leather text-cafe-paper rounded-sm font-subhead font-bold text-lg hover:bg-cafe-espresso transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Play size={18} />
                  {hasSavedProgress ? t("solverResume") : t("solverStart")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
