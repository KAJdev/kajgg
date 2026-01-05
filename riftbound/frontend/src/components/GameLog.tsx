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
    <div className="absolute right-6 top-6 bottom-6 w-72 bg-void-deep/90 backdrop-blur-md border border-arcane/20 rounded-lg overflow-hidden flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.6)]">
      {/* header */}
      <div className="px-4 py-3 border-b border-arcane/20 bg-shadow/30">
        <h3 className="font-display text-sm uppercase tracking-wider text-arcane">
          Game Log
        </h3>
      </div>

      {/* log entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence initial={false}>
          {gameState?.actionLog.map((action, index) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, x: 30, scale: 0.95 }}
              animate={{ 
                opacity: 1, 
                x: 0, 
                scale: 1,
                transition: { 
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                  delay: index * 0.02
                }
              }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
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
    <motion.div
      whileHover={{ scale: 1.02, x: 4 }}
      className={cn(
        "px-3 py-2 text-xs rounded transition-all duration-300",
        "bg-shadow/50 border-l-2 hover:bg-shadow/70",
        getActionBorderColor(action.type)
      )}
    >
      <span className="text-text-dim leading-relaxed">{message}</span>
    </motion.div>
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
