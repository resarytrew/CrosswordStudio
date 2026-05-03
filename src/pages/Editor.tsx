import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { db, handleFirestoreError } from '../lib/firebase';
import { deleteField, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCafe } from '../contexts/CafeContext';
import { BoardState, Crossword, GridCell, type CrosswordDifficulty, type CrosswordVisibility } from '../types';
import { updateGridNumbers } from '../lib/gridUtils';
import { computeAnswersHash } from '../lib/crypto';
import { parseBoardState } from '../lib/boardParser';
import { Save, Share2, ArrowLeft, ArrowRight, ArrowDown, Trash2, LayoutGrid, Hash, CheckSquare, AlertTriangle, Image, Undo2, Redo2, Eraser, Square, EyeOff, Globe, Link2, Lock, Copy } from 'lucide-react';
import { BookSpine } from '../components/CafeAnimations';
import { useConfirm } from '../components/ConfirmDialog';
import { allocateUniqueShareSlug, removeShareLink, upsertShareLink } from '../lib/shareLinkWrites';
import { playUrl, previewUrl } from '../lib/shareUrls';
import { CanvasGrid } from '../components/CanvasGrid';
import clsx from 'clsx';
import { motion } from 'framer-motion';

type EditorSnapshot = {
  board: BoardState;
  title: string;
};

