import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export type GridSize = {
  width: number;
  height: number;
};

export type GridSizeDialogOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type GridSizeDialogContextValue = {
  openGridSizeDialog: (opts?: GridSizeDialogOptions) => Promise<GridSize | null>;
};

const GridSizeDialogContext = createContext<GridSizeDialogContextValue | null>(null);

export function GridSizeDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<GridSizeDialogOptions | null>(null);
  const resolverRef = useRef<((value: GridSize | null) => void) | null>(null);

  const openGridSizeDialog = useCallback((o: GridSizeDialogOptions = {}) => {
    return new Promise<GridSize | null>((resolve) => {
      resolverRef.current = resolve;
      setOpts(o);
      setOpen(true);
    });
  }, []);

  const finish = useCallback((value: GridSize | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpen(false);
    setOpts(null);
  }, []);

  return (
    <GridSizeDialogContext.Provider value={{ openGridSizeDialog }}>
      {children}
      <AnimatePresence>
        {open && (
          <GridSizeModal opts={opts} onClose={finish} />
        )}
      </AnimatePresence>
    </GridSizeDialogContext.Provider>
  );
}

function GridSizeModal({ opts, onClose }: { opts: GridSizeDialogOptions | null; onClose: (value: GridSize | null) => void }) {
  const [width, setWidth] = useState(15);
  const [height, setHeight] = useState(15);

  const handleConfirm = () => {
    onClose({ width, height });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => onClose(null)}
        aria-label="Dismiss"
      />
      <motion.div
        role="dialog"
        aria-modal
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        className="relative z-10 w-full max-w-sm rounded-sm border border-[#8bab84]/38 bg-[linear-gradient(165deg,#1a261c,#27392c)] shadow-[0_24px_60px_rgba(8,12,10,0.55)] p-6 text-[#edf4e4]"
        onClick={(e) => e.stopPropagation()}
      >
        {opts?.title && <h2 className="font-display text-xl mb-4 text-[#f0f4e9]">{opts.title}</h2>}
        
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block font-mono text-xs text-[#a8b8a2] mb-2">Width</label>
            <input
              type="number"
              min={5}
              max={21}
              value={width}
              onChange={(e) => setWidth(Math.max(5, Math.min(21, parseInt(e.target.value) || 5)))}
              className="w-full px-3 py-2 bg-[#1a261c] border border-[#4a6647]/50 rounded-sm font-mono text-[#eef5e4] focus:outline-none focus:border-[#8bab84]"
            />
          </div>
          <div className="flex-1">
            <label className="block font-mono text-xs text-[#a8b8a2] mb-2">Height</label>
            <input
              type="number"
              min={5}
              max={21}
              value={height}
              onChange={(e) => setHeight(Math.max(5, Math.min(21, parseInt(e.target.value) || 5)))}
              className="w-full px-3 py-2 bg-[#1a261c] border border-[#4a6647]/50 rounded-sm font-mono text-[#eef5e4] focus:outline-none focus:border-[#8bab84]"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            className="px-4 py-2 rounded-sm font-subhead text-sm text-[#c7d0bd] hover:bg-white/[0.06] transition-colors"
            onClick={() => onClose(null)}
          >
            {opts?.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-sm font-subhead text-sm font-semibold bg-[#4a6647] text-[#eef5e4] hover:bg-[#567452] transition-colors"
            onClick={handleConfirm}
          >
            {opts?.confirmLabel ?? 'Create'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function useGridSizeDialog() {
  const ctx = useContext(GridSizeDialogContext);
  if (!ctx) throw new Error('useGridSizeDialog must be used within GridSizeDialogProvider');
  return ctx.openGridSizeDialog;
}