import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useGameStore } from "@lib/store";
import { cn } from "@lib/utils";
import type { GameAction } from "@/types";

export function GameLog() {
  const { gameState } = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // auto-scroll to bottom on new actions
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState?.actionLog.length]);

  return (
    <div className="absolute right-4 top-4 bottom-4 w-64 bg-void-deep/80 backdrop-blur-sm border border-arcane/20 rounded overflow-hidden flex flex-col">
      {/* header */}
      <div className="px-4 py-2 border-b border-arcane/20">
        <h3 className="font-display text-xs uppercase tracking-wider text-arcane">
          Game Log
        </h3>
      </div>

      {/* log entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        <AnimatePresence>
          {gameState?.actionLog.map((action) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              <LogEntry action={action} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* empty state */}
        {(!gameState?.actionLog || gameState.actionLog.length === 0) && (
          <p className="text-text-dim/50 text-xs text-center py-4">
            no actions yet
          </p>
        )}
      </div>
    </div>
  );
}

function LogEntry({ action }: { action: GameAction }) {
  const message = formatActionMessage(action);

  return (
    <div
      className={cn(
        "px-2 py-1 text-xs rounded",
        "bg-shadow/30 border-l-2",
        getActionBorderColor(action.type)
      )}
    >
      <span className="text-text-dim">{message}</span>
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

function getActionBorderColor(type: string): string {
  switch (type) {
    case "play_card":
      return "border-l-hextech";
    case "attack":
      return "border-l-danger";
    case "channel_rune":
      return "border-l-shurima";
    case "end_turn":
      return "border-l-arcane";
    default:
      return "border-l-text-dim";
  }
}
