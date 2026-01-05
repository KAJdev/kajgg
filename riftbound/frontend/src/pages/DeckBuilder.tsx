import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Search, Plus, Minus, ArrowLeft, Save, Upload, Download } from "lucide-react";
import { Button, Input, TextArea, Modal } from "@theme/index";
import { useGameStore } from "@lib/store";
import { fetchCards } from "@lib/api";
import { cn } from "@lib/utils";
import type { Card, Deck, DeckEntry } from "@/types";
import { MAIN_DECK_SIZE, RUNE_DECK_SIZE, validateDeck, exportDeckList, parseDeckList } from "@/types/deck";
import { CardImage } from "@components/CardImage";

export function DeckBuilder() {
  const navigate = useNavigate();
  const { cards, setCards, cardsLoaded } = useGameStore();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [mainDeck, setMainDeck] = useState<DeckEntry[]>([]);
  const [runeDeck, setRuneDeck] = useState<DeckEntry[]>([]);
  const [deckName, setDeckName] = useState("New Deck");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [activeTab, setActiveTab] = useState<"main" | "rune">("main");

  // load cards on mount
  useEffect(() => {
    if (!cardsLoaded) {
      fetchCards().then(setCards).catch(console.error);
    }
  }, [cardsLoaded, setCards]);

  // filter cards based on search
  const filteredCards = Array.from(cards.values()).filter((card) => {
    const query = searchQuery.toLowerCase();
    return (
      card.title.toLowerCase().includes(query) ||
      card.tags.some((tag) => tag.toLowerCase().includes(query)) ||
      card.type?.toLowerCase().includes(query)
    );
  });

  // calculate deck counts
  const mainDeckCount = mainDeck.reduce((sum, e) => sum + e.count, 0);
  const runeDeckCount = runeDeck.reduce((sum, e) => sum + e.count, 0);

  // validation
  const currentDeck: Deck = {
    id: "",
    name: deckName,
    mainDeck: mainDeck.map((e) => ({ ...e, card: cards.get(e.cardId) })),
    runeDeck: runeDeck.map((e) => ({ ...e, card: cards.get(e.cardId) })),
    createdAt: "",
    updatedAt: "",
  };
  const validation = validateDeck(currentDeck);

  function addCard(card: Card, toRune = false) {
    const deck = toRune ? runeDeck : mainDeck;
    const setDeck = toRune ? setRuneDeck : setMainDeck;
    const maxSize = toRune ? RUNE_DECK_SIZE : MAIN_DECK_SIZE;
    const currentCount = deck.reduce((sum, e) => sum + e.count, 0);

    if (currentCount >= maxSize) return;

    const existing = deck.find((e) => e.cardId === card.id);
    if (existing) {
      const maxCopies = card.superType === "champion" ? 1 : 3;
      if (existing.count >= maxCopies) return;
      setDeck(deck.map((e) =>
        e.cardId === card.id ? { ...e, count: e.count + 1 } : e
      ));
    } else {
      setDeck([...deck, { cardId: card.id, count: 1, card }]);
    }
  }

  function removeCard(cardId: string, fromRune = false) {
    const deck = fromRune ? runeDeck : mainDeck;
    const setDeck = fromRune ? setRuneDeck : setMainDeck;

    const existing = deck.find((e) => e.cardId === cardId);
    if (!existing) return;

    if (existing.count > 1) {
      setDeck(deck.map((e) =>
        e.cardId === cardId ? { ...e, count: e.count - 1 } : e
      ));
    } else {
      setDeck(deck.filter((e) => e.cardId !== cardId));
    }
  }

  function handleImport() {
    const parsed = parseDeckList(importText);
    const importedMain = parsed.mainDeck;
    const importedRune = parsed.runeDeck;
    
    // try to match card names to actual cards
    const matchedMain = importedMain.map((entry) => {
      const card = Array.from(cards.values()).find(
        (c) => c.title.toLowerCase() === entry.cardId.toLowerCase()
      );
      return { ...entry, cardId: card?.id || entry.cardId, card };
    });
    
    const matchedRune = importedRune.map((entry) => {
      const card = Array.from(cards.values()).find(
        (c) => c.title.toLowerCase() === entry.cardId.toLowerCase()
      );
      return { ...entry, cardId: card?.id || entry.cardId, card };
    });

    setMainDeck(matchedMain);
    setRuneDeck(matchedRune);
    setShowImportModal(false);
    setImportText("");
  }

  function handleExport() {
    const text = exportDeckList(currentDeck);
    navigator.clipboard.writeText(text);
    // could show a toast here
  }

  return (
    <div className="min-h-screen bg-void bg-hex-pattern flex flex-col">
      {/* header */}
      <header className="p-4 border-b border-arcane/20 flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <input
          type="text"
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          className="bg-transparent font-display text-xl text-arcane border-none focus:outline-none"
        />
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setShowImportModal(true)}>
          <Upload size={16} className="mr-2" />
          Import
        </Button>
        <Button variant="ghost" size="sm" onClick={handleExport}>
          <Download size={16} className="mr-2" />
          Export
        </Button>
        <Button variant="primary" size="sm" disabled={!validation.valid}>
          <Save size={16} className="mr-2" />
          Save
        </Button>
      </header>

      <div className="flex-1 flex">
        {/* card browser */}
        <div className="w-2/3 p-4 border-r border-arcane/20 flex flex-col">
          {/* search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={18} />
            <Input
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* card grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 gap-3">
              {filteredCards.map((card) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group cursor-pointer"
                  onClick={() => addCard(card, activeTab === "rune")}
                >
                  <CardImage card={card} size="sm" />
                  <div className="absolute inset-0 bg-void/0 group-hover:bg-void/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Plus className="text-arcane" size={32} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* deck list */}
        <div className="w-1/3 p-4 flex flex-col">
          {/* tabs */}
          <div className="flex border-b border-arcane/20 mb-4">
            <button
              onClick={() => setActiveTab("main")}
              className={cn(
                "flex-1 py-2 font-display text-sm uppercase tracking-wider transition-colors",
                activeTab === "main"
                  ? "text-arcane border-b-2 border-arcane"
                  : "text-text-dim hover:text-text"
              )}
            >
              Main ({mainDeckCount}/{MAIN_DECK_SIZE})
            </button>
            <button
              onClick={() => setActiveTab("rune")}
              className={cn(
                "flex-1 py-2 font-display text-sm uppercase tracking-wider transition-colors",
                activeTab === "rune"
                  ? "text-arcane border-b-2 border-arcane"
                  : "text-text-dim hover:text-text"
              )}
            >
              Rune ({runeDeckCount}/{RUNE_DECK_SIZE})
            </button>
          </div>

          {/* deck entries */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {(activeTab === "main" ? mainDeck : runeDeck).map((entry) => (
              <div
                key={entry.cardId}
                className="flex items-center gap-3 p-2 bg-shadow/30 border border-arcane/10 hover:border-arcane/30 transition-colors"
              >
                <span className="text-arcane font-display w-6 text-center">
                  {entry.count}x
                </span>
                <span className="flex-1 text-text truncate">
                  {entry.card?.title || entry.cardId}
                </span>
                <button
                  onClick={() => removeCard(entry.cardId, activeTab === "rune")}
                  className="text-text-dim hover:text-danger transition-colors"
                >
                  <Minus size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* validation */}
          {!validation.valid && (
            <div className="mt-4 p-3 bg-danger/10 border border-danger/30">
              <p className="text-danger text-sm font-display uppercase tracking-wider mb-2">
                Validation Errors
              </p>
              {validation.errors.map((error, i) => (
                <p key={i} className="text-danger/80 text-xs">
                  • {error}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* import modal */}
      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Deck"
      >
        <div className="space-y-4">
          <TextArea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="paste your deck list here..."
            className="min-h-[200px]"
          />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowImportModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleImport} className="flex-1">
              Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

