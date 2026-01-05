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
    <div className="flex gap-1">
      {runes.map((rune) => (
        <button
          key={rune.instanceId}
          className={cn(
            "w-10 h-14 rounded border overflow-hidden",
            rune.exhausted
              ? "bg-mist/30 border-mist/50 text-text-dim rotate-6"
              : "border-shurima/50 hover:border-arcane/60"
          )}
          title={`${rune.title}${rune.exhausted ? " (exhausted)" : ""}`}
          disabled={rune.exhausted || !isMyTurn() || gameState?.phase !== "main"}
          onClick={() => {
            if (rune.exhausted) return;
            sendCommand({ type: "tap_rune", runeInstanceId: rune.instanceId });
          }}
        >
          <CardImage card={rune} size="xs" className="w-full h-full" />
        </button>
      ))}
    </div>
  );
}

