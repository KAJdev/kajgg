import { Button } from "@theme/index";
import { useGameStore } from "@lib/store";

type ChainItem = {
  cardTitle: string;
};

type ChainGameState = {
  waitingForResponse?: boolean;
  chainItems?: ChainItem[];
  priorityPlayer?: string | null;
};

export function ChainDisplay() {
  const { gameState, sendCommand, myPlayerId } = useGameStore();
  const chainState = gameState as unknown as ChainGameState | null;

  const chainItems = chainState?.chainItems ?? [];
  const waitingForResponse = !!chainState?.waitingForResponse;

  if (!waitingForResponse || chainItems.length === 0) {
    return null;
  }

  const hasPriority = chainState?.priorityPlayer === myPlayerId;

  return (
    <div className="absolute inset-x-0 top-16 flex justify-center pointer-events-none z-40">
      <div className="bg-void-deep/85 backdrop-blur-sm rounded-lg px-4 py-3 shadow-[0_0_34px_rgba(0,0,0,0.55)] pointer-events-auto">
        <div className="text-[10px] uppercase tracking-wider text-text-dim mb-2">
          Chain
        </div>

        <div className="flex flex-wrap gap-2">
          {chainItems.map((item, idx) => (
            <div
              key={idx}
              className="text-xs text-text bg-shadow/30 rounded px-2 py-1"
            >
              {item.cardTitle}
            </div>
          ))}
        </div>

        {hasPriority && (
          <div className="mt-3 flex items-center gap-3">
            <Button
              size="sm"
              variant="primary"
              onClick={() => sendCommand({ type: "pass_priority" })}
            >
              Pass
            </Button>
            <span className="text-xs text-text-dim">or play a Reaction</span>
          </div>
        )}
      </div>
    </div>
  );
}
