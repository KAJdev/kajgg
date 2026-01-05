import { motion } from "motion/react";
import { useGameStore } from "@lib/store";
import { Button } from "@theme/index";
import { Flag } from "lucide-react";
import { ChainDisplay } from "./ChainDisplay";

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
    <div className="flex items-center gap-6 px-6 py-4">
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-xs text-text-dim uppercase tracking-wider">Turn</p>
          <motion.p
            key={gameState?.turnNumber}
            initial={{ scale: 1.2, color: "var(--color-arcane-glow)" }}
            animate={{ scale: 1, color: "var(--color-arcane)" }}
            transition={{ duration: 0.3 }}
            className="font-display text-2xl text-arcane"
          >
            {gameState?.turnNumber || 1}
          </motion.p>
        </div>
        <div className="h-10 w-px bg-arcane/30" />
        <div className="text-center">
          <p className="text-xs text-text-dim uppercase tracking-wider">
            Energy
          </p>
          <motion.p
            key={myPlayer?.energy}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="font-display text-2xl text-shurima"
          >
            {myPlayer?.energy || 0}
          </motion.p>
        </div>
      </div>

      <div className="flex-1 flex justify-center">
        <ChainDisplay />
      </div>

      <div className="flex items-center gap-4">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="primary"
            size="sm"
            onClick={handleEndTurn}
            disabled={!myTurn}
            className="px-6 py-2"
          >
            End Turn
          </Button>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleConcede}
            className="text-text-dim hover:text-danger transition-colors duration-300"
          >
            <Flag size={16} />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
