import { useGameStore } from "@lib/store";
import { Button } from "@theme/index";
import { Flag } from "lucide-react";

export function GameControls() {
  const { isMyTurn, sendCommand, getMyPlayer } = useGameStore();
  const myTurn = isMyTurn();
  const myPlayer = getMyPlayer();

  function handleEndTurn() {
    sendCommand({ type: "end_turn" });
  }

  function handleConcede() {
    if (confirm("are you sure you want to concede?")) {
      sendCommand({ type: "concede" });
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-baseline gap-2">
        <span className="hidden sm:inline text-[10px] text-text-dim/60 uppercase tracking-wider">
          Score
        </span>
        <span className="font-display text-base sm:text-lg text-arcane tabular-nums">
          {myPlayer?.score || 0}
        </span>
      </div>

      <div className="hidden md:block text-xs text-text-dim/60 whitespace-nowrap">
        H {myPlayer?.hand?.length || 0} • D {myPlayer?.mainDeckSize || 0}
      </div>

      <Button
        variant="primary"
        size="sm"
        onClick={handleEndTurn}
        disabled={!myTurn}
      >
        End Turn
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleConcede}
        className="px-2 text-text-dim hover:text-danger"
        aria-label="Concede"
      >
        <Flag size={16} />
      </Button>
    </div>
  );
}