export function Editor() {
  const { id } = useParams();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { playSound } = useCafe();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [cw, setCw] = useState<Crossword | null>(null);
  const [board, setBoard] = useState<BoardState | null>(null);
  
  const [selectedCell, setSelectedCell] = useState<{x: number, y: number} | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  const [mobileCluePanel, setMobileCluePanel] = useState<'across' | 'down'>('across');
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [visibilitySetting, setVisibilitySetting] = useState<CrosswordVisibility>('private');
  const [difficultySetting, setDifficultySetting] = useState<CrosswordDifficulty>('medium');
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const hasLoadedRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const lastToastTimeRef = useRef(0);
  /** Prefer slug over UUID for clipboard links after save */
  const shareLinkKeyRef = useRef('');

  const triggerHaptic = useCallback((pattern: number | number[]) => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(pattern);
  }, []);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const cloneBoard = useCallback((source: BoardState): BoardState => ({
    ...source,
    grid: source.grid.map((cell) => ({ ...cell })),
    clues: {
      across: source.clues.across.map((clue) => ({ ...clue })),
      down: source.clues.down.map((clue) => ({ ...clue })),
    },
  }), []);

  const createSnapshot = useCallback((sourceBoard: BoardState, sourceTitle: string): EditorSnapshot => ({
    board: cloneBoard(sourceBoard),
    title: sourceTitle,
  }), [cloneBoard]);

  useEffect(() => {
    if (!id || !user) return;
    async function load() {
      try {
        const d = await getDoc(doc(db, 'crosswords', id!));
        if (d.exists()) {
          const data = d.data() as Crossword;
          if (data.authorId !== user!.uid) {
            navigate('/');
            return;
          }
          setCw(data);
          setTitle(data.title);
          setVisibilitySetting(data.visibility ?? (data.isPublished ? 'link' : 'private'));
          setDifficultySetting(data.difficulty ?? 'medium');
          shareLinkKeyRef.current = data.slug ?? id ?? '';
          const parsed = parseBoardState(data.boardState);
          if (parsed) {
            setBoard(parsed);
          }
          setUndoStack([]);
          setRedoStack([]);
          setIsDirty(false);
          hasLoadedRef.current = true;
        }
      } catch (err) {
        handleFirestoreError(err, 'get', `/crosswords/${id}`);
      }
    }
    load();
  }, [id, user, navigate]);

  const save = useCallback(async (currentBoard: BoardState, currentTitle: string, publishOverride?: boolean) => {
    if (!id || !user) return false;
    let success = true;
    setSaving(true);
    try {
      const answersHash = computeAnswersHash(currentBoard);
      let nextPublished = cw?.isPublished ?? false;
      if (publishOverride !== undefined) nextPublished = publishOverride;
      if (visibilitySetting === 'private') nextPublished = false;

      const shareable =
        visibilitySetting === 'link' || visibilitySetting === 'public' || nextPublished;

      let nextSlug = cw?.slug;
      try {
        if (shareable && !nextSlug) {
          nextSlug = await allocateUniqueShareSlug();
        }
        if (!shareable && cw?.slug) {
          await removeShareLink(cw.slug);
          nextSlug = undefined;
        }
      } catch (e) {
        console.error(e);
        toast.error(language === 'ru' ? 'Не удалось обновить короткую ссылку' : 'Could not update share link');
        success = false;
        return false;
      }

      const updates: Record<string, unknown> = {
        title: currentTitle,
        boardState: currentBoard,
        answersHash,
        updatedAt: Date.now(),
        visibility: visibilitySetting,
        difficulty: difficultySetting,
        authorDisplayName: user.displayName ?? '',
        isPublished: nextPublished,
        slug: nextSlug ?? deleteField(),
      };

      if (publishOverride !== undefined && publishOverride) {
        playSound('achievement');
      }

      try {
        await updateDoc(doc(db, 'crosswords', id), updates);
        if (nextSlug) {
          const ok = await upsertShareLink(nextSlug, id);
          if (!ok) success = false;
        }
        const linkKey = nextSlug ?? cw?.slug ?? id ?? '';
        shareLinkKeyRef.current = linkKey;
        setCw((prev) =>
          prev
            ? {
                ...prev,
                title: currentTitle,
                boardState: currentBoard,
                answersHash,
                updatedAt: Date.now(),
                slug: nextSlug,
                visibility: visibilitySetting,
                difficulty: difficultySetting,
                isPublished: nextPublished,
                authorDisplayName: user.displayName ?? '',
              }
            : prev
        );
      } catch (err) {
        success = false;
        handleFirestoreError(err, 'update', `/crosswords/${id}`);
      }
    } finally {
      setSaving(false);
      playSound('save');
    }
    return success;
  }, [id, user, playSound, cw, visibilitySetting, difficultySetting, language]);

  const getCell = (x: number, y: number) => board?.grid.find(c => c.x === x && c.y === y);

  const stats = React.useMemo(() => {
    if (!board) return null;
    let blockCount = 0;
    let hiddenCount = 0;
    let letterCount = 0;
    board.grid.forEach(c => {
      if (c.isBlock) blockCount++;
      else if (c.isHidden) hiddenCount++;
      else if (c.value) letterCount++;
    });
    
    const totalCells = board.width * board.height;
    const visibleCells = totalCells - hiddenCount;
    const playableCells = board.grid.filter(c => !c.isBlock && !c.isHidden).length;
    const blockPercentage = visibleCells > 0 ? Math.round((blockCount / visibleCells) * 100) : 0;
    
    const emptyClues = [
       ...board.clues.across,
       ...board.clues.down
    ].filter(c => !c.text.trim()).length;
    
    const wordCount = board.clues.across.length + board.clues.down.length;

    let isConnected = true;
    const firstPlayCell = board.grid.find(c => !c.isBlock && !c.isHidden);
    if (firstPlayCell) {
       const visited = new Set<string>();
       const queue = [firstPlayCell];
       visited.add(`${firstPlayCell.x},${firstPlayCell.y}`);
       
       while(queue.length > 0) {
          const curr = queue.shift()!;
          const neighbors = [
             [curr.x+1, curr.y],
             [curr.x-1, curr.y],
             [curr.x, curr.y+1],
             [curr.x, curr.y-1],
          ];
          for(let [nx, ny] of neighbors) {
             const key = `${nx},${ny}`;
             if (!visited.has(key)) {
                const nCell = board.grid.find(c => c.x === nx && c.y === ny);
                if (nCell && !nCell.isBlock && !nCell.isHidden) {
                   visited.add(key);
                   queue.push(nCell);
                }
             }
          }
       }
       isConnected = visited.size === playableCells;
    }

    return { blockPercentage, emptyClues, wordCount, letterCount, playableCells, isConnected };
  }, [board]);

  const getPublishIssues = useCallback(() => {
    if (!board || !stats) return [];

    const issues: string[] = [];
    if (!title.trim()) {
      issues.push(language === 'ru' ? 'Добавьте название перед публикацией' : 'Add a title before publishing');
    }
    if (stats.wordCount === 0) {
      issues.push(language === 'ru' ? 'Добавьте в сетку хотя бы одно слово' : 'Add at least one word to the grid');
    }
    if (stats.emptyClues > 0) {
      issues.push(language === 'ru' ? 'Заполните все подсказки перед публикацией' : 'Fill in all clues before publishing');
    }
    if (stats.letterCount < stats.playableCells) {
      issues.push(language === 'ru' ? 'Заполните все игровые клетки перед публикацией' : 'Fill in all playable cells before publishing');
    }
    if (!stats.isConnected) {
      issues.push(language === 'ru' ? 'Убедитесь, что сетка связная' : 'Make sure the grid is fully connected');
    }
    return issues;
  }, [board, stats, title, language]);

  const clearGrid = async () => {
    if (!board) return;
    const ok = await confirm({
      title: language === 'ru' ? 'Очистить сетку?' : 'Clear grid?',
      message: `${t('clearGrid')}?`,
      confirmLabel: language === 'ru' ? 'Очистить' : 'Clear',
      cancelLabel: language === 'ru' ? 'Отмена' : 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    setUndoStack((prev) => [...prev.slice(-49), createSnapshot(board, title)]);
    setRedoStack([]);
    const newGrid = board.grid.map(c => ({...c, value: ''}));
    setBoard({ ...board, grid: newGrid });
    setIsDirty(true);
  };

  const getWordBounds = React.useCallback((x: number, y: number, dir: 'across' | 'down') => {
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

  useEffect(() => {
    setMobileCluePanel(direction);
  }, [direction]);

  useEffect(() => {
    if (!hasLoadedRef.current || !board || !isDirty) return;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(async () => {
      const success = await save(board, title);
      if (success) {
        setIsDirty(false);
        const now = Date.now();
        if (now - lastToastTimeRef.current > 10000) {
          lastToastTimeRef.current = now;
          toast.info(language === 'ru' ? 'Черновик автосохранён' : 'Draft autosaved');
        }
      } else {
        toast.error(language === 'ru' ? 'Автосохранение не удалось' : 'Autosave failed');
      }
    }, 1400);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [board, title, isDirty, save, language]);

  if (!board) return <div className="p-8 text-center animate-pulse font-body text-cafe-espresso/60">{t('loadingEditor')}</div>;

  const currentCell = selectedCell ? getCell(selectedCell.x, selectedCell.y) : null;
  const selectedLabel = selectedCell
    ? `${language === 'ru' ? 'Строка' : 'Row'} ${selectedCell.y + 1} • ${language === 'ru' ? 'Колонка' : 'Col'} ${selectedCell.x + 1}`
    : null;

  const commitBoardChange = (nextBoard: BoardState) => {
    setUndoStack((prev) => [...prev.slice(-49), createSnapshot(board, title)]);
    setRedoStack([]);
    setBoard(nextBoard);
    setIsDirty(true);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev.slice(-49), createSnapshot(board, title)]);
    setBoard(cloneBoard(previous.board));
    setTitle(previous.title);
    setIsDirty(true);
    toast.info(language === 'ru' ? 'Отменено последнее изменение' : 'Reverted the latest change');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev.slice(-49), createSnapshot(board, title)]);
    setBoard(cloneBoard(next.board));
    setTitle(next.title);
    setIsDirty(true);
    toast.info(language === 'ru' ? 'Изменение возвращено' : 'Change restored');
  };

  const handleCellClick = (x: number, y: number) => {
    if (selectedCell?.x === x && selectedCell?.y === y) {
      setDirection(d => d === 'across' ? 'down' : 'across');
      triggerHaptic(10);
    } else {
      setSelectedCell({ x, y });
      playSound('cell-select');
      triggerHaptic(8);
    }
  };

  const handleResize = (newSize: number) => {
    if (!board) return;
    const newWidth = newSize;
    const newHeight = newSize;
    
    const newGrid: GridCell[] = [];
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const existing = board.grid.find(c => c.x === x && c.y === y);
        if (existing) {
          newGrid.push(existing);
        } else {
          newGrid.push({ x, y, isBlock: false, value: '', number: null });
        }
      }
    }
  
    let newBoard: BoardState = {
      ...board,
      width: newWidth,
      height: newHeight,
      grid: newGrid
    };
    
    newBoard = updateGridNumbers(newBoard);
    
    if (selectedCell && (selectedCell.x >= newWidth || selectedCell.y >= newHeight)) {
      setSelectedCell(null);
    }
    
    commitBoardChange(newBoard);
  };

  const setBlock = (x: number, y: number, isBlock: boolean) => {
    const rx = board.width - 1 - x;
    const ry = board.height - 1 - y;
    
    let newGrid = [...board.grid];
    newGrid = newGrid.map(c => {
      if ((c.x === x && c.y === y) || (c.x === rx && c.y === ry)) {
        return { ...c, isBlock, value: isBlock ? '' : c.value, isHidden: false };
      }
      return c;
    });
    
    let newBoard = { ...board, grid: newGrid };
    newBoard = updateGridNumbers(newBoard);
    commitBoardChange(newBoard);
    playSound('block-toggle');
    triggerHaptic([10, 16, 10]);
  };

  const setHidden = (x: number, y: number, isHidden: boolean) => {
    const rx = board.width - 1 - x;
    const ry = board.height - 1 - y;
    
    let newGrid = [...board.grid];
    newGrid = newGrid.map(c => {
      if ((c.x === x && c.y === y) || (c.x === rx && c.y === ry)) {
        return { ...c, isHidden, value: '', isBlock: false };
      }
      return c;
    });
    
    let newBoard = { ...board, grid: newGrid };
    newBoard = updateGridNumbers(newBoard);
    commitBoardChange(newBoard);
  };

  const setLetter = (x: number, y: number, letter: string) => {
    let newGrid = [...board.grid];
    newGrid = newGrid.map(c => {
      if (c.x === x && c.y === y && !c.isBlock) {
         return { ...c, value: letter.toUpperCase() };
      }
      return c;
    });
    commitBoardChange({ ...board, grid: newGrid });
    if (letter) {
      playSound('letter-input');
      triggerHaptic(8);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
      return;
    }

    if (!selectedCell) return;
    const cell = getCell(selectedCell.x, selectedCell.y);
    if (!cell) return;

    if (e.key === '.') {
      setBlock(selectedCell.x, selectedCell.y, !cell.isBlock);
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      setHidden(selectedCell.x, selectedCell.y, !cell.isHidden);
      return;
    }

    if (e.key === 'Backspace') {
      setLetter(selectedCell.x, selectedCell.y, '');
      if (direction === 'across') {
        let nx = selectedCell.x - 1;
        while (nx >= 0 && getCell(nx, selectedCell.y)?.isBlock) nx--;
        if (nx >= 0) setSelectedCell({ x: nx, y: selectedCell.y });
      } else {
        let ny = selectedCell.y - 1;
        while (ny >= 0 && getCell(selectedCell.x, ny)?.isBlock) ny--;
        if (ny >= 0) setSelectedCell({ x: selectedCell.x, y: ny });
      }
      return;
    }

    if (/^[a-zA-Zа-яА-ЯёЁ]$/.test(e.key)) {
      setLetter(selectedCell.x, selectedCell.y, e.key.toUpperCase());
      if (direction === 'across') {
        let nx = selectedCell.x + 1;
        while (nx < board.width && getCell(nx, selectedCell.y)?.isBlock) nx++;
        if (nx < board.width) setSelectedCell({ x: nx, y: selectedCell.y });
      } else {
        let ny = selectedCell.y + 1;
        while (ny < board.height && getCell(selectedCell.x, ny)?.isBlock) ny++;
        if (ny < board.height) setSelectedCell({ x: selectedCell.x, y: ny });
      }
      return;
    }

    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      let { x, y } = selectedCell;
      if (e.key === 'ArrowUp') y = Math.max(0, y - 1);
      if (e.key === 'ArrowDown') y = Math.min(board.height - 1, y + 1);
      if (e.key === 'ArrowLeft') x = Math.max(0, x - 1);
      if (e.key === 'ArrowRight') x = Math.min(board.width - 1, x + 1);
      setSelectedCell({ x, y });
    }
  };

  const updateClue = (type: 'across' | 'down', num: number, text: string) => {
    const newBoard = { ...board! };
    newBoard.clues[type] = newBoard.clues[type].map(c => 
      c.number === num ? { ...c, text } : c
    );
    setUndoStack((prev) => [...prev.slice(-49), createSnapshot(board, title)]);
    setRedoStack([]);
    setBoard(newBoard);
    setIsDirty(true);
  };

  const handleSaveClick = async () => {
    const success = await save(board, title);
    if (success) {
      setIsDirty(false);
      toast.success(language === 'ru' ? 'Кроссворд сохранён' : 'Crossword saved');
    } else {
      toast.error(language === 'ru' ? 'Не удалось сохранить кроссворд' : 'Could not save the crossword');
    }
  };

  const handlePublishClick = async () => {
    if (visibilitySetting === 'private') {
      toast.error(
        language === 'ru'
          ? 'Для публикации выберите доступ «По ссылке» или «Публичный».'
          : 'Choose link or public visibility to publish.'
      );
      return;
    }
    const nextPublished = !cw?.isPublished;
    if (nextPublished) {
      const issues = getPublishIssues();
      if (issues.length > 0) {
        toast.error(issues[0]);
        return;
      }
    }

    const success = await save(board, title, nextPublished);
    if (!success) {
      toast.error(language === 'ru' ? 'Не удалось опубликовать кроссворд' : 'Could not publish the crossword');
      return;
    }

    toast.success(
      nextPublished
        ? (language === 'ru' ? 'Кроссворд опубликован' : 'Crossword published')
        : (language === 'ru' ? 'Кроссворд сохранён как черновик' : 'Crossword saved as draft')
    );
  };

  const handleShareClick = async () => {
    if (visibilitySetting === 'private') {
      toast.error(
        language === 'ru'
          ? 'Включите доступ по ссылке или публичный режим в блоке «Поделиться».'
          : 'Switch to link or public access in the sharing panel.'
      );
      return;
    }
    const issues = getPublishIssues();
    if (issues.length > 0) {
      toast.error(issues[0]);
      return;
    }

    const needsPublish = !cw?.isPublished;
    const success = await save(board, title, needsPublish ? true : undefined);
    if (!success) {
      toast.error(language === 'ru' ? 'Не удалось сохранить для ссылки' : 'Could not save for sharing');
      return;
    }

    try {
      await navigator.clipboard.writeText(playUrl(shareLinkKeyRef.current || cw?.slug || id || ''));
      toast.success(
        needsPublish
          ? (language === 'ru' ? 'Опубликовано — ссылка на решение скопирована' : 'Published — solve link copied')
          : (language === 'ru' ? 'Ссылка на решение скопирована' : 'Solve link copied')
      );
    } catch (error) {
      console.error(error);
      toast.error(language === 'ru' ? 'Не удалось скопировать ссылку' : 'Could not copy the share link');
    }
  };

  const handleCopyPreviewLink = async () => {
    if (visibilitySetting === 'private') {
      toast.error(language === 'ru' ? 'Предпросмотр недоступен в режиме «Только владелец».' : 'Preview requires link or public access.');
      return;
    }
    const issues = getPublishIssues();
    if (issues.length > 0) {
      toast.error(issues[0]);
      return;
    }
    const success = await save(board, title, !cw?.isPublished ? true : undefined);
    if (!success) {
      toast.error(language === 'ru' ? 'Не удалось сохранить карточку' : 'Could not save preview card');
      return;
    }
    try {
      await navigator.clipboard.writeText(previewUrl(shareLinkKeyRef.current || cw?.slug || id || ''));
      toast.success(language === 'ru' ? 'Ссылка на страницу превью скопирована' : 'Preview page link copied');
    } catch {
      toast.error(language === 'ru' ? 'Не удалось скопировать' : 'Could not copy');
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-[radial-gradient(circle_at_16%_14%,rgba(143,176,138,0.24),transparent_33%),radial-gradient(circle_at_84%_82%,rgba(63,86,62,0.28),transparent_40%),linear-gradient(180deg,#162118_0%,#223126_40%,#2f4333_100%)] overflow-hidden relative"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="h-14 flex items-center justify-between px-4 sm:px-6 bg-[linear-gradient(90deg,rgba(18,30,20,0.9),rgba(30,45,31,0.88))] backdrop-blur-xl border-b border-[#8bab84]/30 shrink-0 relative z-20">
        <div className="flex items-center gap-3 min-w-0">
          <BookSpine className="text-[#9eb197]/35 hidden sm:block" />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="text-[#c7d0bd]/55 hover:text-[#f0f4e9] transition-colors p-1.5 hover:bg-[#6d8968]/25 rounded-sm"
          >
            <ArrowLeft size={18} />
          </motion.button>
          <div className="h-5 w-px bg-[#8bab84]/35" />
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsDirty(true);
            }}
            onKeyDown={e => e.stopPropagation()}
            placeholder={t('untitled')}
            className="text-lg sm:text-xl font-display font-bold text-[#edf2e3] bg-transparent outline-none py-1 rounded px-2 transition-all placeholder:text-[#aeb9a4]/55 w-48 sm:w-64"
          />
          <div className="hidden sm:flex items-center gap-2 ml-2 px-2.5 py-1 bg-[linear-gradient(120deg,rgba(78,104,76,0.42),rgba(28,40,28,0.65))] border border-[#8bab84]/36 rounded-sm text-xs text-[#dce6d4]/80">
            <span className="font-body">{t('size')}:</span>
            <select
              value={board.width}
              onChange={(e) => {
                handleResize(Number(e.target.value));
                triggerHaptic(10);
              }}
              className="bg-transparent font-display font-semibold outline-none cursor-pointer text-[#d3e2c1]"
            >
              <option value={5}>5 x 5</option>
              <option value={10}>10 x 10</option>
              <option value={15}>15 x 15</option>
              <option value={21}>21 x 21</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="flex items-center gap-2 px-3 py-2 text-[#dce6d4]/70 hover:text-[#f0f4e9] hover:bg-[#6d8968]/20 rounded-sm font-body text-sm transition-all disabled:opacity-35 disabled:hover:bg-transparent"
              title={language === 'ru' ? 'Отменить' : 'Undo'}
            >
              <Undo2 size={16} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="flex items-center gap-2 px-3 py-2 text-[#dce6d4]/70 hover:text-[#f0f4e9] hover:bg-[#6d8968]/20 rounded-sm font-body text-sm transition-all disabled:opacity-35 disabled:hover:bg-transparent"
              title={language === 'ru' ? 'Вернуть' : 'Redo'}
            >
              <Redo2 size={16} />
            </motion.button>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={clearGrid}
            className="flex items-center gap-2 px-3 py-2 text-[#d4cab9]/55 hover:text-[#f1cfbc] hover:bg-[#5c4237]/28 rounded-sm font-body font-medium text-sm transition-all"
            title={t('clearGrid')}
          >
            <Trash2 size={16} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSaveClick}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[linear-gradient(120deg,rgba(79,109,75,0.5),rgba(24,35,24,0.72))] border border-[#8bab84]/36 text-[#eff5e5] rounded-sm font-subhead font-semibold text-sm transition-all"
          >
            <Save size={16} className={saving ? 'animate-pulse text-[#d3e2c1]' : 'text-[#d8e6c7]'} />
            {saving ? t('saving') : t('save')}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              playSound('success');
              triggerHaptic(12);
              navigate(`/wordart/${id}`);
            }}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#5a7058]/42 text-[#e8f0de] border border-[#8bab84]/40 rounded-sm font-subhead font-semibold text-sm transition-all"
          >
            <Image size={16} />
            Word Art
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              playSound('save');
              triggerHaptic(10);
              void handleShareClick();
            }}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#556a4f]/42 text-[#e9f1df] border border-[#9db897]/35 rounded-sm font-subhead font-semibold text-sm transition-all"
          >
            <Share2 size={16} />
            {language === 'ru' ? 'Поделиться' : 'Share Link'}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              triggerHaptic([10, 14, 10]);
              void handlePublishClick();
            }}
            className={clsx(
              'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-sm font-subhead font-semibold text-sm transition-all',
              cw?.isPublished
                ? 'bg-[#556a4f]/46 text-[#edf4e4] border border-[#9db897]/35'
                : 'bg-[#334a35] text-[#eef3e7] border border-[#8bab84]/30 hover:bg-[#48624a]'
            )}
          >
            {cw?.isPublished ? t('published') : t('publish')}
          </motion.button>
