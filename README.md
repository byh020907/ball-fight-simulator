# Ball Fight Simulator

Ball Fight Simulator is a browser-based auto battle toy inspired by versus simulator videos. Each ball has a distinct ability, movement style, sound, and visual effect. Matches run automatically from a single start button and progress through a tournament bracket.

## Play

Open the GitHub Pages URL after enabling Pages for the repository:

```text
https://byh020907.github.io/ball-fight-simulator/
```

For local development, serve the folder with a local web server instead of opening `index.html` by double-clicking. The game uses native ES modules from `src/`, and browsers block module imports from `file://`.

## Development

Source code is split by responsibility:

- `src/abilities/`: character abilities
- `src/entities.js`: balls and projectiles
- `src/simulation.js`: battle rules and physics
- `src/ui.js`: canvas rendering and UI
- `src/tournament.js`: automatic bracket flow
- `docs/design.md`: visual direction and design notes

Run regression tests:

```bash
npm test
```

## Scripts

```bash
npm test
npm run check
```

## License

MIT
