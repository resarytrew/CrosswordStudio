import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { BoardState, Clue, Crossword, GridCell } from '../types';
import { updateGridNumbers } from '../lib/gridUtils';
import { Save, Share2, CornerUpLeft, ArrowRight, ArrowDown, ArrowLeft, Trash2, LayoutGrid, Hash, CheckSquare, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'motion/react';

export function Editor() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [cw, setCw] = useState<Crossword | null>(null);
  const [board, setBoard] = useState<BoardState | null>(null);
  
  const [selectedCell, setSelectedCell] = useState<{x: number, y: number} | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  
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
    }
  }, [id, user]);

  // Debounced auto-save effect would be nice, but explicit standard save might be fine
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

    // Connected components check (Grid validness)
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

  const activeClue = React.useMemo(() => {
    if (!selectedCell || !board) return null;
    const cell = getCell(selectedCell.x, selectedCell.y);
    if (!cell || cell.isBlock) return null;
    
    // Find the clue number for the current active run
    let num = null;
    if (direction === 'across') {
      let cx = selectedCell.x;
      while (cx > 0 && !getCell(cx - 1, selectedCell.y)?.isBlock) cx--;
      num = getCell(cx, selectedCell.y)?.number;
      if (num) return board.clues.across.find(c => c.number === num);
    } else {
      let cy = selectedCell.y;
      while (cy > 0 && !getCell(selectedCell.x, cy - 1)?.isBlock) cy--;
      num = getCell(selectedCell.x, cy)?.number;
      if (num) return board.clues.down.find(c => c.number === num);
    }
    return null;
  }, [selectedCell, direction, board]);

  if (!board) return <div className="p-8 text-center animate-pulse">{t('loadingEditor')}</div>;

  const handleCellClick = (x: number, y: number) => {
    if (selectedCell?.x === x && selectedCell?.y === y) {
      setDirection(d => d === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell({ x, y });
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
    
    // Clear selection if it is out of bounds
    if (selectedCell && (selectedCell.x >= newWidth || selectedCell.y >= newHeight)) {
      setSelectedCell(null);
    }
    
    setBoard(newBoard);
  };

  const setBlock = (x: number, y: number, isBlock: boolean) => {
    const rx = board.width - 1 - x;
    const ry = board.height - 1 - y;
    
    // Enforce rotational symmetry (180deg) as is standard in NYT (optional, but requested implicitly by "innovative" & NYT style)
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
      // Move backwards
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
      // Move forwards
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
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 shadow-sm shrink-0 relative z-20">
        <div className="flex items-center gap-4">
          <button 
             onClick={() => navigate('/')} 
             className="text-slate-400 hover:text-slate-900 transition-colors p-1.5 hover:bg-slate-100 rounded-lg active:scale-95"
          >
             <ArrowLeft size={20} />
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder={t('untitled')}
            className="text-xl font-extrabold tracking-tight text-slate-900 bg-transparent outline-none py-1 focus:ring-2 focus:ring-indigo-500/20 rounded px-2 -ml-2 transition-all placeholder:text-slate-300 w-48 sm:w-64"
          />
          <div className="hidden sm:flex items-center gap-2 ml-4 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 shadow-sm">
            <span className="font-medium text-slate-500">{t('size')}:</span>
            <select 
              value={board.width}
              onChange={(e) => handleResize(Number(e.target.value))}
              className="bg-transparent font-bold outline-none cursor-pointer text-indigo-700"
            >
              <option value={5}>5 x 5</option>
              <option value={10}>10 x 10</option>
              <option value={15}>15 x 15</option>
              <option value={21}>21 x 21</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={clearGrid}
            className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg font-semibold text-sm transition-all shadow-sm border border-transparent hover:border-red-100 active:scale-95"
            title={t('clearGrid')}
          >
             <Trash2 size={16} />
          </button>
          <button 
            onClick={() => save(board, title)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg font-semibold text-sm transition-all shadow-sm active:scale-95"
          >
             <Save size={16} className={saving ? "animate-pulse text-indigo-500" : "text-slate-500"} />
            {saving ? t('saving') : t('save')}
          </button>
          <button 
             onClick={() => save(board, title, !cw?.isPublished)}
             className={clsx("flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-sm active:scale-95", cw?.isPublished ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/50" : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-600/20")}
          >
            <Share2 size={16} />
            {cw?.isPublished ? t('published') : t('publish')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row p-0 sm:p-6 gap-6 sm:gap-8 max-w-[1600px] mx-auto w-full">
        {/* LEFT COMP: GRID */}
        <div className="flex-1 flex items-center justify-center bg-transparent overflow-auto p-4 max-h-[85vh]">
          <motion.div 
            ref={gridRef}
            initial={{ opacity: 0, scale: 0.95, rotateX: 5 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="gap-[1px] shadow-2xl shadow-indigo-900/10 relative bg-slate-800 p-[2px] rounded-sm outline outline-4 outline-slate-800"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${board.width}, 1fr)`,
              width: 'min(100%, 600px)',
              aspectRatio: '1/1',
            }}
          >
            {board.grid.map((cell, i) => {
              // Highlight selected word path
              let isInWord = false;
              if (selectedCell && !cell.isBlock && activeClue) {
                 if (direction === 'across') {
                   if (cell.y === selectedCell.y && cell.x >= activeClue.x && cell.x < activeClue.x + activeClue.length) {
                     isInWord = true;
                   }
                 } else {
                   if (cell.x === selectedCell.x && cell.y >= activeClue.y && cell.y < activeClue.y + activeClue.length) {
                     isInWord = true;
                   }
                 }
              }

              const isSelected = selectedCell?.x === cell.x && selectedCell?.y === cell.y;
              
              return (
                <div 
                  key={`${cell.x}-${cell.y}`}
                  onClick={() => handleCellClick(cell.x, cell.y)}
                  className={clsx(
                    "relative flex items-center justify-center cursor-pointer select-none overflow-hidden transition-colors duration-75",
                    cell.isBlock && !cell.isHidden && "bg-slate-800",
                    cell.isHidden && "bg-transparent",
                    !cell.isBlock && !cell.isHidden && isSelected && "bg-[#ffda00] z-10 scale-[1.02] shadow-sm",
                    !cell.isBlock && !cell.isHidden && !isSelected && isInWord && "bg-[#a7d8ff] z-10",
                    !cell.isBlock && !cell.isHidden && !isSelected && !isInWord && "bg-white z-0 hover:bg-slate-50",
                  )}
                >
                  {cell.number && !cell.isBlock && !cell.isHidden && (
                    <span className="absolute top-[3px] left-[4px] text-[12px] sm:text-[14px] font-extrabold leading-none text-slate-800 pointer-events-none select-none z-10 drop-shadow-sm">
                      {cell.number}
                    </span>
                  )}
                  {!cell.isBlock && !cell.isHidden && (
                    <input 
                      type="text"
                      maxLength={1}
                      value={cell.value}
                      className="absolute inset-0 w-full h-full text-center bg-transparent text-lg font-bold uppercase text-slate-900 cursor-pointer outline-none caret-transparent pb-0.5"
                      onClick={() => handleCellClick(cell.x, cell.y)}
                      onChange={(e) => {
                         const val = e.target.value.slice(-1);
                         if (/^[a-zA-Zа-яА-ЯёЁ]$/.test(val)) {
                            // simulate key press to reuse logic
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
                             // Handle backspace when empty
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

        {/* RIGHT COMP: CLUES */}
        <div className="w-full md:w-[22rem] lg:w-96 flex flex-col h-1/2 md:h-full gap-4 md:gap-6 shrink-0 relative z-10">
          <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
             className="bg-white border border-slate-200/80 sm:rounded-2xl shadow-lg shadow-slate-200/40 flex flex-col flex-1 overflow-hidden"
          >
            {/* STATS PANEL */}
            {stats && (
              <div className="p-3 border-b border-slate-200/60 bg-slate-50/80 grid grid-cols-2 gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2.5 text-slate-600 bg-white px-2 py-1.5 rounded-md border border-slate-200 shadow-sm">
                  <div className="bg-indigo-100 p-1 rounded"><Hash size={12} className="text-indigo-600" /></div>
                  <span className="font-medium text-slate-500">{t('statsTotalWords')}: <strong className="text-slate-900 ml-1">{stats.wordCount}</strong></span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-600 bg-white px-2 py-1.5 rounded-md border border-slate-200 shadow-sm">
                  <div className="bg-indigo-100 p-1 rounded"><LayoutGrid size={12} className="text-indigo-600" /></div>
                  <span className="font-medium text-slate-500">{t('statsBlockPct')}: <strong className="text-slate-900 ml-1">{stats.blockPercentage}%</strong></span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-600 bg-white px-2 py-1.5 rounded-md border border-slate-200 shadow-sm">
                  <div className={clsx("p-1 rounded", stats.emptyClues > 0 ? "bg-amber-100" : "bg-emerald-100")}>
                    <CheckSquare size={12} className={stats.emptyClues > 0 ? "text-amber-600" : "text-emerald-600"} />
                  </div>
                  <span className="font-medium text-slate-500">{t('statsEmptyClues')}: <strong className={clsx("ml-1", stats.emptyClues > 0 ? "text-amber-600" : "text-emerald-600")}>{stats.emptyClues}</strong></span>
                </div>
                {!stats.isConnected && (
                  <div className="col-span-2 flex items-center gap-2.5 mt-1 text-red-700 bg-red-50 p-2 rounded-md border border-red-100">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span className="font-medium">{t('connectedWarning')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 border-b border-slate-200/60 bg-gradient-to-b from-white to-slate-50/50 flex flex-col justify-between shrink-0 gap-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-800 text-xs flex items-center gap-2 uppercase tracking-widest">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-[pulse_2s_ease-in-out_infinite]" />
                  {t(direction)}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold tracking-wider bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 uppercase">
                  {t('symmetric')} <CornerUpLeft size={10} className="ml-1" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-slate-900 leading-tight min-h-[1.75rem]">
                {activeClue ? `${activeClue.number}. ${activeClue.text || '...'}` : '-'}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-0 flex flex-col scrollbar-hide">
              {['across', 'down'].map((dir) => (
                <div key={dir} className="flex flex-col border-b border-slate-100 last:border-b-0">
                  <div className="p-3 border-b border-slate-200/60 flex justify-between items-center bg-slate-50/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                    <h2 className="font-bold text-xs uppercase tracking-widest text-slate-500 flex items-center gap-2">
                      {dir === 'across' ? <ArrowRight size={14}/> : <ArrowDown size={14} />}
                      {t(dir)}
                    </h2>
                  </div>
                  <div className="p-2 space-y-1 bg-white">
                    {board.clues[dir as 'across' | 'down'].map(clue => {
                       const isActive = activeClue?.number === clue.number && direction === dir;
                       return (
                         <div key={clue.number} className="flex flex-col">
                           <div 
                             className={clsx(
                               "flex gap-3 text-sm p-3 transition-all cursor-text rounded-lg border",
                               isActive ? "bg-indigo-50 border-indigo-200 shadow-sm text-indigo-900" : "hover:bg-slate-50 border-transparent text-slate-700"
                             )}
                             onClick={() => {
                               setSelectedCell({x: clue.x, y: clue.y});
                               setDirection(dir as 'across'|'down');
                             }}
                           >
                             <div className="flex flex-col items-end min-w-[28px] shrink-0">
                               <span className="font-extrabold text-right">{clue.number}</span>
                               <span className="text-[10px] font-semibold text-slate-400">({clue.length})</span>
                             </div>
                             <input 
                               className="flex-1 bg-transparent font-medium outline-none placeholder:text-slate-300 min-w-0"
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
                           </div>
                           {isActive && (
                             <motion.div 
                               initial={{ height: 0, opacity: 0 }}
                               animate={{ height: "auto", opacity: 1 }}
                               className="px-4 pb-4 ml-[40px] text-lg tracking-[0.25em] font-mono font-bold text-indigo-400 uppercase overflow-hidden"
                             >
                                 {(() => {
                                    let word = '';
                                    if (dir === 'across') {
                                       for(let i=0; i<clue.length; i++) {
                                          word += getCell(clue.x + i, clue.y)?.value || '_';
                                       }
                                    } else {
                                       for(let i=0; i<clue.length; i++) {
                                          word += getCell(clue.x, clue.y + i)?.value || '_';
                                       }
                                    }
                                    return word;
                                 })()}
                             </motion.div>
                           )}
                         </div>
                       );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
