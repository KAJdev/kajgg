import { AnimatePresence, motion } from "motion/react";
import { cn, getCardImageUrl } from "@lib/utils";
import type { CardInstance } from "@/types";
import { useGameStore } from "@lib/store";
import { useMemo } from "react";

interface RunesDisplayProps {
  runes: CardInstance[];
}

export function RunesDisplay({ runes }: RunesDisplayProps) {
  const { sendCommand, isMyTurn, gameState } = useGameStore();

  const canTapRunes = isMyTurn() && gameState?.phase === "main";

  const groupedRunes = useMemo(() => {
    const groups = new Map<string, CardInstance[]>();

    for (const rune of runes) {
      const color = rune.color || "colorless";
      const existing = groups.get(color);
      if (existing) {
        existing.push(rune);
      } else {
        groups.set(color, [rune]);
      }
    }

    return Array.from(groups.entries()).map(([color, colorRunes]) => ({
      color,
      runes: [...colorRunes].sort(
        (a, b) => Number(b.exhausted) - Number(a.exhausted)
      ),
    }));
  }, [runes]);

  if (runes.length === 0) {
    return <span className="text-text-dim/40 text-xs">no runes</span>;
  }

  function handleRuneClick(rune: CardInstance) {
    if (!canTapRunes || rune.exhausted) return;
    sendCommand({ type: "tap_rune", runeInstanceId: rune.instanceId });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {groupedRunes.map(({ color, runes: colorRunes }) => {
        const readyCount = colorRunes.filter((r) => !r.exhausted).length;
        const total = colorRunes.length;

        const cardW = 32;
        const cardH = 44;
        const overlap = 12;
        const stackW = cardW + Math.max(0, total - 1) * overlap;

        return (
          <div key={color} className="flex items-center gap-2">
            <div
              className="relative"
              style={{ width: `${stackW}px`, height: `${cardH}px` }}
            >
              <AnimatePresence initial={false}>
                {colorRunes.map((rune, idx) => {
                  const isInteractive = canTapRunes && !rune.exhausted;

                  return (
                    <motion.button
                      key={rune.instanceId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      whileHover={
                        isInteractive
                          ? {
                              y: -6,
                              zIndex: 100,
                              transition: {
                                type: "spring",
                                stiffness: 500,
                                damping: 30,
                              },
                            }
                          : undefined
                      }
                      whileTap={isInteractive ? { scale: 0.98 } : undefined}
                      style={{ left: `${idx * overlap}px`, zIndex: idx }}
                      title={`${rune.title}${rune.exhausted ? " (exhausted)" : ""}`}
                      onClick={() => handleRuneClick(rune)}
                      disabled={!isInteractive}
                      className={cn(
                        "absolute top-0 w-8 h-11 rounded border overflow-hidden bg-void-deep/40",
                        "transition-transform duration-150",
                        "focus:outline-none focus:ring-2 focus:ring-arcane/30",
                        rune.exhausted
                          ? "opacity-40 border-mist/30 pointer-events-none"
                          : "border-shurima/50 hover:border-arcane hover:shadow-[0_0_14px_rgba(200,170,110,0.22)]"
                      )}
                    >
                      <img
                        src={getCardImageUrl(rune.set || "", rune.number || 0)}
                        alt={rune.title}
                        loading="lazy"
                        className={cn(
                          "w-full h-full object-cover",
                          rune.exhausted && "grayscale"
                        )}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `https://placehold.co/64x88/1a1a2e/c8aa6e?text=${encodeURIComponent(rune.title)}`;
                        }}
                      />
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

            {total > 1 && (
              <span className="text-[10px] tabular-nums text-text-dim/60">
                {readyCount}/{total}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
