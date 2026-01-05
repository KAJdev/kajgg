# Riftbound Frontend

the web frontend for the riftbound tcg simulator.

## features

- arcane-inspired ui with league of legends aesthetics
- real-time game board with drag-and-drop
- deck builder with card search
- game lobby with code-based matchmaking

## setup

```bash
# install dependencies
npm install

# run dev server
npm run dev
```

## structure

```
src/
├── components/     # reusable ui components
│   ├── CardImage.tsx
│   ├── GameBoard.tsx
│   ├── PlayerHand.tsx
│   ├── GameControls.tsx
│   └── GameLog.tsx
├── pages/          # route pages
│   ├── Landing.tsx
│   ├── Game.tsx
│   └── DeckBuilder.tsx
├── lib/            # utilities and state
│   ├── store.ts    # zustand state management
│   ├── api.ts      # api client
│   ├── websocket.ts # websocket connection
│   └── utils.ts    # helper functions
├── theme/          # design system components
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Modal.tsx
└── types/          # typescript definitions
    ├── card.ts
    ├── game.ts
    └── deck.ts
```

## design

uses an arcane/hextech-inspired color palette:

- void (dark background)
- arcane (gold accents)
- hextech (cyan highlights)
- region colors (noxus red, demacia blue, etc)

fonts:

- cinzel (display/headers)
- rajdhani (body text)
