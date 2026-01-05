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
      sendCommand({
        type: "play_card",
        cardInstanceId: selectedCard.instanceId,
      });
      setSelectedCard(null);
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 gap-6">
      <div className="w-full max-w-5xl rounded-lg bg-shadow/20 px-4 py-3">
        <div className="text-[10px] text-text-dim/60 uppercase tracking-wider mb-2">
          opponent base
        </div>
        <div className="flex gap-2 min-h-[56px] opacity-60">
          <span className="text-text-dim/40 text-xs">hidden</span>
        </div>
      </div>

      <div className="w-full max-w-6xl flex flex-wrap justify-center gap-6">
        {gameState.battlefields.map((bf, index) => (
          <motion.div
            key={bf.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
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

      <div
        className={cn(
          "w-full max-w-5xl rounded-lg bg-shadow/30 px-4 py-3 transition-colors",
          selectedCard && "cursor-pointer hover:bg-arcane/5"
        )}
        onClick={selectedCard ? handleBaseClick : undefined}
      >
        <div className="text-[10px] text-text-dim/60 uppercase tracking-wider mb-2">
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
    myPosition === "player1" ? battlefield.player2Units : battlefield.player1Units;
  const myUnits =
    myPosition === "player1" ? battlefield.player1Units : battlefield.player2Units;

  const controlBg = {
    none: "bg-shadow/20",
    player1: myPosition === "player1" ? "bg-success/5" : "bg-danger/5",
    player2: myPosition === "player2" ? "bg-success/5" : "bg-danger/5",
    contested: "bg-shurima/10",
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
        "w-56 min-h-[380px] p-3 flex flex-col rounded-lg transition-colors",
        "shadow-[0_0_0_1px_rgba(160,155,140,0.10)]",
        controlBg,
        canDrop &&
          "cursor-pointer hover:bg-arcane/10 hover:shadow-[0_0_0_1px_rgba(200,170,110,0.35)]"
      )}
    >
      <div className="flex flex-col items-center mb-3">
        {battlefield.card ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <CardImage card={battlefield.card} size="md" />
          </motion.div>
        ) : (
          <div className="w-32 aspect-[4/3] bg-void-deep/40 rounded flex items-center justify-center">
            <span className="text-xs text-text-dim text-center px-2">
              {battlefield.name}
            </span>
          </div>
        )}

        {battlefield.control !== "none" && (
          <span
            className={cn(
              "text-[10px] mt-1 uppercase tracking-wider",
              battlefield.control === "contested"
                ? "text-shurima"
                : battlefield.control === myPosition
                ? "text-success/70"
                : "text-danger/70"
            )}
          >
            {battlefield.control === "contested"
              ? "contested"
              : battlefield.control === myPosition
              ? "controlled"
              : "enemy"}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-2">
        <div className="flex-1 flex flex-wrap gap-1 justify-center content-end">
          {opponentUnits.length === 0 ? (
            <span className="text-text-dim/30 text-[10px]">empty</span>
          ) : (
            opponentUnits.map((unit) => (
              <UnitCard
                key={unit.instanceId}
                unit={unit}
                isEnemy
                onClick={(targetId) => {
                  const { selectedCard: sel } = useGameStore.getState();
                  if (sel && (sel.type || "").toLowerCase() === "spell") {
                    handleSpellTarget(targetId);
                    return;
                  }
                  if (sel && myUnits.some((u) => u.instanceId === sel.instanceId)) {
                    handleAttack(sel.instanceId, targetId);
                  }
                }}
              />
            ))
          )}
        </div>

        <div className="h-px bg-mist/20 mx-4" />

        <div className="flex-1 flex flex-wrap gap-1 justify-center content-start">
          {myUnits.length === 0 ? (
            <span className="text-text-dim/30 text-[10px]">empty</span>
          ) : (
            myUnits.map((unit) => <UnitCard key={unit.instanceId} unit={unit} />)
          )}
        </div>
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

  const isInteractive =
    (isEnemy && !!onClick) || (!isEnemy && isMyTurn() && !unit.exhausted);

  function handleClick() {
    if (isEnemy && onClick) {
      onClick(unit.instanceId);
      return;
    }
    if (!isEnemy && isMyTurn() && !unit.exhausted) {
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
        "relative transition-transform",
        isInteractive ? "cursor-pointer" : "cursor-default",
        isSelected && "-translate-y-1 shadow-[0_0_0_2px_rgba(200,170,110,0.50)]"
      )}
    >
      <CardImage card={unit} size="xs" />

      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pb-0.5 text-[10px] font-bold">
        <span className="text-danger">{unit.attack}</span>
        <span className="text-success">{unit.currentHealth - unit.damage}</span>
      </div>
    </div>
  );
}
