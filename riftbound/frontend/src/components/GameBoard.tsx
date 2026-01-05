import { motion } from "motion/react";
import { cn } from "@lib/utils";
import { useGameStore } from "@lib/store";
import { CardImage } from "./CardImage";
import type { Battlefield, CardInstance, PlayerPosition } from "@/types";

export function GameBoard() {
  const {
    gameState,
    getMyPlayer,
    sendCommand,
    selectedCard,
    setSelectedCard,
    setSelectedBattlefield,
  } = useGameStore();

  const myPlayer = getMyPlayer();
  const myPosition = myPlayer?.position;
  const myBaseUnits = myPlayer?.baseUnits || [];
  const myBaseGear = myPlayer?.baseGear || [];

  if (!gameState || gameState.battlefields.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-text-dim">waiting for game to start...</p>
      </div>
    );
  }

  function handleBattlefieldClick(bfId: string) {
    if (selectedCard) {
      // play card to battlefield
      sendCommand({
        type: "play_card",
        cardInstanceId: selectedCard.instanceId,
        battlefieldId: bfId,
      });
      setSelectedCard(null);
    } else {
      setSelectedBattlefield(bfId);
    }
  }

  function handleBaseClick() {
    if (selectedCard) {
      // play card to base (no battlefieldId)
      sendCommand({
        type: "play_card",
        cardInstanceId: selectedCard.instanceId,
      });
      setSelectedCard(null);
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-8">
      {/* enemy base placeholder */}
      <div className="w-full max-w-5xl border border-mist/20 bg-shadow/20 p-3">
        <div className="text-xs text-text-dim uppercase tracking-wider mb-2">
          enemy base
        </div>
        <div className="flex gap-2 min-h-[56px] opacity-60">
          <span className="text-text-dim/40 text-xs">hidden</span>
        </div>
      </div>

      {/* battlefields */}
      <div className="flex gap-10">
        {gameState.battlefields.map((bf, index) => (
          <motion.div
            key={bf.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <BattlefieldZone
              battlefield={bf}
              myPosition={myPosition}
              onClick={() => handleBattlefieldClick(bf.id)}
              canDrop={!!selectedCard}
            />
          </motion.div>
        ))}
      </div>

      {/* your base */}
      <div
        className={cn(
          "w-full max-w-5xl border bg-shadow/30 p-3 transition-all duration-300",
          "border-arcane/20",
          selectedCard &&
            "cursor-pointer hover:border-arcane/60 hover:bg-arcane/5"
        )}
        onClick={selectedCard ? handleBaseClick : undefined}
      >
        <div className="text-xs text-text-dim uppercase tracking-wider mb-2">
          your base
        </div>
        <div className="flex gap-3 min-h-[56px] flex-wrap">
          {myBaseGear.map((g) => (
            <CardImage key={g.instanceId} card={g} size="xs" />
          ))}
          {myBaseUnits.map((u) => (
            <CardImage key={u.instanceId} card={u} size="xs" />
          ))}
          {myBaseUnits.length === 0 && myBaseGear.length === 0 && (
            <span className="text-text-dim/40 text-xs">empty</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface BattlefieldZoneProps {
  battlefield: Battlefield;
  myPosition?: PlayerPosition;
  onClick: () => void;
  canDrop: boolean;
}

function BattlefieldZone({
  battlefield,
  myPosition,
  onClick,
  canDrop,
}: BattlefieldZoneProps) {
  const { sendCommand } = useGameStore();

  const opponentUnits =
    myPosition === "player1"
      ? battlefield.player2Units
      : battlefield.player1Units;
  const myUnits =
    myPosition === "player1"
      ? battlefield.player1Units
      : battlefield.player2Units;

  const controlColor = {
    none: "border-mist/30",
    player1:
      myPosition === "player1" ? "border-success/50" : "border-danger/50",
    player2:
      myPosition === "player2" ? "border-success/50" : "border-danger/50",
    contested: "border-shurima/50",
  }[battlefield.control];

  function handleAttack(attackerId: string, targetId: string) {
    sendCommand({
      type: "attack",
      attackerId,
      targetId,
      battlefieldId: battlefield.id,
    });
  }

  function handleSpellTarget(targetId: string) {
    const { selectedCard, setSelectedCard } = useGameStore.getState();
    if (!selectedCard) return;
    if ((selectedCard.type || "").toLowerCase() !== "spell") return;
    sendCommand({
      type: "play_card",
      cardInstanceId: selectedCard.instanceId,
      battlefieldId: battlefield.id,
      targetInstanceId: targetId,
    });
    setSelectedCard(null);
  }

  return (
    <div
      onClick={canDrop ? onClick : undefined}
      className={cn(
        "w-64 min-h-[480px] p-4 flex flex-col transition-all duration-300",
        "border-2 rounded-lg bg-shadow/30",
        controlColor,
        battlefield.control === "contested" && "animate-pulse-contested",
        canDrop && "cursor-pointer hover:bg-arcane/10 hover:border-arcane/50"
      )}
    >
      {/* battlefield card (center anchor) */}
      <div className="flex flex-col items-center mb-4">
        {battlefield.card ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="animate-float-gentle"
          >
            <CardImage card={battlefield.card} size="md" className="w-48" />
          </motion.div>
        ) : (
          <div className="w-48 aspect-4/3 border border-arcane/20 bg-void-deep/60 flex items-center justify-center">
            <span className="font-display text-xs uppercase tracking-wider text-arcane text-center px-2">
              {battlefield.name}
            </span>
          </div>
        )}
        {battlefield.control !== "none" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              "text-xs mt-2 font-display uppercase tracking-wider",
              battlefield.control === "contested"
                ? "text-shurima"
                : battlefield.control === myPosition
                ? "text-success"
                : "text-danger"
            )}
          >
            {battlefield.control === "contested"
              ? "contested"
              : battlefield.control === myPosition
              ? "you control"
              : "enemy controls"}
          </motion.div>
        )}
      </div>

      {/* opponent's units (top) */}
      <div className="flex-1 flex flex-col gap-2 items-center justify-end pb-3 border-b border-arcane/20">
        <span className="text-xs text-text-dim mb-1 uppercase tracking-wider">enemy</span>
        {opponentUnits.length === 0 ? (
          <div className="text-text-dim/30 text-xs">empty</div>
        ) : (
          opponentUnits.map((unit) => (
            <UnitCard
              key={unit.instanceId}
              unit={unit}
              isEnemy
              onClick={(targetId) => {
                // if we have a selected spell, cast at target; else attack if selected attacker
                const { selectedCard: sel } = useGameStore.getState();
                if (sel && (sel.type || "").toLowerCase() === "spell") {
                  handleSpellTarget(targetId);
                  return;
                }
                if (
                  sel &&
                  myUnits.some((u) => u.instanceId === sel.instanceId)
                ) {
                  handleAttack(sel.instanceId, targetId);
                }
              }}
            />
          ))
        )}
      </div>

      {/* my units (bottom) */}
      <div className="flex-1 flex flex-col gap-2 items-center justify-start pt-3">
        <span className="text-xs text-text-dim mb-1 uppercase tracking-wider">you</span>
        {myUnits.length === 0 ? (
          <div className="text-text-dim/30 text-xs">empty</div>
        ) : (
          myUnits.map((unit) => <UnitCard key={unit.instanceId} unit={unit} />)
        )}
      </div>
    </div>
  );
}

interface UnitCardProps {
  unit: CardInstance;
  isEnemy?: boolean;
  onClick?: (instanceId: string) => void;
}

function UnitCard({ unit, isEnemy, onClick }: UnitCardProps) {
  const { selectedCard, setSelectedCard, isMyTurn } = useGameStore();
  const isSelected = selectedCard?.instanceId === unit.instanceId;

  function handleClick() {
    if (isEnemy && onClick) {
      onClick(unit.instanceId);
    } else if (!isEnemy && isMyTurn() && !unit.exhausted) {
      // select own unit for attacking
      if (isSelected) {
        setSelectedCard(null);
      } else {
        setSelectedCard(unit);
      }
    }
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative cursor-pointer transition-all",
        isSelected && "ring-2 ring-arcane scale-105",
        unit.exhausted && "opacity-60 rotate-6"
      )}
    >
      <CardImage card={unit} size="xs" />

      {/* stats overlay */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-xs font-bold">
        <span className="text-danger">{unit.attack}</span>
        <span className="text-success">{unit.currentHealth - unit.damage}</span>
      </div>
    </div>
  );
}
