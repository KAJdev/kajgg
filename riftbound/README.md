# Riftbound TCG Simulator

a full-stack web application for playing the riftbound trading card game (by riot games).

## overview

this simulator allows you to:
- create and join games using room codes
- import decks via text format
- play full games with all riftbound rules
- see real-time game state updates via websockets

## structure

```
riftbound/
├── frontend/       # react + tailwind frontend
├── backend/        # python + sanic backend
└── cards.py        # card data fetching utility
```

## quick start

### backend

```bash
cd backend
uv sync
uv run python main.py
```

server runs on `http://localhost:8001`

### frontend

```bash
cd frontend
npm install
npm run dev
```

frontend runs on `http://localhost:5174`

## game rules

riftbound follows these core rules:

### deck building
- main deck: exactly 40 cards
- rune deck: exactly 12 cards
- max 3 copies of any card
- max 1 copy of champions

### turn structure
1. **ready phase** - unexhaust all units
2. **score phase** - check victory conditions
3. **draw phase** - draw 1 card
4. **rune phase** - play a rune (gain mana)
5. **main phase** - play cards, attack, move
6. **end phase** - cleanup, pass turn

### winning
first player to reach 20 points wins!

## tech stack

**frontend:**
- react 19
- tailwind css 4
- zustand (state)
- vite

**backend:**
- python 3.11+
- sanic (async web framework)
- websockets

## credits

- card data from riot games' riftbound manifests
- card images via piltover archive cdn
- riftbound © riot games

this is a fan project for educational purposes.

