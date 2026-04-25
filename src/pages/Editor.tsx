import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCafe } from '../contexts/CafeContext';
import { BoardState, Clue, Crossword, GridCell } from '../types';
import { updateGridNumbers } from '../lib/gridUtils';
import { Save, Share2, ArrowLeft, ArrowRight, ArrowDown, Trash2, LayoutGrid, Hash, CheckSquare, AlertTriangle, Bookmark, Sparkles, Image } from 'lucide-react';
import { LampGlow, InkDrop } from '../components/CafeAnimations';
import clsx from 'clsx';
import { motion } from 'motion/react';

export function Editor() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { playSound, effectsEnabled } = useCafe();
  const navigate = useNavigate();

  const [cw, setCw] = useState<Crossword | null>(null);
  const [board, setBoard] = useState<BoardState | null>(null);
  
  const [selectedCell, setSelectedCell] = useState<{x: number, y: number} | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  const [cellAnimations, setCellAnimations] = useState<Record<string, 'fill' | 'block' | null>>({});
  
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');

  const gridRef = useRef<HTMLDivElement>(null);

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
          setBoard(JSON.parse(data.boardState) as BoardState);
        }
      } catch (err) {
        handleFirestoreError(err, 'get', `/crosswords/${id}`);
      }
    }
    load();
  }, [id, user, navigate]);

  const save = useCallback(async (currentBoard: BoardState, currentTitle: string, isPublished?: boolean) => {
    if (!id || !user) return;
    setSaving(true);
    try {
      const updates: Partial<Crossword> = {
        title: currentTitle,
        boardState: JSON.stringify(currentBoard),
        updatedAt: Date.now()
      };
      if (isPublished !== undefined) {
        updates.isPublished = isPublished;
        if (isPublished) {
          playSound('achievement');
        }
      }
      try {
        await updateDoc(doc(db, 'crosswords', id), updates);
      } catch (err) {
        handleFirestoreError(err, 'update', `/crosswords/${id}`);
      }
      if (isPublished !== undefined) {
        setCw(prev => prev ? { ...prev, isPublished } : prev);
      }
    } finally {
      setSaving(false);
      playSound('save');
    }
  }, [id, user, playSound]);

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
    const playCells = totalCells - hiddenCount;
    const blockPercentage = playCells > 0 ? Math.round((blockCount / playCells) * 100) : 0;
    
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
       isConnected = visited.size === playCells;
    }

    return { blockPercentage, emptyClues, wordCount, letterCount, playCells, isConnected };
  }, [board]);

  const clearGrid = () => {
    if (!board || !window.confirm(t('clearGrid') + '?')) return;
    const newGrid = board.grid.map(c => ({...c, value: ''}));
    setBoard({ ...board, grid: newGrid });
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

  const wordBounds = React.useMemo(() => {
    if (!selectedCell || !board) return null;
    const cell = getCell(selectedCell.x, selectedCell.y);
    if (!cell || cell.isBlock || cell.isHidden) return null;
    return getWordBounds(selectedCell.x, selectedCell.y, direction);
  }, [selectedCell, direction, board, getWordBounds]);

  const getAllWordBounds = React.useCallback((x: number, y: number) => {
    if (!board) return { across: null, down: null };
    return {
      across: getWordBounds(x, y, 'across'),
      down: getWordBounds(x, y, 'down')
    };
  }, [board, getWordBounds]);

  const allWordBounds = React.useMemo(() => {
    if (!selectedCell || !board) return { across: null, down: null };
    const cell = getCell(selectedCell.x, selectedCell.y);
    if (!cell || cell.isBlock || cell.isHidden) return { across: null, down: null };
    return {
      across: getWordBounds(selectedCell.x, selectedCell.y, 'across'),
      down: getWordBounds(selectedCell.x, selectedCell.y, 'down')
    };
  }, [selectedCell, board, getWordBounds]);

  if (!board) return <div className="p-8 text-center animate-pulse font-body text-cafe-espresso/60">{t('loadingEditor')}</div>;

  const handleCellClick = (x: number, y: number) => {
    if (selectedCell?.x === x && selectedCell?.y === y) {
      setDirection(d => d === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell({ x, y });
      playSound('cell-select');
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
    
    setBoard(newBoard);
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
    setBoard(newBoard);
    // Play block toggle sound
    playSound('block-toggle');
    const key = `${x}-${y}`;
    setCellAnimations(prev => ({ ...prev, [key]: 'block' }));
    setTimeout(() => {
      setCellAnimations(prev => ({ ...prev, [key]: null }));
    }, 200);
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
    setBoard(newBoard);
  };

  const setLetter = (x: number, y: number, letter: string) => {
    let newGrid = [...board.grid];
    newGrid = newGrid.map(c => {
      if (c.x === x && c.y === y && !c.isBlock) {
         return { ...c, value: letter.toUpperCase() };
      }
      return c;
    });
    setBoard({ ...board, grid: newGrid });
    // Play sound and trigger animation
    if (letter) {
      const key = `${x}-${y}`;
      setCellAnimations(prev => ({ ...prev, [key]: 'fill' }));
      playSound('letter-input');
      setTimeout(() => {
        setCellAnimations(prev => ({ ...prev, [key]: null }));
      }, 300);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    setBoard(newBoard);
  };

  return (
    <div className="flex flex-col h-full bg-cafe-cream overflow-hidden" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="h-16 flex items-center justify-between px-6 bg-cafe-paper border-b border-cafe-leather/10 shadow-sm shrink-0 relative z-20">
        <div className="flex items-center gap-4">
          <motion.button 
             whileHover={{ scale: 1.05 }}
             whileTap={{ scale: 0.95 }}
             onClick={() => navigate('/')} 
             className="text-cafe-espresso/50 hover:text-cafe-leather transition-colors p-1.5 hover:bg-cafe-leather/5 rounded-sm"
         >
            <ArrowLeft size={20} />
          </motion.button>
          <div className="h-6 w-px bg-cafe-leather/10" />
          <input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder={t('untitled')}
            className="text-xl font-display font-bold text-cafe-leather bg-transparent outline-none py-1 focus:ring-2 focus:ring-cafe-gold/20 rounded px-2 -ml-2 transition-all placeholder:text-cafe-leather/30 w-48 sm:w-64"
          />
          <div className="hidden sm:flex items-center gap-2 ml-4 px-3 py-1.5 bg-cafe-leather/5 border border-cafe-leather/10 rounded-sm text-sm text-cafe-espresso/70">
            <span className="font-body text-cafe-espresso/50">{t('size')}:</span>
            <select 
              value={board.width}
              onChange={(e) => handleResize(Number(e.target.value))}
              className="bg-transparent font-display font-semibold outline-none cursor-pointer text-cafe-honey"
            >
              <option value={5}>5 × 5</option>
              <option value={10}>10 × 10</option>
              <option value={15}>15 × 15</option>
              <option value={21}>21 × 21</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={clearGrid}
            className="flex items-center gap-2 px-3 py-2 text-cafe-espresso/40 hover:text-cafe-wine hover:bg-cafe-wine/5 rounded-sm font-body font-medium text-sm transition-all"
            title={t('clearGrid')}
         >
            <Trash2 size={16} />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => save(board, title)}
            className="flex items-center gap-2 px-4 py-2 bg-cafe-paper border border-cafe-leather/20 hover:border-cafe-leather/40 hover:bg-cafe-leather/5 text-cafe-leather rounded-sm font-subhead font-semibold text-sm transition-all"
         >
            <Save size={16} className={saving ? "animate-pulse text-cafe-honey" : "text-cafe-espresso/50"} />
            {saving ? t('saving') : t('save')}
          </motion.button>
          <motion.button 
             whileHover={{ scale: 1.02 }}
             whileTap={{ scale: 0.98 }}
             onClick={() => {
               playSound('success');
               navigate(`/wordart/${id}`);
             }}
             className="flex items-center gap-2 px-4 py-2 bg-cafe-wine/10 text-cafe-wine border border-cafe-wine/20 hover:bg-cafe-wine/20 rounded-sm font-subhead font-semibold text-sm transition-all"
           >
             <Image size={16} />
Word Art
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                playSound('save');
                save(board, title);
                const shareUrl = `${window.location.origin}/play/${id}`;
                navigator.clipboard.writeText(shareUrl);
                alert('Link copied to clipboard!');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-cafe-gold/10 text-cafe-honey border border-cafe-gold/30 hover:bg-cafe-gold/20 rounded-sm font-subhead font-semibold text-sm transition-all"
           >
             <Share2 size={16} />
             Share Link
           </motion.button>
           <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => save(board, title, !cw?.isPublished)}
              className={clsx("flex items-center gap-2 px-4 py-2 rounded-sm font-subhead font-semibold text-sm transition-all", cw?.isPublished ? "bg-cafe-gold/10 text-cafe-honey border border-cafe-gold/30 hover:bg-cafe-gold/20" : "bg-cafe-leather text-cafe-paper hover:bg-cafe-espresso hover:shadow-md")}
           >
             {cw?.isPublished ? t('published') : t('publish')}
           </motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row p-0 sm:p-6 gap-6 sm:gap-8 max-w-[1600px] mx-auto w-full">
        <div className="flex-1 flex items-center justify-center bg-transparent overflow-auto p-4 max-h-[85vh]">
          <motion.div 
            ref={gridRef}
            initial={{ opacity: 0, scale: 0.95, rotateX: 5 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
className="relative bg-transparent rounded-sm"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${board.width}, 1fr)`,
              gridTemplateRows: `repeat(${board.height}, 1fr)`,
              width: 'min(100%, 600px)',
              aspectRatio: '1/1',
            }}
          >
            {board.grid.map((cell, i) => {
              const isEmpty = cell.isHidden;
              let isInWord = false;
              if (selectedCell && !cell.isBlock && !cell.isHidden && allWordBounds) {
                const across = allWordBounds.across;
                const down = allWordBounds.down;
                if (across) {
                  isInWord = cell.x >= across.startX && cell.x <= across.endX && 
                           cell.y >= across.startY && cell.y <= across.endY;
                }
                if (down) {
                  isInWord = isInWord || (cell.x >= down.startX && cell.x <= down.endX && 
                                         cell.y >= down.startY && cell.y <= down.endY);
                }
              }

              const isSelected = selectedCell?.x === cell.x && selectedCell?.y === cell.y;
              
return (
                <div 
                  key={`${cell.x}-${cell.y}`}
                  onClick={() => handleCellClick(cell.x, cell.y)}
                  className={clsx(
                    "relative flex items-center justify-center cursor-pointer select-none overflow-hidden transition-all duration-150",
                    cell.isBlock && !cell.isHidden && "bg-cafe-leather",
                    isEmpty && "bg-transparent",
                    !cell.isBlock && !cell.isHidden && isSelected && "bg-cafe-gold/30 z-10 scale-[1.03] shadow-lg ring-2 ring-cafe-honey",
                    !cell.isBlock && !cell.isHidden && !isSelected && isInWord && "bg-cafe-gold/15 z-10 ring-1 ring-cafe-honey/60",
                    !cell.isBlock && !cell.isHidden && !isSelected && !isInWord && "bg-cafe-paper ring-1 ring-cafe-leather hover:bg-cafe-parchment",
                  )}
                >
                   {cell.number && !cell.isBlock && !cell.isHidden && (
                     <span className={clsx(
                       "absolute top-[2px] left-[3px] text-[10px] sm:text-[11px] font-display font-bold leading-none pointer-events-none select-none z-10 transition-colors",
                       isSelected || isInWord ? "text-cafe-honey" : "text-cafe-espresso/60"
                     )}>
                       {cell.number}
                     </span>
                   )}
                   {!cell.isBlock && !cell.isHidden && (
<input 
                        type="text"
                        maxLength={1}
                        value={cell.value}
                        className={clsx(
                          "absolute inset-0 w-full h-full text-center bg-transparent font-mono uppercase cursor-pointer outline-none caret-transparent pb-0.5 text-lg transition-colors",
                          isSelected || isInWord ? "text-cafe-honey font-bold" : "text-cafe-leather"
                        )}
                        onClick={() => handleCellClick(cell.x, cell.y)}
                       onChange={(e) => {
                          const val = e.target.value.slice(-1);
                          if (/^[a-zA-Zа-яА-ЯёЁ]$/.test(val)) {
                             setLetter(cell.x, cell.y, val.toUpperCase());
                             if (direction === 'across') {
                               let nx = cell.x + 1;
                               while (nx < board.width && getCell(nx, cell.y)?.isBlock) nx++;
                               if (nx < board.width) setSelectedCell({ x: nx, y: cell.y });
                             } else {
                               let ny = cell.y + 1;
                               while (ny < board.height && getCell(cell.x, ny)?.isBlock) ny++;
                               if (ny < board.height) setSelectedCell({ x: cell.x, y: ny });
                             }
                          } else if (val === '') {
                              setLetter(cell.x, cell.y, '');
                          }
                       }}
                       onKeyDown={(e) => {
                          if (e.key === 'Backspace' && cell.value === '') {
                              if (direction === 'across') {
                                 let nx = cell.x - 1;
                                 while (nx >= 0 && getCell(nx, cell.y)?.isBlock) nx--;
                                 if (nx >= 0) setSelectedCell({ x: nx, y: cell.y });
                              } else {
                                 let ny = cell.y - 1;
                                 while (ny >= 0 && getCell(cell.x, ny)?.isBlock) ny--;
                                 if (ny >= 0) setSelectedCell({ x: cell.x, y: ny });
                              }
                          } else if (e.key === '.') {
                             e.preventDefault();
                             setBlock(cell.x, cell.y, !cell.isBlock);
                          } else if (e.key === ' ') {
                             e.preventDefault();
                             setHidden(cell.x, cell.y, !cell.isHidden);
                          } else if (e.key.startsWith('Arrow')) {
                             e.preventDefault();
                             let { x, y } = cell;
                             if (e.key === 'ArrowUp') y = Math.max(0, y - 1);
                             if (e.key === 'ArrowDown') y = Math.min(board.height - 1, y + 1);
                             if (e.key === 'ArrowLeft') x = Math.max(0, x - 1);
                             if (e.key === 'ArrowRight') x = Math.min(board.width - 1, x + 1);
                             setSelectedCell({ x, y });
                          }
                       }}
                     />
                   )}
                 </div>
               );
             })}
          </motion.div>
        </div>

        <div className="w-full md:w-[32rem] lg:w-[38rem] flex flex-col h-1/2 md:h-full gap-4 md:gap-6 shrink-0 relative z-10">
          <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
             className="bg-cafe-paper border border-cafe-leather/10 rounded-sm shadow-lg shadow-cafe-leather/10 flex flex-col flex-1 overflow-hidden"
          >
            {stats && (
              <div className="p-3 border-b border-cafe-leather/10 bg-cafe-parchment/50 grid grid-cols-2 gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2.5 text-cafe-espresso/70 bg-cafe-paper px-2 py-1.5 rounded-sm border border-cafe-leather/10">
                  <div className="bg-cafe-gold/20 p-1 rounded"><Hash size={12} className="text-cafe-honey" /></div>
                  <span className="font-body text-cafe-espresso/60">{t('statsTotalWords')}: <strong className="text-cafe-leather ml-1">{stats.wordCount}</strong></span>
                </div>
                <div className="flex items-center gap-2.5 text-cafe-espresso/70 bg-cafe-paper px-2 py-1.5 rounded-sm border border-cafe-leather/10">
                  <div className="bg-cafe-gold/20 p-1 rounded"><LayoutGrid size={12} className="text-cafe-honey" /></div>
                  <span className="font-body text-cafe-espresso/60">{t('statsBlockPct')}: <strong className="text-cafe-leather ml-1">{stats.blockPercentage}%</strong></span>
                </div>
                <div className="flex items-center gap-2.5 text-cafe-espresso/70 bg-cafe-paper px-2 py-1.5 rounded-sm border border-cafe-leather/10">
                  <div className={clsx("p-1 rounded", stats.emptyClues > 0 ? "bg-cafe-wine/20" : "bg-cafe-leather/20")}>
                    <CheckSquare size={12} className={stats.emptyClues > 0 ? "text-cafe-wine" : "text-cafe-leather"} />
                  </div>
                  <span className="font-body text-cafe-espresso/60">{t('statsEmptyClues')}: <strong className={clsx("ml-1", stats.emptyClues > 0 ? "text-cafe-wine" : "text-cafe-leather")}>{stats.emptyClues}</strong></span>
                </div>
                {!stats.isConnected && (
                  <div className="col-span-2 flex items-center gap-2.5 mt-1 text-cafe-wine bg-cafe-wine/5 p-2 rounded-sm border border-cafe-wine/20">
                    <AlertTriangle size={14} />
                    <span className="font-body font-medium">{t('connectedWarning')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 border-b border-cafe-leather/10 bg-gradient-to-b from-cafe-paper to-cafe-parchment/30 flex flex-col justify-between shrink-0 gap-3">
              <div className="flex items-center justify-between">
                <span className="font-subhead text-xs font-bold uppercase tracking-widest text-cafe-leather flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cafe-gold animate-pulse" />
                  {t(direction)}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-cafe-espresso/40 font-subhead font-medium tracking-wider bg-cafe-leather/5 px-2.5 py-1 rounded-sm border border-cafe-leather/5 uppercase">
                  {t('symmetric')} <Bookmark size={10} />
                </div>
              </div>
              <div className="mt-2 text-xl font-display font-bold text-cafe-leather leading-tight min-h-[1.75rem]">
                {wordBounds ? `${wordBounds.length} ${direction === 'across' ? 'A' : 'D'}` : '-'}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-0 flex scrollbar-hide">
              {/* Two-column layout for clues: ACROSS | DOWN */}
              <div className="grid grid-cols-2 gap-4 w-full">
                {['across', 'down'].map((dir) => (
                  <div key={dir} className="flex flex-col border border-cafe-leather/15 rounded-sm bg-cafe-paper">
                    <div className="p-3 border-b border-cafe-leather/15 flex justify-between items-center bg-cafe-parchment/60 sticky top-0 z-10 rounded-t-sm">
                      <h2 className="font-subhead text-sm font-bold uppercase tracking-widest text-cafe-leather flex items-center gap-2">
                        {dir === 'across' ? <ArrowRight size={16}/> : <ArrowDown size={16}/>}
                        {t(dir)}
                      </h2>
                      <span className="text-xs font-mono text-cafe-espresso/50">{board.clues[dir as 'across'|'down'].length}</span>
                    </div>
                    <div className="p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-22rem)]">
                       {board.clues[dir as 'across' | 'down'].map(clue => {
                         const clueBounds = getWordBounds(clue.x, clue.y, dir);
                         const isActive = clueBounds && selectedCell && 
                           selectedCell.x >= clueBounds.startX && selectedCell.x <= clueBounds.endX &&
                           selectedCell.y >= clueBounds.startY && selectedCell.y <= clueBounds.endY;
                         return (
                           <div key={clue.number} className="flex flex-col">
                             <div 
                               className={clsx(
                                 "flex gap-3 items-center text-base px-3 py-3 transition-all cursor-pointer rounded-md border",
                                 isActive ? "bg-cafe-gold/15 border-cafe-gold/40 ring-2 ring-cafe-gold/30" : "hover:bg-cafe-parchment/60 border-cafe-leather/10"
                               )}
                               onClick={() => {
                                 setSelectedCell({x: clue.x, y: clue.y});
                                 setDirection(dir as 'across'|'down');
                               }}
                             >
                               <div className="flex items-center min-w-[32px] shrink-0">
                                 <span className="font-display font-bold text-lg text-cafe-leather">{clue.number}</span>
                               </div>
                               <input 
                                 className="flex-1 bg-transparent font-body text-base outline-none placeholder:text-cafe-espresso/30 text-cafe-leather min-w-0"
                                 placeholder={t('enterClue')}
                                 value={clue.text}
                                 onChange={e => updateClue(dir as 'across'|'down', clue.number, e.target.value)}
                                 onClick={(e) => {
                                   setSelectedCell({x: clue.x, y: clue.y});
                                   setDirection(dir as 'across'|'down');
                                   e.stopPropagation();
                                 }}
                                 onKeyDown={e => e.stopPropagation()}
                               />
                               <span className="text-xs font-mono text-cafe-espresso/40 shrink-0">{clue.length}</span>
                             </div>
                           </div>
                         );
                       })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}