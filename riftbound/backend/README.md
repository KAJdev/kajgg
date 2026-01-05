# Riftbound Backend

the backend server for the riftbound tcg simulator.

## features

- card data fetching from riot's manifests
- game session management
- real-time websocket communication
- riftbound rules engine

## setup

```bash
# install dependencies
uv sync

# run the server
uv run python main.py
```

## api endpoints

### cards
- `GET /api/cards` - get all cards
- `GET /api/cards/:id` - get a specific card
- `GET /api/cards/search?q=query` - search cards

### games
- `POST /api/games` - create a new game
- `POST /api/games/join` - join an existing game
- `GET /api/games/:id` - get game state

### decks
- `POST /api/decks/validate` - validate a deck list

### websocket
- `WS /ws/game/:gameId?playerId=xxx` - game websocket connection

## game engine

the game engine implements riftbound rules:

### turn phases
1. **ready** - unexhaust all your units
2. **score** - check for victory conditions
3. **draw** - draw a card from your deck
4. **rune** - optionally play a rune to gain mana
5. **main** - play cards, move units, attack
6. **end** - cleanup and pass turn

### commands
- `play_card` - play a card from hand
- `move_unit` - move a unit between lanes
- `attack` - attack with a unit
- `play_rune` - play a rune from rune deck
- `end_phase` - advance to next phase
- `end_turn` - end your turn
- `concede` - forfeit the game

