import { useGameStore } from "@lib/store";
import { Button } from "@theme/index";
import { Flag } from "lucide-react";

export function GameControls() {
  const { gameState, isMyTurn, sendCommand, getMyPlayer } = useGameStore();
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
    <div className="flex items-center justify-between px-6 py-3">
      {/* turn/phase info */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-xs text-text-dim uppercase">Turn</p>
          <p className="font-display text-xl text-arcane">{gameState?.turnNumber || 1}</p>
        </div>
        <div className="h-8 w-px bg-arcane/20" />
        <div>
          <p className="text-xs text-text-dim uppercase">Energy</p>
          <p className="font-display text-lg text-shurima">
            {myPlayer?.energy || 0}
          </p>
        </div>
      </div>

      {/* action buttons */}
      <div className="flex items-center gap-3">
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
          className="text-text-dim hover:text-danger"
        >
          <Flag size={16} />
        </Button>
      </div>
    </div>
  );
}
