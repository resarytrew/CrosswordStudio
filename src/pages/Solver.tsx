import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { db, handleFirestoreError } from "../lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { BoardState, Crossword, Progress } from "../types";
import clsx from "clsx";
import {
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function Solver() {
  const { id } = useParams();
  const { user, login } = useAuth();
  const { t } = useLanguage();
  const [cw, setCw] = useState<Crossword | null>(null);
  const [board, setBoard] = useState<BoardState | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timer, setTimer] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progressId, setProgressId] = useState<string | null>(null);

  const [selectedCell, setSelectedCell] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [direction, setDirection] = useState<"across" | "down">("across");

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const d = await getDoc(doc(db, "crosswords", id!));
        if (d.exists()) {
          const data = d.data() as Crossword;
          setCw(data);
          const b = JSON.parse(data.boardState) as BoardState;
          setBoard(b);

          // Find first empty play cell
          for (let y = 0; y < b.height; y++) {
            let found = false;
            for (let x = 0; x < b.width; x++) {
              const c = b.grid.find((c) => c.x === x && c.y === y);
              if (c && !c.isBlock && !c.isHidden) {
                setSelectedCell({ x, y });
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
      } catch (err) {
        handleFirestoreError(err, "get", `/crosswords/${id}`);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    async function loadProgress() {
      const pid = `${user!.uid}_${id}`;
      setProgressId(pid);
      try {
        const pr = await getDoc(doc(db, "progress", pid));
        if (pr.exists()) {
          const pData = pr.data() as Progress;
          setAnswers(JSON.parse(pData.answers));
          setTimer(pData.timer);
          setIsCompleted(pData.isCompleted);
        }
      } catch (err) {
        handleFirestoreError(err, "get", `/progress/${pid}`);
      }
    }
    loadProgress();
  }, [id, user]);

  // Timer
  useEffect(() => {
    if (isCompleted || !cw) return;
    const interval = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isCompleted, cw]);

  // Check completion
  useEffect(() => {
    if (!board || isCompleted) return;
    let completed = true;
    for (const cell of board.grid) {
      if (!cell.isBlock) {
        const ans = answers[`${cell.x},${cell.y}`] || "";
        if (ans !== cell.value) {
          completed = false;
          break;
        }
      }
    }
    if (completed && Object.keys(answers).length > 0) {
      setIsCompleted(true);
    }
  }, [answers, board, isCompleted]);

  // Save progress
  useEffect(() => {
    if (!id || !user || !progressId || !board) return;
    const save = setTimeout(async () => {
      const p: Progress = {
        userId: user.uid,
        crosswordId: id,
        answers: JSON.stringify(answers),
        timer,
        isCompleted,
        lastUpdated: Date.now(),
      };
      try {
        await setDoc(doc(db, "progress", progressId), p);
      } catch (err) {
        handleFirestoreError(err, "create", `/progress/${progressId}`);
      }
    }, 2000);
    return () => clearTimeout(save);
  }, [answers, timer, isCompleted, id, user, progressId, board]);

  const setAnswer = (x: number, y: number, letter: string) => {
    if (isCompleted) return;
    setAnswers((prev) => ({ ...prev, [`${x},${y}`]: letter }));
  };

  const getCell = (x: number, y: number) =>
    board?.grid.find((c) => c.x === x && c.y === y);

  const activeClueInfo = React.useMemo(() => {
    if (!selectedCell || !board) return null;
    let num = null;
    if (direction === "across") {
      let cx = selectedCell.x;
      while (cx > 0 && !getCell(cx - 1, selectedCell.y)?.isBlock) cx--;
      num = getCell(cx, selectedCell.y)?.number;
      if (num) return board.clues.across.find((c) => c.number === num);
    } else {
      let cy = selectedCell.y;
      while (cy > 0 && !getCell(selectedCell.x, cy - 1)?.isBlock) cy--;
      num = getCell(selectedCell.x, cy)?.number;
      if (num) return board.clues.down.find((c) => c.number === num);
    }
    return null;
  }, [selectedCell, direction, board]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedCell || !board || isCompleted) return;
    const cell = getCell(selectedCell.x, selectedCell.y);
    if (!cell) return;

    if (e.key === "Backspace") {
      setAnswer(selectedCell.x, selectedCell.y, "");
      if (direction === "across") {
        let nx = selectedCell.x - 1;
        while (
          nx >= 0 &&
          (getCell(nx, selectedCell.y)?.isBlock ||
            getCell(nx, selectedCell.y)?.isHidden)
        )
          nx--;
        if (nx >= 0) setSelectedCell({ x: nx, y: selectedCell.y });
      } else {
        let ny = selectedCell.y - 1;
        while (
          ny >= 0 &&
          (getCell(selectedCell.x, ny)?.isBlock ||
            getCell(selectedCell.x, ny)?.isHidden)
        )
          ny--;
        if (ny >= 0) setSelectedCell({ x: selectedCell.x, y: ny });
      }
      return;
    }

    if (/^[a-zA-Zа-яА-ЯёЁ]$/.test(e.key)) {
      setAnswer(selectedCell.x, selectedCell.y, e.key.toUpperCase());
      if (direction === "across") {
        let nx = selectedCell.x + 1;
        while (
          nx < board.width &&
          (getCell(nx, selectedCell.y)?.isBlock ||
            getCell(nx, selectedCell.y)?.isHidden)
        )
          nx++;
        if (nx < board.width) setSelectedCell({ x: nx, y: selectedCell.y });
      } else {
        let ny = selectedCell.y + 1;
        while (
          ny < board.height &&
          (getCell(selectedCell.x, ny)?.isBlock ||
            getCell(selectedCell.x, ny)?.isHidden)
        )
          ny++;
        if (ny < board.height) setSelectedCell({ x: selectedCell.x, y: ny });
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

      const target = getCell(x, y);
      if (target && !target.isBlock && !target.isHidden)
        setSelectedCell({ x, y });
    }
  };

  const handleCellClick = (x: number, y: number) => {
    if (selectedCell?.x === x && selectedCell?.y === y) {
      setDirection((d) => (d === "across" ? "down" : "across"));
    } else {
      setSelectedCell({ x, y });
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = React.useMemo(() => {
    if (!board) return 0;
    const filledCount = Object.entries(answers).filter(([k, v]) => {
      const [x, y] = k.split(",").map(Number);
      const cell = board.grid.find((c) => c.x === x && c.y === y);
      return cell && !cell.isBlock && !cell.isHidden && v !== "";
    }).length;
    const totalPlayCells = board.grid.filter(
      (c) => !c.isBlock && !c.isHidden,
    ).length;
    return totalPlayCells > 0
      ? Math.round((filledCount / totalPlayCells) * 100)
      : 0;
  }, [answers, board]);

  if (!board || !cw)
    return (
      <div className="p-8 text-center animate-pulse">{t("loadingPuzzle")}</div>
    );

  return (
    <div
      className="flex flex-col h-full bg-[#f8fafc] overflow-hidden relative"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Premium Abstract Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/30 blur-[100px] rounded-full mix-blend-multiply" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-200/30 blur-[100px] rounded-full mix-blend-multiply" />
        <div className="absolute top-[20%] left-[40%] w-[40%] h-[40%] bg-emerald-100/30 blur-[80px] rounded-full mix-blend-multiply" />
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[40px]" />
      </div>

      <AnimatePresence>
        {isCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 border border-slate-200/50"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: 360 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
              >
                <CheckCircle2
                  size={80}
                  className="text-emerald-500 mb-6 drop-shadow-sm"
                />
              </motion.div>
              <h2 className="tracking-tight text-4xl font-black text-slate-900 mb-2">
                {t("congrats")}
              </h2>
              <p className="text-slate-500 font-medium mb-8 text-center text-lg">
                {t("solvedIn")}{" "}
                <span className="text-indigo-600 font-bold">
                  {formatTime(timer)}
                </span>
              </p>
              <button
                onClick={() => (window.location.href = "/")}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-md active:scale-[0.98] text-lg"
              >
                {t("returnToPuzzles")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-16 flex items-center justify-between px-6 bg-white/70 backdrop-blur-xl border-b border-white/40 shadow-[0_4px_30px_rgba(0,0,0,0.03)] shrink-0 relative z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => (window.location.href = "/")}
            className="text-slate-500 hover:text-slate-900 transition-colors p-1.5 hover:bg-white/50 rounded-lg active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            {cw.title}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {t("result") || "RESULT"}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2.5 bg-slate-200/50 rounded-full overflow-hidden border border-slate-200/30">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-sm font-extrabold text-slate-700 min-w-[32px] text-right">
                {progressPercent}%
              </div>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2 text-slate-700 font-mono font-bold bg-white/60 px-3 py-1.5 rounded-lg border border-white/50 shadow-sm">
            <Clock size={16} className="text-indigo-500" />
            <span>{formatTime(timer)}</span>
          </div>
          {!user && (
            <button
              onClick={login}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-sm active:scale-95 transition-all outline outline-1 outline-indigo-500/10 max-h-[36px]"
            >
              {t("saveProgress")}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col xl:flex-row p-0 sm:p-4 md:p-6 lg:p-8 xl:p-10 gap-6 xl:gap-8 max-w-[1800px] mx-auto w-full relative z-10 xl:items-start">
        {/* Play Area */}
        <div className="flex-1 flex flex-col items-center justify-start bg-transparent overflow-y-auto overflow-x-hidden p-4 pb-[20rem] xl:pb-4 max-h-[85vh] xl:sticky xl:top-6">
          {/* Active Clue display on mobile */}
          <div
            className="xl:hidden w-full max-w-[600px] bg-white p-4 mb-4 rounded-xl border border-white/60 shadow-lg text-center flex flex-col gap-1 cursor-pointer"
            onClick={() =>
              setDirection((d) => (d === "across" ? "down" : "across"))
            }
          >
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500 flex items-center justify-center gap-1">
              {activeClueInfo?.number} {direction}{" "}
              {direction === "across" ? (
                <ArrowRight size={12} />
              ) : (
                <ArrowDown size={12} />
              )}
            </span>
            <span className="text-sm font-bold text-slate-900 leading-tight">
              {activeClueInfo?.text || "..."}
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95, rotateX: 5 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
            className="gap-[1px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] relative bg-slate-900 border border-slate-900"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${board.width}, 1fr)`,
              width: "min(100%, 750px)",
              aspectRatio: "1/1",
            }}
          >
            {board.grid.map((cell) => {
              let isInWord = false;
              if (selectedCell && !cell.isBlock && activeClueInfo) {
                if (direction === "across") {
                  if (
                    cell.y === selectedCell.y &&
                    cell.x >= activeClueInfo.x &&
                    cell.x < activeClueInfo.x + activeClueInfo.length
                  ) {
                    isInWord = true;
                  }
                } else {
                  if (
                    cell.x === selectedCell.x &&
                    cell.y >= activeClueInfo.y &&
                    cell.y < activeClueInfo.y + activeClueInfo.length
                  ) {
                    isInWord = true;
                  }
                }
              }

              const isSelected =
                selectedCell?.x === cell.x && selectedCell?.y === cell.y;
              const ans = answers[`${cell.x},${cell.y}`] || "";

              return (
                <div
                  key={`${cell.x}-${cell.y}`}
                  onClick={() =>
                    !cell.isBlock &&
                    !cell.isHidden &&
                    handleCellClick(cell.x, cell.y)
                  }
                  className={clsx(
                    "relative flex items-center justify-center select-none text-slate-900",
                    cell.isBlock && !cell.isHidden && "bg-[#00609c]",
                    cell.isHidden && "bg-transparent",
                    !cell.isBlock &&
                      !cell.isHidden &&
                      isSelected &&
                      "bg-[#ffdd33] z-10 cursor-text outline outline-2 outline-orange-500",
                    !cell.isBlock &&
                      !cell.isHidden &&
                      !isSelected &&
                      isInWord &&
                      "bg-[#f4f0a6] z-0 cursor-pointer",
                    !cell.isBlock &&
                      !cell.isHidden &&
                      !isSelected &&
                      !isInWord &&
                      "bg-white z-0 cursor-pointer hover:bg-slate-50",
                  )}
                >
                  {cell.number && !cell.isBlock && !cell.isHidden && (
                    <span className="absolute top-[2px] left-[3px] text-[10px] sm:text-[12px] font-bold leading-none text-slate-900 pointer-events-none select-none z-10">
                      {cell.number}
                    </span>
                  )}
                  {!cell.isBlock && !cell.isHidden && (
                    <input
                      type="text"
                      maxLength={1}
                      value={ans}
                      readOnly={isCompleted}
                      className={clsx(
                        "absolute inset-0 w-full h-full text-center bg-transparent text-xl md:text-3xl font-extrabold uppercase cursor-pointer outline-none caret-transparent pb-0.5",
                        isCompleted && ans === cell.value
                          ? "text-emerald-600 drop-shadow-sm"
                          : "text-slate-900",
                      )}
                      onClick={() =>
                        !cell.isBlock &&
                        !cell.isHidden &&
                        handleCellClick(cell.x, cell.y)
                      }
                      onChange={(e) => {
                        if (isCompleted) return;
                        const val = e.target.value.slice(-1);
                        if (/^[a-zA-Zа-яА-ЯёЁ]$/.test(val)) {
                          // simulate key press to reuse logic
                          setAnswer(cell.x, cell.y, val.toUpperCase());
                          if (direction === "across") {
                            let nx = cell.x + 1;
                            while (
                              nx < board.width &&
                              (getCell(nx, cell.y)?.isBlock ||
                                getCell(nx, cell.y)?.isHidden)
                            )
                              nx++;
                            if (nx < board.width)
                              setSelectedCell({ x: nx, y: cell.y });
                          } else {
                            let ny = cell.y + 1;
                            while (
                              ny < board.height &&
                              (getCell(cell.x, ny)?.isBlock ||
                                getCell(cell.x, ny)?.isHidden)
                            )
                              ny++;
                            if (ny < board.height)
                              setSelectedCell({ x: cell.x, y: ny });
                          }
                        } else if (val === "") {
                          setAnswer(cell.x, cell.y, "");
                        }
                      }}
                      onKeyDown={(e) => {
                        if (isCompleted) return;
                        if (e.key === "Backspace" && ans === "") {
                          // Handle backspace when empty
                          if (direction === "across") {
                            let nx = cell.x - 1;
                            while (
                              nx >= 0 &&
                              (getCell(nx, cell.y)?.isBlock ||
                                getCell(nx, cell.y)?.isHidden)
                            )
                              nx--;
                            if (nx >= 0) setSelectedCell({ x: nx, y: cell.y });
                          } else {
                            let ny = cell.y - 1;
                            while (
                              ny >= 0 &&
                              (getCell(cell.x, ny)?.isBlock ||
                                getCell(cell.x, ny)?.isHidden)
                            )
                              ny--;
                            if (ny >= 0) setSelectedCell({ x: cell.x, y: ny });
                          }
                        } else if (e.key.startsWith("Arrow")) {
                          e.preventDefault();
                          let { x, y } = cell;
                          if (e.key === "ArrowUp") y = Math.max(0, y - 1);
                          if (e.key === "ArrowDown")
                            y = Math.min(board.height - 1, y + 1);
                          if (e.key === "ArrowLeft") x = Math.max(0, x - 1);
                          if (e.key === "ArrowRight")
                            x = Math.min(board.width - 1, x + 1);
                          setSelectedCell({ x, y });
                        }
                      }}
                    />
                  )}
                </div>
              );
            })}
          </motion.div>

          {/* Active clue display on Desktop (below grid) */}
          <div className="hidden xl:flex w-full max-w-[750px] mt-8 bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/60 overflow-hidden items-stretch p-1">
            <button
              onClick={() => {
                // Previous clue roughly
                const clues = board.clues[direction];
                if (!activeClueInfo || !clues) return;
                const idx = clues.findIndex(
                  (c) => c.number === activeClueInfo.number,
                );
                if (idx > 0) {
                  const prev = clues[idx - 1];
                  setSelectedCell({ x: prev.x, y: prev.y });
                }
              }}
              className="w-16 flex items-center justify-center rounded-xl hover:bg-white transition-all text-slate-400 hover:text-indigo-600 active:bg-slate-50 hover:shadow-sm"
            >
              <ChevronLeft size={28} />
            </button>
            <div
              className="flex-1 px-6 py-4 flex items-center justify-center gap-4 cursor-pointer hover:bg-white/50 transition-colors rounded-xl"
              onClick={() =>
                setDirection((d) => (d === "across" ? "down" : "across"))
              }
            >
              <div className="font-black text-indigo-500 text-2xl w-10 text-right shrink-0">
                {activeClueInfo?.number}
              </div>
              <div className="text-slate-900 text-xl font-bold text-center leading-tight">
                {activeClueInfo?.text || (
                  <span className="text-slate-400 italic text-base">
                    {t("noClue")}
                  </span>
                )}
              </div>
              <div className="text-slate-400 w-10 shrink-0 flex justify-end">
                {direction === "across" ? (
                  <ArrowRight size={24} />
                ) : (
                  <ArrowDown size={24} />
                )}
              </div>
            </div>
            <button
              onClick={() => {
                // Next clue roughly
                const clues = board.clues[direction];
                if (!activeClueInfo || !clues) return;
                const idx = clues.findIndex(
                  (c) => c.number === activeClueInfo.number,
                );
                if (idx < clues.length - 1) {
                  const next = clues[idx + 1];
                  setSelectedCell({ x: next.x, y: next.y });
                }
              }}
              className="w-16 flex items-center justify-center rounded-xl hover:bg-white transition-all text-slate-400 hover:text-indigo-600 active:bg-slate-50 hover:shadow-sm"
            >
              <ChevronRight size={28} />
            </button>
          </div>
        </div>

        {/* Clues Pane */}
        <div className="w-full xl:w-[500px] shrink-0 xl:h-[85vh] fixed bottom-0 left-0 right-0 xl:static h-[45vh] bg-white z-20 xl:z-10 shadow-[0_-20px_40px_rgba(0,0,0,0.1)] xl:shadow-sm border-t border-slate-300 xl:border flex flex-col overflow-hidden">
          {["across", "down"].map((dir, i) => (
            <div
              key={dir}
              className="bg-white flex flex-col flex-1 overflow-hidden border-b border-slate-300 last:border-b-0"
            >
              <div className="px-4 py-1.5 bg-[#52bad5] sticky top-0 z-10 shrink-0">
                <h2 className="font-normal text-base uppercase tracking-wide flex items-center gap-2 text-white">
                  {t(dir)} :
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-0 flex flex-col relative scroll-smooth">
                {board.clues[dir as "across" | "down"].map((clue) => {
                  const isActive =
                    activeClueInfo?.number === clue.number &&
                    direction === dir;
                  return (
                    <div
                      key={clue.number}
                      className={clsx(
                        "flex gap-3 text-[14.5px] px-3 py-[2px] cursor-pointer border",
                        isActive
                          ? "bg-[#cce3a6] border-slate-400 text-black shadow-none"
                          : "border-transparent bg-white hover:bg-slate-50 text-black",
                      )}
                      onClick={() => {
                        setSelectedCell({ x: clue.x, y: clue.y });
                        setDirection(dir as "across" | "down");
                      }}
                    >
                      <div className="flex flex-col items-end min-w-[24px] pr-1 shrink-0">
                        <span className="font-bold">
                          {clue.number}
                        </span>
                      </div>
                      <span className="font-normal leading-snug">
                        {clue.text || (
                          <span className="text-slate-400 italic">
                            {t("noClue")}
                          </span>
                        )}
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
