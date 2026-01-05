import { motion } from "motion/react";
import { cn } from "@lib/utils";
import { useGameStore } from "@lib/store";
import { CardImage } from "./CardImage";
import type { CardInstance } from "@/types";

interface PlayerHandProps {
  cards: CardInstance[];
}

export function PlayerHand({ cards }: PlayerHandProps) {
  const { selectedCard, setSelectedCard, isMyTurn, gameState } = useGameStore();
  const canPlay = isMyTurn() && gameState?.phase === "main";

  function handleCardClick(card: CardInstance) {
    if (!canPlay) return;

    if (selectedCard?.instanceId === card.instanceId) {
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
    }
  }

  return (
    <div className="h-full flex items-center justify-center px-8">
      <div className="flex gap-2 overflow-x-auto py-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.instanceId || index}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={canPlay ? { y: -20, scale: 1.05 } : undefined}
            className={cn(
              "relative transition-all",
              canPlay ? "cursor-pointer" : "cursor-not-allowed opacity-60"
            )}
            onClick={() => handleCardClick(card)}
          >
            <CardImage
              card={card}
              size="sm"
              selected={selectedCard?.instanceId === card.instanceId}
            />
          </motion.div>
        ))}

        {cards.length === 0 && (
          <div className="flex items-center justify-center text-text-dim text-sm py-8">
            <span>your hand is empty</span>
          </div>
        )}
      </div>
    </div>
  );
}
