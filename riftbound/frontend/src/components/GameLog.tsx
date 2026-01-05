import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ScrollText, X } from "lucide-react";
import { useGameStore } from "@lib/store";
import { cn } from "@lib/utils";
import type { GameAction } from "@/types";

export function GameLog() {
  const { gameState } = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (collapsed) return;
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [collapsed, gameState?.actionLog.length]);

  const actions = gameState?.actionLog ?? [];

  return (
    <div
      className={cn(
        "absolute right-4 top-4 z-40 transition-all",
        collapsed ? "w-9 h-9" : "w-72 max-h-[60vh]"
      )}
    >
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className={cn(
            "w-9 h-9 rounded-lg bg-void-deep/70 backdrop-blur-sm",
            "shadow-[0_0_24px_rgba(0,0,0,0.45)]",
            "flex items-center justify-center",
            "text-text-dim hover:text-arcane transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-arcane/30"
          )}
          aria-label="Open game log"
        >
          <ScrollText size={16} />
        </button>
      ) : (
        <div className="bg-void-deep/85 backdrop-blur-sm rounded-lg overflow-hidden shadow-[0_0_34px_rgba(0,0,0,0.55)]">
          <div className="px-3 py-2 flex items-center justify-between bg-shadow/20">
            <span className="text-[10px] uppercase tracking-wider text-text-dim">
              Log
            </span>
            <button
              onClick={() => setCollapsed(true)}
              className="text-text-dim hover:text-text transition-colors"
              aria-label="Close game log"
            >
              <X size={16} />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="max-h-[50vh] overflow-y-auto p-2 space-y-1"
          >
            {actions.length === 0 ? (
              <p className="text-text-dim/50 text-xs text-center py-4">
                no actions yet
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {actions.map((action) => (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.14 }}
                  >
                    <LogEntry action={action} />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LogEntry({ action }: { action: GameAction }) {
  const message = formatActionMessage(action);

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded px-2 py-1",
        "bg-shadow/30 hover:bg-shadow/45 transition-colors"
      )}
    >
      <span
        className={cn(
          "mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0",
          getActionDotColor(action.type)
        )}
      />
      <span className="text-text-dim text-xs leading-relaxed">{message}</span>
    </div>
  );
}

function formatActionMessage(action: GameAction): string {
  const data = action.data as Record<string, unknown>;

  switch (action.type) {
    case "draw_card":
      if (data.type === "score") {
        return `scored ${data.points} point${(data.points as number) !== 1 ? "s" : ""}`;
      }
      return `drew a card`;
    case "channel_rune":
      return `channeled ${data.runeName || "a rune"}`;
    case "play_card":
      return `played ${data.cardName || "a card"}`;
    case "move_unit":
      return `moved a unit`;
    case "attack":
      return `${data.attacker} attacked ${data.target}`;
    case "activate_ability":
      return `activated ability`;
    case "end_phase":
      return `ended phase`;
    case "end_turn":
      return `ended turn`;
    case "concede":
      return `conceded the game`;
    default:
      return `${action.type}`;
  }
}

function getActionDotColor(type: string): string {
  switch (type) {
    case "play_card":
      return "bg-hextech";
    case "attack":
      return "bg-danger";
    case "channel_rune":
      return "bg-shurima";
    case "end_turn":
      return "bg-arcane";
    default:
      return "bg-text-dim";
  }
}
