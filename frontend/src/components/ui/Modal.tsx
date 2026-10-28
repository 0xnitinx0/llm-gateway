import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { smoothTransition } from './motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, subtitle, children, maxWidth = 'md' }) => {
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeCallback = useRef(onClose);
  closeCallback.current = onClose;
  const reducedMotion = useReducedMotion();
  const [present, setPresent] = useState(isOpen);
  const blocking = isOpen || present;

  useEffect(() => { if (isOpen) setPresent(true); }, [isOpen]);

  useEffect(() => {
    if (!blocking) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const root = document.getElementById('root');
    const previousInert = root?.inert ?? false;
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCallback.current();
      if (event.key !== 'Tab') return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
      if (!items?.length) { event.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (root) root.inert = previousInert;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [blocking]);

  const widthStyles = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };
  const close = () => onClose();

  return createPortal(
    <AnimatePresence onExitComplete={() => setPresent(false)}>
      {isOpen && (
        <DialogPresence>
          <div className="absolute inset-0 bg-earth-900/35 backdrop-blur-[3px]" onClick={close} aria-hidden="true" />
          <motion.div
            ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={subtitle ? subtitleId : undefined} tabIndex={-1}
            initial={{ y: reducedMotion ? 0 : 12, scale: reducedMotion ? 1 : 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: reducedMotion ? 0 : 8, scale: reducedMotion ? 1 : 0.98 }}
            transition={reducedMotion ? { duration: 0 } : smoothTransition}
            className={`relative w-full ${widthStyles[maxWidth]} gateway-card shadow-xl max-h-[90dvh] overflow-y-auto ${isOpen ? '' : 'pointer-events-none'}`}
          >
            <div className="px-5 py-4 border-b border-earth-100 flex items-center justify-between gap-3">
              <div>
                <h3 id={titleId} className="text-base font-semibold text-earth-900">{title}</h3>
                {subtitle && <p id={subtitleId} className="text-xs text-earth-500 mt-1">{subtitle}</p>}
              </div>
              <button onClick={close} aria-label="Close dialog" className="p-1.5 rounded-lg text-earth-500 hover:text-earth-800 hover:bg-earth-100 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </DialogPresence>
      )}
    </AnimatePresence>,
    document.body,
  );
};

// Keep the overlay mounted through its exit while disabling its controls.
const DialogPresence: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isPresent = useIsPresent();
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) containerRef.current.inert = !isPresent;
  }, [isPresent]);
  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ pointerEvents: isPresent ? 'auto' : 'none' }}
      initial={{ opacity: reducedMotion ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: reducedMotion ? 1 : 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.18 }}
    >
      {children}
    </motion.div>
  );
};
