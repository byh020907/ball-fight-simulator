# Ball Fight Simulator

Ball Fight Simulator is a browser-based auto battle toy inspired by versus simulator videos. Each ball has a distinct ability, movement style, sound, and visual effect. Matches run automatically from a single start button and progress through a tournament bracket.

## Play

Open `index.html` directly in a browser.

The page loads `dist/app.bundle.js`, so it works without a local web server and avoids `file://` module CORS issues.

## Development

Source code is split by responsibility:

- `src/abilities/`: character abilities
- `src/entities.js`: balls and projectiles
- `src/simulation.js`: battle rules and physics
- `src/ui.js`: canvas rendering and UI
- `src/tournament.js`: automatic bracket flow
- `docs/design.md`: visual direction and design notes

After editing source modules, rebuild the browser bundle:

```bash
npm run build
```

Run regression tests:

```bash
npm test
```

## Scripts

```bash
npm run build
npm test
npm run check
```

## License

MIT
