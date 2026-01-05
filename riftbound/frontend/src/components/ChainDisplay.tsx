import { useGameStore } from "@lib/store";
import { cn } from "@lib/utils";
import { Button } from "@theme/index";

export function ChainDisplay() {
  const { gameState, myPlayerId, sendCommand } = useGameStore();

  if (!gameState) return null;

  const chain = gameState.chainItems || [];
  const visible = gameState.waitingForResponse || chain.length > 0;
  if (!visible) return null;

  const hasPriority =
    !!gameState.priorityPlayer &&
    !!myPlayerId &&
    gameState.priorityPlayer === myPlayerId;

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-2 rounded-lg border",
        "border-arcane/25 bg-shadow/30"
      )}
    >
      <div className="text-xs text-text-dim uppercase tracking-wider">chain</div>

      <div className="flex items-center gap-2 flex-wrap">
        {chain.length === 0 ? (
          <span className="text-xs text-text-dim/40">empty</span>
        ) : (
          chain.map((item, idx) => (
            <span
              key={`${item.controllerId}-${idx}`}
              className={cn(
                "text-xs font-display px-2 py-1 rounded-md border",
                "border-mist/20 bg-void-deep/40"
              )}
            >
              {item.cardTitle}
            </span>
          ))
        )}
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <div className="text-xs text-text-dim">
          priority: {hasPriority ? "you" : "opponent"}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => sendCommand({ type: "pass_priority" })}
          disabled={!gameState.waitingForResponse || !hasPriority}
        >
          Pass
        </Button>
      </div>
    </div>
  );
}
