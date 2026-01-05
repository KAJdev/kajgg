import { useGameStore } from "./store";
import type { GameEvent } from "@/types";

// use relative urls to go through vite proxy
const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
  window.location.host
}`;

let socket: WebSocket | null = null;
let reconnectTimeout: number | null = null;

export function connectToGame(gameId: string, playerId: string) {
  const store = useGameStore.getState();

  // cleanup existing connection
  if (socket) {
    disconnectFromGame();
  }

  store.setConnecting(true);
  store.setConnected(false);

  const url = `${WS_URL}/ws/game/${gameId}?playerId=${encodeURIComponent(
    playerId
  )}`;
  console.log("[ws] connecting to:", url);

  socket = new WebSocket(url);
  store.setSocket(socket);

  socket.onopen = () => {
    console.log("[ws] connected");
    store.setConnecting(false);
    store.setConnected(true);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as GameEvent;
      console.log("[ws] received:", data.type, data);
      store.handleEvent(data);
    } catch (e) {
      console.error("[ws] failed to parse message:", e);
    }
  };

  socket.onclose = (event) => {
    console.log("[ws] disconnected:", event.code, event.reason);
    store.setConnecting(false);
    store.setConnected(false);

    // attempt reconnect after delay (unless it was a clean close)
    if (event.code !== 1000 && event.code !== 1001) {
      reconnectTimeout = window.setTimeout(() => {
        console.log("[ws] attempting reconnect...");
        connectToGame(gameId, playerId);
      }, 3000);
    }
  };

  socket.onerror = (error) => {
    console.error("[ws] error:", error);
  };
}

export function disconnectFromGame() {
  const store = useGameStore.getState();

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (socket) {
    socket.close(1000, "user disconnected");
    socket = null;
  }

  store.setSocket(null);
  store.setConnected(false);
  store.setConnecting(false);
}

export function sendCommand(command: unknown) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(command));
  } else {
    console.warn("[ws] cannot send command, socket not connected");
  }
}
