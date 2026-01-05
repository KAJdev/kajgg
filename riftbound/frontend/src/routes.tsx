import { createBrowserRouter } from "react-router";
import { Landing } from "@pages/Landing";
import { Game } from "@pages/Game";
import { DeckBuilder } from "@pages/DeckBuilder";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
    index: true,
  },
  {
    path: "/game/:gameId",
    Component: Game,
  },
  {
    path: "/deck",
    Component: DeckBuilder,
  },
]);

