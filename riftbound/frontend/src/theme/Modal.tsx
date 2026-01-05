import { cn } from "@lib/utils";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50"
          />
          
          {/* modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              "z-50 w-full max-w-lg",
              "bg-void-deep border-2 border-arcane/30",
              "shadow-[0_0_40px_rgba(200,170,110,0.15)]",
              className
            )}
          >
            {/* header */}
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-arcane/20">
                <h2 className="font-display text-lg uppercase tracking-wider text-arcane">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="text-text-dim hover:text-text transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            
            {/* content */}
            <div className="p-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

