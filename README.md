# Real or Rendered?

**Real Florida, or video game?** A daily browser game: read a Florida headline and decide whether it made the actual news (**Real**) or was made up for the game (**Rendered**). Every real headline links to its news source.

Fan-made. Not affiliated with or endorsed by Rockstar Games or Take-Two Interactive.

## Play

- **Daily:** 8 headlines, the same for everyone that day, new at local midnight. Builds a day streak.
- **Endless:** 3 lives. Keep going until you're fooled three times.

Keyboard: `R` / `←` = Real, `F` / `→` = Rendered, `Enter` = next.

## Run locally

It's a static site with no build step:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

`.github/workflows/pages.yml` publishes the repo root to GitHub Pages on every push to `main`.
One-time setup: **Settings → Pages → Source: GitHub Actions**.
The site will be at `https://<user>.github.io/real-or-rendered/`.

## Project layout

| File | What it is |
| --- | --- |
| `index.html` | Landing page |
| `play.html` | The game |
| `assets/headlines.js` | Headline bank (real + rendered) |
| `assets/game.js` | Game logic: daily seeding, endless mode, streaks, sharing |
| `assets/styles.css` | Shared styles (light + dark) |

## Adding headlines

Append to `window.HEADLINES` in `assets/headlines.js`:

```js
{id:'r15', real:true, h:'Headline text', why:'One-line explanation.', src:'https://link-to-the-news-report'},
{id:'f16', real:false, h:'Made-up headline', why:'Rendered. Short quip.'},
```

Rules: every `real:true` entry must have a `src` link to a news report. Keep `id`s unique.
The daily puzzle is seeded from the puzzle number, so adding headlines changes future puzzles (and may change today's).

Progress (streaks, best scores) is saved in the player's browser via `localStorage`. There are no accounts and no tracking.