</div>
      </div>

      <div className="mx-4 sm:mx-6 mt-3 flex flex-wrap items-center gap-3 relative z-20 rounded-sm border border-[#8bab84]/26 bg-[rgba(22,33,24,0.72)] px-3 py-2.5 backdrop-blur-sm">
        <span className="text-[10px] font-subhead uppercase tracking-[0.14em] text-[#b3cda0]/80 shrink-0">{t('editorSharing')}</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#dce6d4]/90">
            <Lock size={14} className="text-[#9eb197]/65 shrink-0" aria-hidden />
            <select
              value={visibilitySetting}
              onChange={(e) => {
                setVisibilitySetting(e.target.value as CrosswordVisibility);
                setIsDirty(true);
              }}
              className="bg-[rgba(13,22,14,0.55)] border border-[#8bab84]/28 rounded-sm px-2 py-1 font-body outline-none focus-visible:ring-1 focus-visible:ring-[#b8cf9d]"
            >
              <option value="private">{t('visibilityPrivate')}</option>
              <option value="link">{t('visibilityLink')}</option>
              <option value="public">{t('visibilityPublic')}</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#dce6d4]/90">
            <Globe size={14} className="text-[#9eb197]/65 shrink-0" aria-hidden />
            <select
              value={difficultySetting}
              onChange={(e) => {
                setDifficultySetting(e.target.value as CrosswordDifficulty);
                setIsDirty(true);
              }}
              className="bg-[rgba(13,22,14,0.55)] border border-[#8bab84]/28 rounded-sm px-2 py-1 font-body outline-none focus-visible:ring-1 focus-visible:ring-[#b8cf9d]"
            >
              <option value="easy">{t('difficultyEasy')}</option>
              <option value="medium">{t('difficultyMedium')}</option>
              <option value="hard">{t('difficultyHard')}</option>
            </select>
          </div>
          <div className="flex items-center gap-1 font-mono text-[11px] text-[#c8ddbc]/85 px-2 py-1 rounded-sm bg-[rgba(13,22,14,0.45)] border border-[#8bab84]/22">
            <Link2 size={12} className="text-[#8bab84]" aria-hidden />
            <span className="truncate max-w-[120px]">{cw?.slug ?? (language === 'ru' ? 'нет slug' : 'no slug yet')}</span>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => void handleCopyPreviewLink()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-[#8bab84]/30 text-[11px] font-subhead text-[#dce6d4]/90 hover:bg-[#6d8968]/18 transition-colors"
          >
            <Copy size={13} />
            {t('copyPreviewLink')}
          </motion.button>
        </div>
      </div>

      <div className="mx-4 sm:mx-6 mt-3 flex flex-wrap items-center gap-2 relative z-20">
        <div className={clsx(
          'rounded-sm border px-3 py-1.5 text-xs font-mono',
          isDirty ? 'border-[#c8a96c]/45 bg-[#3f3524]/75 text-[#f3dfb4]' : 'border-[#8bab84]/30 bg-[#283629]/72 text-[#d8e6c7]'
        )}>
          {isDirty
            ? (language === 'ru' ? 'Есть несохранённые изменения' : 'Unsaved changes')
            : (language === 'ru' ? 'Все изменения сохранены' : 'All changes saved')}
        </div>
        {!cw?.isPublished && stats && (
          <div className="rounded-sm border border-[#8bab84]/28 bg-[#243126]/72 px-3 py-1.5 text-xs font-body text-[#dce6d4]/80">
            {language === 'ru'
              ? `Проверок перед публикацией: ${getPublishIssues().length === 0 ? 'всё готово' : getPublishIssues().length}`
              : `Publish checks: ${getPublishIssues().length === 0 ? 'ready' : getPublishIssues().length}`}
          </div>
        )}
      </div>

<div className="flex-1 overflow-hidden flex flex-col xl:flex-row p-0 sm:p-4 md:p-6 gap-4 xl:gap-6 max-w-[1700px] mx-auto w-full relative z-10 xl:items-stretch h-screen">
        <div className="flex-1 flex items-center justify-center overflow-hidden p-3 xl:overflow-visible">
          <motion.div
            whileTap={{ scale: 0.998 }}
            transition={{ duration: 0.12 }}
            className="relative w-full max-w-[800px] rounded-sm border border-[#6b5f4d]/45 p-2 bg-[linear-gradient(165deg,rgba(236,228,214,0.92)_0%,rgba(170,157,138,0.48)_100%)] shadow-[0_20px_50px_rgba(11,10,8,0.4)]"
            style={{ aspectRatio: '1/1' }}
          >
            <CanvasGrid
              board={board}
              selectedCell={selectedCell}
              direction={direction}
              allWordBounds={allWordBounds}
              onCellClick={handleCellClick}
              onCellChange={setLetter}
              editable={true}
            />
          </motion.div>
        </div>

<div
          className={clsx(
            'w-full xl:w-[760px] shrink-0 fixed bottom-0 left-0 right-0 xl:static bg-[linear-gradient(165deg,rgba(29,26,22,0.96)_0%,rgba(43,38,31,0.95)_100%)] z-20 xl:z-10 shadow-[0_-14px_40px_rgba(12,10,8,0.35)] xl:shadow-[0_16px_34px_rgba(12,10,8,0.4)] border-t border-[#6f8069]/30 xl:border xl:border-[#6f8069]/28 xl:rounded-sm flex flex-col overflow-hidden transition-[height] duration-300 pb-[env(safe-area-inset-bottom)]',
            'h-[78vh] xl:h-auto xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto'
          )}
        >
          {stats && (
            <div className="p-3 border-b border-[#6f8069]/26 bg-[linear-gradient(145deg,rgba(24,35,26,0.74),rgba(38,52,38,0.54))] grid grid-cols-2 gap-2 text-xs shrink-0">
              <div className="flex items-center gap-2 text-[#dce6d4]/85 bg-[rgba(21,29,21,0.48)] px-2 py-1.5 rounded-sm border border-[#8bab84]/25">
                <Hash size={12} className="text-[#b3cda0]" />
                <span>{t('statsTotalWords')}: <strong className="ml-1">{stats.wordCount}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[#dce6d4]/85 bg-[rgba(21,29,21,0.48)] px-2 py-1.5 rounded-sm border border-[#8bab84]/25">
                <LayoutGrid size={12} className="text-[#b3cda0]" />
                <span>{t('statsBlockPct')}: <strong className="ml-1">{stats.blockPercentage}%</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[#dce6d4]/85 bg-[rgba(21,29,21,0.48)] px-2 py-1.5 rounded-sm border border-[#8bab84]/25 col-span-2 xl:col-span-1">
                <CheckSquare size={12} className={stats.emptyClues > 0 ? 'text-[#f1cfbc]' : 'text-[#b3cda0]'} />
                <span>{t('statsEmptyClues')}: <strong className="ml-1">{stats.emptyClues}</strong></span>
              </div>
              {!stats.isConnected && (
                <div className="col-span-2 flex items-center gap-2 text-[#f1cfbc] bg-[#5c4237]/32 p-2 rounded-sm border border-[#91634c]/35">
                  <AlertTriangle size={14} />
                  <span>{t('connectedWarning')}</span>
                </div>
              )}
              {selectedLabel && currentCell && (
                <div className="col-span-2 rounded-sm border border-[#8bab84]/24 bg-[rgba(21,29,21,0.42)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-subhead text-[11px] uppercase tracking-[0.12em] text-[#b3cda0]/80">
                        {language === 'ru' ? 'Выбрана клетка' : 'Selected cell'}
                      </div>
                      <div className="mt-1 text-sm text-[#edf4e4]">{selectedLabel}</div>
                    </div>
                    <div className="text-right text-[11px] font-mono text-[#dce6d4]/60">
                      {currentCell.isHidden
                        ? (language === 'ru' ? 'Пустота' : 'Void')
                        : currentCell.isBlock
                          ? (language === 'ru' ? 'Блок' : 'Block')
                          : (currentCell.value || (language === 'ru' ? 'Пусто' : 'Empty'))}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setBlock(selectedCell.x, selectedCell.y, !currentCell.isBlock)}
                      className={clsx(
                        'flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-xs font-subhead font-semibold transition-all',
                        currentCell.isBlock
                          ? 'bg-[#5c4237]/34 text-[#f3d7c6] border border-[#91634c]/35'
                          : 'bg-[#314231]/70 text-[#edf4e4] border border-[#8bab84]/24'
                      )}
                    >
                      <Square size={14} />
                      {language === 'ru' ? 'Блок' : 'Block'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHidden(selectedCell.x, selectedCell.y, !currentCell.isHidden)}
                      className={clsx(
                        'flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-xs font-subhead font-semibold transition-all',
                        currentCell.isHidden
                          ? 'bg-[#5c4237]/34 text-[#f3d7c6] border border-[#91634c]/35'
                          : 'bg-[#314231]/70 text-[#edf4e4] border border-[#8bab84]/24'
                      )}
                    >
                      <EyeOff size={14} />
                      {language === 'ru' ? 'Пустота' : 'Void'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLetter(selectedCell.x, selectedCell.y, '')}
                      disabled={currentCell.isBlock || currentCell.isHidden || !currentCell.value}
                      className="flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-xs font-subhead font-semibold transition-all bg-[#314231]/70 text-[#edf4e4] border border-[#8bab84]/24 disabled:opacity-35"
                    >
                      <Eraser size={14} />
                      {language === 'ru' ? 'Очистить' : 'Clear'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="xl:hidden px-3 pt-3 pb-2 border-b border-[#6f8069]/24 bg-[linear-gradient(145deg,rgba(28,39,30,0.84),rgba(39,54,40,0.64))] backdrop-blur-md">
            <div className="relative grid grid-cols-2 rounded-sm border border-[#6f8069]/30 bg-[linear-gradient(145deg,rgba(13,20,14,0.38),rgba(41,56,40,0.34))] p-1">
              <motion.div
                initial={false}
                animate={{ x: mobileCluePanel === 'across' ? '0%' : '100%' }}
                transition={{ type: 'spring', stiffness: 240, damping: 28 }}
                className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-sm bg-[linear-gradient(140deg,rgba(98,122,95,0.58)_0%,rgba(65,82,61,0.28)_100%)] border border-[#8bab84]/40 shadow-[0_5px_16px_rgba(98,122,95,0.3)]"
              />
              {(['across', 'down'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => {
                    setMobileCluePanel(dir);
                    setDirection(dir);
                    triggerHaptic(10);
                  }}
                  className={clsx(
                    'relative z-10 h-10 flex items-center justify-center gap-2 rounded-sm text-sm font-subhead font-bold tracking-[0.06em] transition-colors',
                    mobileCluePanel === dir ? 'text-[#f3eee2]' : 'text-[#d9d0c0]/58'
                  )}
                >
                  {dir === 'across' ? <ArrowRight size={14} /> : <ArrowDown size={14} />}
                  {t(dir)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-hidden xl:grid xl:grid-cols-2 xl:gap-3 xl:p-3">
            {(['across', 'down'] as const).map((dir) => {
              const isMobileHidden = mobileCluePanel !== dir;
              return (
                <motion.section
                  key={dir}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={clsx(
                    'relative flex flex-col h-full overflow-hidden',
                    isMobileHidden ? 'hidden xl:flex' : 'flex',
                    'xl:rounded-sm xl:border xl:border-[#c4b79f]/45 xl:bg-[linear-gradient(165deg,#f4eddf_0%,#ece3d2_100%)] xl:backdrop-blur-md'
                  )}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_18%_0%,rgba(169,198,154,0.26),transparent_68%)]" />
                  <button
                    type="button"
                    onClick={() => {
                      setDirection(dir);
                      setMobileCluePanel(dir);
                      triggerHaptic(10);
                    }}
                    className={clsx(
                      'px-4 py-3 border-b text-left transition-colors',
                      dir === direction
                        ? 'border-[#c3b598] bg-[linear-gradient(135deg,#f4ebdb_0%,#efe4cf_100%)]'
                        : 'border-[#d7cbb7] bg-[linear-gradient(135deg,#f2e9d8_0%,#eadfca_100%)] hover:bg-[linear-gradient(135deg,#efe3cf_0%,#e5d7bf_100%)]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-display text-2xl leading-none text-[#1f2a36] tracking-tight flex items-center gap-2">
                        {dir === 'across' ? <ArrowRight size={18} className="text-[#5a7b52]" /> : <ArrowDown size={18} className="text-[#5a7b52]" />}
                        {t(dir)}
                      </h2>
                      <span className="font-mono text-xs px-2 py-1 rounded-sm bg-[#edf3e4] text-[#3a5240] border border-[#c8d6b7]">
                        {board.clues[dir].length}
                      </span>
                    </div>
                  </button>

                  <div className="flex-1 overflow-y-auto scroll-smooth px-1 py-1">
                    {board.clues[dir].map((clue, index) => {
                      const clueBounds = getWordBounds(clue.x, clue.y, dir);
                      const isActive = clueBounds && selectedCell
                        ? selectedCell.x >= clueBounds.startX && selectedCell.x <= clueBounds.endX && selectedCell.y >= clueBounds.startY && selectedCell.y <= clueBounds.endY && direction === dir
                        : false;

                      return (
                        <motion.button
                          key={`${dir}-${clue.number}`}
                          type="button"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(index * 0.012, 0.18) }}
                          whileHover={{ x: 2, y: -1, scale: 1.002 }}
                          whileTap={{ scale: 0.982 }}
                          onClick={() => {
                            setSelectedCell({ x: clue.x, y: clue.y });
                            setDirection(dir);
                            setMobileCluePanel(dir);
                            playSound('cell-select');
                            triggerHaptic(10);
                          }}
                          className={clsx(
                            'relative w-full text-left grid grid-cols-[1fr_58px] gap-2.5 items-start px-3 py-3 rounded-sm transition-all border border-transparent',
                            isActive
                              ? 'bg-[linear-gradient(96deg,rgba(220,234,206,0.86)_0%,rgba(247,242,232,0.95)_56%,rgba(252,248,239,1)_100%)] border-[#9fb88f]/50 shadow-[0_10px_22px_rgba(62,88,58,0.24)]'
                              : 'bg-[linear-gradient(96deg,#f4eddf,#ece2d1)] hover:bg-[linear-gradient(96deg,#efe5d3,#e7dbc5)] hover:border-[#cdbd9e]/55 hover:shadow-[0_8px_18px_rgba(44,55,39,0.12)]'
                          )}
                        >
                          <input
                            className={clsx('bg-transparent font-body text-[18px] leading-relaxed outline-none min-w-0 text-right', isActive ? 'text-[#1f2a36]' : 'text-[#253241]')}
                            style={{ textAlign: 'justify', textJustify: 'inter-word' }}
                            placeholder={t('enterClue')}
                            value={clue.text}
                            onChange={e => updateClue(dir, clue.number, e.target.value)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCell({ x: clue.x, y: clue.y });
                              setDirection(dir);
                              setMobileCluePanel(dir);
                            }}
                            onKeyDown={e => e.stopPropagation()}
                          />
                          <div className="flex flex-col items-end">
                            <span className={clsx('font-display text-xl leading-none', isActive ? 'text-[#1f2a36]' : 'text-[#2f3d4f]/75')}>{clue.number}</span>
                            <span className="text-xs font-mono text-[#3b5264]/55 mt-1">{clue.length}</span>
                          </div>
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-[linear-gradient(180deg,transparent_0%,rgba(17,24,18,0.62)_100%)] xl:hidden" />
    </div>
  );
}
