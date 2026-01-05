import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Swords, Users, FileText, Sparkles } from "lucide-react";
import { Button, Input, Modal, TextArea } from "@theme/index";
import { useLobbyStore, useGameStore } from "@lib/store";
import { createGame, joinGame } from "@lib/api";
import { parseDeckList } from "@/types/deck";
import { cn } from "@lib/utils";

export function Landing() {
  const navigate = useNavigate();
  const { playerName, gameCode, setPlayerName, setGameCode, error, setError } = useLobbyStore();
  const { setMyPlayerId, setCurrentDeck } = useGameStore();
  
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [deckText, setDeckText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDeckModal, setShowDeckModal] = useState(false);

  async function handleCreateGame() {
    if (!playerName.trim()) {
      setError("please enter your name");
      return;
    }
    if (!deckText.trim()) {
      setError("please import a deck");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { legend, champion, battlefields, mainDeck, runeDeck, sideboard } = parseDeckList(deckText);
      const deck = {
        id: "",
        name: "imported deck",
        legend,
        champion,
        battlefields,
        sideboard,
        mainDeck,
        runeDeck,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { gameId, code, playerId } = await createGame(playerName, deck);
      setMyPlayerId(playerId); // using server player id so ws auth works fr
      setCurrentDeck(deck);
      navigate(`/game/${gameId}?code=${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create game");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGame() {
    if (!playerName.trim()) {
      setError("please enter your name");
      return;
    }
    if (!gameCode.trim()) {
      setError("please enter a game code");
      return;
    }
    if (!deckText.trim()) {
      setError("please import a deck");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { legend, champion, battlefields, mainDeck, runeDeck, sideboard } = parseDeckList(deckText);
      const deck = {
        id: "",
        name: "imported deck",
        legend,
        champion,
        battlefields,
        sideboard,
        mainDeck,
        runeDeck,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { gameId, playerId } = await joinGame(gameCode, playerName, deck);
      setMyPlayerId(playerId); // using server player id so ws auth works fr
      setCurrentDeck(deck);
      navigate(`/game/${gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to join game");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-void bg-hex-pattern flex flex-col">
      {/* header */}
      <header className="p-6">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl text-arcane text-center tracking-[0.3em]"
        >
          RIFTBOUND
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-text-dim text-center text-sm mt-1 tracking-wider"
        >
          TCG Simulator
        </motion.p>
      </header>

      {/* main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-md"
        >
          {mode === "menu" && (
            <div className="space-y-4">
              {/* player name input */}
              <Input
                label="Summoner Name"
                placeholder="Enter your name..."
                value={playerName}
                onChange={(e) => {
                  // clear stale errors as soon as the user starts typing again
                  if (error) setError(null);
                  setPlayerName(e.target.value);
                }}
              />

              {/* deck import button */}
              <button
                onClick={() => setShowDeckModal(true)}
                className={cn(
                  "w-full p-4 border-2 border-dashed transition-all",
                  deckText
                    ? "border-success/50 bg-success/5 text-success"
                    : "border-mist/50 hover:border-arcane/50 text-text-dim hover:text-text"
                )}
              >
                <FileText className="w-5 h-5 mx-auto mb-2" />
                <span className="text-sm font-display uppercase tracking-wider">
                  {deckText ? "deck imported ✓" : "import deck"}
                </span>
              </button>

              {/* action buttons */}
              <div className="grid grid-cols-2 gap-4 mt-8">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    // avoid showing old errors on the next screen
                    if (error) setError(null);
                    setMode("create");
                  }}
                  className="flex items-center justify-center gap-2"
                >
                  <Sparkles size={18} />
                  Create
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    // avoid showing old errors on the next screen
                    if (error) setError(null);
                    setMode("join");
                  }}
                  className="flex items-center justify-center gap-2"
                >
                  <Users size={18} />
                  Join
                </Button>
              </div>

              {/* deck builder link */}
              <button
                onClick={() => navigate("/deck")}
                className="w-full mt-4 py-3 text-text-dim hover:text-arcane transition-colors text-sm font-display uppercase tracking-wider"
              >
                → Deck Builder
              </button>
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-6">
              <div className="text-center">
                <Swords className="w-12 h-12 mx-auto text-arcane mb-4" />
                <h2 className="font-display text-xl uppercase tracking-wider text-arcane">
                  Create Game
                </h2>
                <p className="text-text-dim text-sm mt-2">
                  share the code with your opponent
                </p>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={handleCreateGame}
                loading={loading}
                className="w-full"
              >
                Create Game
              </Button>

              <button
                onClick={() => setMode("menu")}
                className="w-full py-2 text-text-dim hover:text-text transition-colors text-sm"
              >
                ← Back
              </button>

              {error && (
                <p className="text-danger text-sm text-center">{error}</p>
              )}
            </div>
          )}

          {mode === "join" && (
            <div className="space-y-6">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto text-hextech mb-4" />
                <h2 className="font-display text-xl uppercase tracking-wider text-arcane">
                  Join Game
                </h2>
              </div>

              <Input
                label="Game Code"
                placeholder="XXXXXX"
                value={gameCode}
                onChange={(e) => {
                  // clear stale errors as soon as the user starts typing again
                  if (error) setError(null);
                  setGameCode(e.target.value);
                }}
                maxLength={6}
                className="text-center text-2xl font-display tracking-[0.5em] uppercase"
              />

              <Button
                variant="primary"
                size="lg"
                onClick={handleJoinGame}
                loading={loading}
                className="w-full"
              >
                Join Game
              </Button>

              <button
                onClick={() => setMode("menu")}
                className="w-full py-2 text-text-dim hover:text-text transition-colors text-sm"
              >
                ← Back
              </button>

              {error && (
                <p className="text-danger text-sm text-center">{error}</p>
              )}
            </div>
          )}
        </motion.div>
      </main>

      {/* deck import modal */}
      <Modal
        open={showDeckModal}
        onClose={() => setShowDeckModal(false)}
        title="Import Deck"
      >
        <div className="space-y-4">
          <p className="text-text-dim text-sm">
            paste your deck list in any common format:
          </p>
          <code className="block text-xs text-text-dim bg-shadow/50 p-3 rounded">
            3x Card Name<br />
            2x Another Card<br />
            <br />
            # Rune Deck<br />
            3x Rune Card
          </code>
          <TextArea
            value={deckText}
            onChange={(e) => setDeckText(e.target.value)}
            placeholder="paste your deck list here..."
            className="min-h-[200px]"
          />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowDeckModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowDeckModal(false)}
              className="flex-1"
            >
              Import
            </Button>
          </div>
        </div>
      </Modal>

      {/* footer */}
      <footer className="p-4 text-center text-text-dim text-xs">
        <p>Riftbound © Riot Games. This is a fan project.</p>
      </footer>
    </div>
  );
}

