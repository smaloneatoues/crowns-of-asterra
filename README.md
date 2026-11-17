# Crowns of Asterra

An original turn-based strategy game in the tradition of 16-bit console kingdom sims: six rival houses, 24 provinces, seasonal turns, diplomacy, tactical battles, and a sleeping celestial beast bound to the crown.

All names, map, text, rules and visuals are original.

## Run it

No build step and no dependencies.

- **Simplest:** open `index.html` in a modern browser.
- **Or serve it:** from this folder run `python3 -m http.server 8765` and open <http://localhost:8765>.

Saves are kept in the browser's local storage (an autosave at the start of every season, plus three manual slots).

## Play it

1. **New Campaign** – pick a house, a difficulty (Squire / Knight / Warlord) and optionally a seed.
2. A six-step tutorial explains the basics; the **Advisor** line above the side panel always suggests a next step, and the **Guide** tab has the full rules.
3. Each season: give each of your provinces its command, march armies, then **End Season**.

Things worth knowing:

- **One command per province:** every province you hold carries out one command each season (recruit, build, calm, appoint, muster, search). Court business — envoys, rewards, naming an heir, the grain market, the rite, omens — is carried from a province and uses its command. Marching (once per army) and troop transfers are free. A gold dot marks provinces still awaiting a command; **Next ▶** (or the N key) steps through them.
- **Every greyed-out button states why** it is unavailable; clicking an unreachable province while marching explains why.
- **Armies:** *Muster army* in a province, click the army's pennant on the map, then a destination. Before any attack you see both forces and an estimate, then choose to **command in person** or **delegate**.
- **Battles:** 10×5 grid, up to 12 rounds. You activate `2 + leadership÷30` units per round. Hover an enemy to preview damage and the modifiers behind it (charge, flank, terrain, walls, holding).
- **Diplomacy:** every proposal shows its percentage and a "why?" breakdown.
- **The Starwyrm:** find three of five seals (ancient sites marked with a gold star, a rival's seat, or bargaining) and pay for the rite. It has a few charges a year, is halved against any house holding a seal, and frightens every other court each time it is used.

### Winning and losing

- **Unification:** hold Aurelion and 18 of 24 provinces (or outlast every rival).
- **Recognized succession:** hold Aurelion for 8 seasons running with 10 provinces, a named heir, and a pact or alliance with every surviving house.
- **Defeat:** lose your last province; lose your ruler with no named heir and no officer of loyalty 50+; or a rival completes either path first.

## Project layout

Plain HTML, CSS and JavaScript (classic scripts, so it also runs from `file://`). The rules engine has no DOM access and runs headless in Node.

| File | Purpose |
| --- | --- |
| `js/data.js` | Data definitions: units, terrain, resources, houses, provinces, roads, officers, difficulty |
| `js/core.js` | Seeded RNG (stored in the save), state helpers, new game, save/load |
| `js/actions.js` | Economy and every command (one per province per season), each with a `check` (reason unavailable) and a `run` |
| `js/diplomacy.js` | Proposals, visible odds, treaties, betrayal, envoys to the player |
| `js/battle.js` | Tactical engine and battle AI (used for commanded, delegated and AI-vs-AI battles) |
| `js/war.js` | Marching, battle aftermath, conquest, elimination, succession |
| `js/events.js` | Seasonal events with choices |
| `js/ai.js` | Rival houses (same commands and rules as the player) |
| `js/turn.js` | Season flow, upkeep, loyalty/unrest/revolt, victory checks |
| `js/art.js` | Artwork drawn in code: house heraldry, officer portraits, ink icons, the territory chart |
| `js/ui.js`, `js/ui-battle.js`, `css/style.css` | Interface (oak, vellum and ink styling) |

## Tests

```bash
node test/sim.js 8 240
```

Plays full campaigns with every house under AI control (and again with one house flagged as the player), checking state invariants after every season.

```bash
node test/battles.js
```

Prints win rates for reference match-ups (cavalry vs archers, walls with and without siege crews, the Starwyrm with and without a seal-ward).
