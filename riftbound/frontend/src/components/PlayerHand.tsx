import { motion } from "motion/react";
import { cn } from "@lib/utils";
import { useGameStore } from "@lib/store";
import { CardImage } from "./CardImage";
import type { CardInstance } from "@/types";

interface PlayerHandProps {
  cards: CardInstance[];
}

export function PlayerHand({ cards }: PlayerHandProps) {
  const { selectedCard, setSelectedCard, isMyTurn, gameState, myPlayerId } = useGameStore();
  const canPlay =
    gameState?.phase === "main" &&
    (isMyTurn() ||
      (gameState.waitingForResponse &&
        !!myPlayerId &&
        gameState.priorityPlayer === myPlayerId));

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
      <div className="flex gap-3 overflow-x-auto py-6">
        {cards.map((card, index) => {
          const totalCards = cards.length;
          const middleIndex = (totalCards - 1) / 2;
          const offset = index - middleIndex;
          const rotation = offset * 2;
          const yOffset = Math.abs(offset) * 3;
          
          return (
            <motion.div
              key={card.instanceId || index}
              initial={{ opacity: 0, y: 50 }}
              animate={{ 
                opacity: 1, 
                y: yOffset,
                rotate: rotation,
              }}
              transition={{ delay: index * 0.05 }}
              whileHover={canPlay ? { 
                y: -30, 
                scale: 1.08,
                rotate: 0,
                transition: { type: "spring", stiffness: 300, damping: 20 }
              } : undefined}
              className={cn(
                "relative transition-all card-lift-shadow",
                canPlay ? "cursor-pointer" : "cursor-not-allowed opacity-60"
              )}
              onClick={() => handleCardClick(card)}
              style={{ zIndex: index }}
            >
              <CardImage
                card={card}
                size="sm"
                selected={selectedCard?.instanceId === card.instanceId}
              />
            </motion.div>
          );
        })}

        {cards.length === 0 && (
          <div className="flex items-center justify-center text-text-dim text-sm py-8">
            <span>your hand is empty</span>
          </div>
        )}
      </div>
    </div>
  );
}
