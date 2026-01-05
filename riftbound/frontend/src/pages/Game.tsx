import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Copy, LogOut, Loader2 } from "lucide-react";
import { useGameStore } from "@lib/store";
import { connectToGame, disconnectFromGame } from "@lib/websocket";
import { Button } from "@theme/index";
import { cn, formatPhase } from "@lib/utils";
import { GameBoard } from "@components/GameBoard";
import { PlayerHand } from "@components/PlayerHand";
import { GameControls } from "@components/GameControls";
import { GameLog } from "@components/GameLog";
import { ChainDisplay } from "@components/ChainDisplay";
import { RunesDisplay } from "@components/RunesDisplay";
import { CardImage } from "@components/CardImage";

export function Game() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");

  const {
    connecting,
    gameState,
    myPlayerId,
    setMyPlayerId,
    getMyPlayer,
    getOpponentPlayer,
    isMyTurn,
  } = useGameStore();

  const myPlayer = getMyPlayer();
  const opponent = getOpponentPlayer();
  const setup = gameState?.setup;
  const inBattlefieldPick = setup?.step === "battlefields";
  const inMulligan = setup?.step === "mulligan";
  const myPosition = myPlayer?.position;
  const isMyMulligan =
    inMulligan && !!myPosition && setup?.mulliganPlayer === myPosition;
  const myBattlefieldOptions =
    (myPosition && setup?.battlefieldOptions?.[myPosition]) || [];
  const myBattlefieldSelected =
    (myPosition && setup?.battlefieldSelected?.[myPosition]) || null;

  const [mulliganIds, setMulliganIds] = useState<string[]>([]);
  const [mulliganSubmitting, setMulliganSubmitting] = useState(false);
  const [bfSubmitting, setBfSubmitting] = useState(false);

  useEffect(() => {
    const qsPlayerId = searchParams.get("playerId");
    if (!myPlayerId && qsPlayerId) {
      setMyPlayerId(qsPlayerId);
    }
    if (gameId && myPlayerId) {
      console.log("[Game] connecting to game:", gameId, "as:", myPlayerId);
      connectToGame(gameId, myPlayerId);
    }
    return () => disconnectFromGame();
  }, [gameId, myPlayerId, searchParams, setMyPlayerId]);

  useEffect(() => {
    setMulliganIds([]);
    setMulliganSubmitting(false);
    setBfSubmitting(false);
  }, [setup?.step, setup?.mulliganPlayer, myPlayerId]);

  const mulliganMax = 2;
  const myHand = myPlayer?.hand || [];
  const canSelectMulligan = isMyMulligan && !mulliganSubmitting;
  const mulliganSelectedSet = useMemo(() => new Set(mulliganIds), [mulliganIds]);

  function toggleMulliganSelect(id: string) {
    if (!canSelectMulligan) return;
    setMulliganIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= mulliganMax) return prev;
      return [...prev, id];
    });
  }

  function submitMulligan() {
    if (!isMyMulligan) return;
    setMulliganSubmitting(true);
    useGameStore
      .getState()
      .sendCommand({ type: "mulligan", cardInstanceIds: mulliganIds });
  }

  function chooseBattlefield(cardId: string) {
    if (!myPosition) return;
    if (!inBattlefieldPick) return;
    if (bfSubmitting) return;
    setBfSubmitting(true);
    useGameStore.getState().sendCommand({ type: "choose_battlefield", cardId });
  }

  if (connecting) {
    return (
      <div className="min-h-screen bg-void bg-hex-pattern flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-12 h-12 text-arcane animate-spin mx-auto mb-4" />
          <p className="text-text-dim font-display uppercase tracking-wider">
            Connecting...
          </p>
        </motion.div>
      </div>
    );
  }

  if (gameState?.status === "waiting") {
    return (
      <div className="min-h-screen bg-void bg-hex-pattern flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <h2 className="font-display text-2xl text-arcane uppercase tracking-wider mb-2">
            Waiting for Opponent
          </h2>
          <p className="text-text-dim mb-8">share this code with your opponent</p>

          {code && (
            <div className="mb-8">
              <div className="flex items-center justify-center gap-4 p-6 bg-shadow/50 border-2 border-arcane/30">
                <span className="font-display text-4xl text-arcane tracking-[0.5em]">
                  {code}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(code)}
                  className="text-text-dim hover:text-arcane transition-colors"
                >
                  <Copy size={24} />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-text-dim">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">waiting for player 2...</span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (gameState?.status === "finished") {
    const isWinner = gameState.winner === myPosition;

    return (
      <div className="min-h-screen bg-void bg-hex-pattern flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="text-center"
        >
          <h1
            className={cn(
              "font-display text-6xl uppercase tracking-wider mb-4",
              isWinner ? "text-success" : "text-danger"
            )}
          >
            {isWinner ? "Victory" : "Defeat"}
          </h1>
          <p className="text-text-dim mb-8">
            {isWinner ? "you have proven your worth" : "return stronger next time"}
          </p>
          <Button variant="primary" onClick={() => (window.location.href = "/")}>
            Return to Menu
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-void overflow-hidden flex flex-col">
      <div className="h-12 px-4 flex items-center justify-between bg-void-deep/30">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              opponent?.connected ? "bg-success" : "bg-danger"
            )}
          />
          <span className="text-sm text-text-dim truncate">
            {opponent?.name || "Opponent"}
          </span>
          <span className="text-arcane font-display tabular-nums">
            {opponent?.score || 0}
          </span>
          <span className="hidden sm:inline text-xs text-text-dim/60 whitespace-nowrap">
            H {opponent?.handSize || 0} • D {opponent?.mainDeckSize || 0}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-text-dim whitespace-nowrap">
            Turn {gameState?.turnNumber || 1} •{" "}
            {gameState?.phase ? formatPhase(gameState.phase) : ""}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.location.href = "/")}
            className="px-2"
          >
            <LogOut size={18} />
          </Button>
        </div>
      </div>

      <div className="flex-1 relative">
        <GameBoard />

        <AnimatePresence>
          {isMyTurn() && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-arcane/90 text-void text-xs font-display uppercase tracking-wider shadow-[0_0_18px_rgba(200,170,110,0.25)]"
            >
              Your Turn
            </motion.div>
          )}
        </AnimatePresence>

        <ChainDisplay />
        <GameLog />

        <AnimatePresence>
          {inBattlefieldPick && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-void/90 backdrop-blur-md flex items-center justify-center p-6 z-50"
            >
              <motion.div
                initial={{ scale: 0.98, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-3xl bg-void-deep/95 border border-mist/20 rounded-lg p-6 shadow-[0_0_60px_rgba(0,0,0,0.8)]"
              >
                <h2 className="font-display text-xl uppercase tracking-wider text-arcane mb-2">
                  choose your battlefield
                </h2>
                <p className="text-text-dim text-sm mb-4">
                  pick 1 of your 3 battlefields before turn order is assigned.
                </p>

                {!myPosition ? (
                  <div className="flex items-center gap-2 text-text-dim">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">connecting...</span>
                  </div>
                ) : myBattlefieldSelected ? (
                  <div className="flex items-center gap-2 text-text-dim">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">waiting for opponent...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {myBattlefieldOptions.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => chooseBattlefield(c.id)}
                        disabled={bfSubmitting}
                        className="rounded-md overflow-hidden border border-mist/30 hover:border-arcane/50 transition-colors"
                        title={c.title}
                      >
                        <CardImage card={c} size="md" className="w-full" />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {inMulligan && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-void/90 backdrop-blur-md flex items-center justify-center p-6 z-50"
            >
              <motion.div
                initial={{ scale: 0.98, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-2xl bg-void-deep/95 border border-mist/20 rounded-lg p-6"
              >
                <h2 className="font-display text-xl uppercase tracking-wider text-arcane mb-2">
                  Mulligan
                </h2>
                <p className="text-text-dim text-sm mb-4">
                  choose up to {mulliganMax} cards to recycle, then draw that many.
                </p>

                {!isMyMulligan ? (
                  <div className="flex items-center gap-2 text-text-dim">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">waiting for {setup?.mulliganPlayer}...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-text-dim uppercase">
                        selected: {mulliganIds.length} / {mulliganMax}
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={submitMulligan}
                        disabled={mulliganSubmitting}
                      >
                        {mulliganSubmitting ? "sending..." : "confirm mulligan"}
                      </Button>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {myHand.map((c) => {
                        const selected = mulliganSelectedSet.has(c.instanceId);
                        return (
                          <button
                            key={c.instanceId}
                            onClick={() => toggleMulliganSelect(c.instanceId)}
                            className={cn(
                              "relative rounded-md overflow-hidden border transition-colors",
                              selected
                                ? "border-arcane"
                                : "border-mist/30 hover:border-arcane/50"
                            )}
                            title={c.title}
                          >
                            <div className={cn(selected && "opacity-80")}>
                              <CardImage card={c} size="sm" className="w-24" />
                            </div>
                            {selected && (
                              <div className="absolute inset-0 ring-2 ring-arcane pointer-events-none" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-void-deep/60">
        <div className="h-14 px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <RunesDisplay runes={myPlayer?.runesInPlay || []} />
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] uppercase tracking-wider text-text-dim/60">
                Energy
              </span>
              <span className="text-shurima font-display text-lg tabular-nums">
                {myPlayer?.energy || 0}
              </span>
            </div>
          </div>

          {!inMulligan && !inBattlefieldPick && <GameControls />}
        </div>

        <div className="h-36 px-4">
          <PlayerHand cards={myPlayer?.hand || []} />
        </div>
      </div>
    </div>
  );
}
