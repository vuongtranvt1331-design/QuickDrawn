# Quick Drawn — Synonym Shootout

A mobile-first Western vocabulary game for Lexical Space and Arcade Hub. Vanilla HTML, CSS and JavaScript; no build step required.

Play: https://vuongtranvt1331-design.github.io/QuickDrawn/

## Run locally

On Windows, double-click `run-local.bat` (Python 3 required). It checks for a working `python` interpreter before trying `py -3` and opens `http://localhost:8000/`. Keep the server window open; Ctrl+C stops it.

If port 8000 is occupied, close the old server and launch again. Alternatively: `run-local.bat --port 8001`.

The equivalent direct command is `python run-local.py`. To serve a shared parent folder containing Arcade Hub and this game, use `python run-local.py --root "C:\your-shared-folder" --port 8000`.

IndexedDB is shared only when Arcade Hub and this game use the same browser profile, protocol, hostname and port. Changing the port or switching between `localhost` and `127.0.0.1` changes the data origin. The launcher does not delete or migrate browser data and does not require process-management permissions.

## Structure

- `index.html`: page structure and deferred script loading.
- `css/style.css`: Western UI, responsive layouts, fuse timer and crisp pixel rendering.
- `js/config.js`: Lexical Space settings and localStorage keys.
- `js/audio.js`: Web Audio effects and pronunciation/cache providers.
- `js/firebase-service.js`: existing filename; the data service uses the shared `LexicalSpaceDB` IndexedDB database, not remote Firestore reads.
- `js/sprite-animator.js`: independent character animators and duel-state coordination.
- `js/game.js`: questions, scoring, countdown and DOM events; creates and loads each character's animator.
- `assets/images/`: independent Player/Enemy sprite sheets, desert background and grid metadata.
- `assets/audio/`: local Wilhelm scream and source attribution.

## Sprite layout

Each character has a separate PNG: `player_spritesheet.png` or `enemy_spritesheet.png`. Both are 5120×384 pixels, arranged as 40 columns × 3 rows of fixed 128×128 cells. Each active frame has at least 16 pixels of transparent padding.

| Row | Animation | Active frames | Duration | End behavior |
| --- | --- | --- | --- | --- |
| 0 | Idle | 40 | 2.8 seconds | Loop |
| 1 | Shoot | 8 | 0.5 seconds | Hold final frame |
| 2 | Hit | 8 | 0.5 seconds | Hold final frame |

Unused cells in rows 1 and 2 are transparent. Source rectangles use integer coordinates; canvas smoothing is disabled. Both source sheets face right, and CSS mirrors the Enemy box to face left. `playerAnimator` exclusively draws its image to `playerCanvas`; `enemyAnimator` exclusively draws its image to `enemyCanvas`.

## Game behavior

Student words come from the shared browser `LexicalSpaceDB` / `words` store, filtered by username and `memoryStatus === "mastered"`. Guest play or fewer than four eligible words uses the existing Starter Deck fallback.

The score starts at 10. Correct answers add 1; wrong answers and timeouts deduct 3. Three missed tries end the run. The 25-point celebration continues into further rounds. Question time is `Math.max(1, 10 - (questionNumber - 1) * 0.5)`.

Arcade Hub parameters are preserved: `user`, `mode`, `topic`, `returnUrl`. Best scores remain in localStorage. Google Fonts and pronunciation providers still require Internet access; gunshot effects use Web Audio and the scream is a local MP3.

## GitHub Pages

Publish this repository's root. Keep `index.html`, `css/`, `js/` and `assets/` together. Internal asset paths are relative and work under the repository's Pages subpath. Versioned asset URLs and no-cache headers in the local server prevent mixed older/newer sprite resources.
