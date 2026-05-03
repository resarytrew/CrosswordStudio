import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmContextValue = { confirm: (opts: ConfirmOptions) => Promise<boolean> };

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpts(o);
      setOpen(true);
    });
  }, []);

  const finish = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpen(false);
    setOpts(null);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {open && opts && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.button
              type="button"
              className="absolute inset-0 bg-black/55 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => finish(false)}
              aria-label="Dismiss"
            />
            <motion.div
              role="dialog"
              aria-modal
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="relative z-10 w-full max-w-md rounded-sm border border-[#8bab84]/38 bg-[linear-gradient(165deg,#1a261c,#27392c)] shadow-[0_24px_60px_rgba(8,12,10,0.55)] p-6 text-[#edf4e4]"
              onClick={(e) => e.stopPropagation()}
            >
              {opts.title && <h2 className="font-display text-xl mb-2 text-[#f0f4e9]">{opts.title}</h2>}
              <p className="font-body text-[#dce6d4]/92 mb-6 leading-relaxed">{opts.message}</p>
              <div className="flex flex-wrap gap-3 justify-end">
                <button
                  type="button"
                  className="px-4 py-2 rounded-sm font-subhead text-sm text-[#c7d0bd] hover:bg-white/[0.06] transition-colors"
                  onClick={() => finish(false)}
                >
                  {opts.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  type="button"
                  className={clsx(
                    'px-4 py-2 rounded-sm font-subhead text-sm font-semibold transition-colors',
                    opts.destructive
                      ? 'bg-[#5c382c] text-[#fdeee9] hover:bg-[#6f4538]'
                      : 'bg-[#4a6647] text-[#eef5e4] hover:bg-[#567452]'
                  )}
                  onClick={() => finish(true)}
                >
                  {opts.confirmLabel ?? 'OK'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}
