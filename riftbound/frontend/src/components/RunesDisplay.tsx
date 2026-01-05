import { motion, AnimatePresence } from "motion/react";
import { cn } from "@lib/utils";
import type { CardInstance } from "@/types";
import { useGameStore } from "@lib/store";
import { CardImage } from "./CardImage";

interface RunesDisplayProps {
  runes: CardInstance[];
}

export function RunesDisplay({ runes }: RunesDisplayProps) {
  const { sendCommand, isMyTurn, gameState } = useGameStore();

  if (runes.length === 0) {
    return <span className="text-text-dim/50 text-xs">no runes channeled</span>;
  }

  return (
    <div className="flex gap-2">
      <AnimatePresence mode="popLayout">
        {runes.map((rune, index) => (
          <motion.button
            key={rune.instanceId}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: {
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: index * 0.05,
              },
            }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            whileHover={
              !rune.exhausted
                ? {
                    scale: 1.1,
                    y: -4,
                    transition: { type: "spring", stiffness: 400, damping: 20 },
                  }
                : undefined
            }
            whileTap={!rune.exhausted ? { scale: 0.95 } : undefined}
            className={cn(
              "w-12 h-16 rounded border overflow-hidden transition-all duration-300",
              rune.exhausted
                ? "bg-mist/30 border-mist/50 text-text-dim opacity-50"
                : "border-shurima/60 hover:border-arcane/80 rune-shimmer shadow-[0_0_15px_rgba(212,166,54,0.3)]"
            )}
            title={`${rune.title}${rune.exhausted ? " (exhausted)" : ""}`}
            disabled={
              rune.exhausted || !isMyTurn() || gameState?.phase !== "main"
            }
            onClick={() => {
              if (rune.exhausted) return;
              sendCommand({
                type: "tap_rune",
                runeInstanceId: rune.instanceId,
              });
            }}
          >
            <CardImage card={rune} size="xs" className="w-full h-full" />
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
