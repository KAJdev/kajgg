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
    <div className="h-full flex items-center justify-center px-2">
      <div className="flex gap-2 overflow-x-auto py-4">
        {cards.map((card, index) => {
          const totalCards = cards.length;
          const middleIndex = (totalCards - 1) / 2;
          const offset = index - middleIndex;
          const rotation = offset * 1.25;
          const yOffset = Math.abs(offset) * 2;

          return (
            <motion.div
              key={card.instanceId || index}
              initial={{ opacity: 0, y: 18 }}
              animate={{
                opacity: 1,
                y: yOffset,
                rotate: rotation,
              }}
              transition={{ delay: index * 0.03 }}
              whileHover={
                canPlay
                  ? {
                      y: -18,
                      scale: 1.05,
                      rotate: 0,
                      transition: {
                        type: "spring",
                        stiffness: 300,
                        damping: 24,
                      },
                    }
                  : undefined
              }
              className={cn(
                "relative hover-lift",
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
