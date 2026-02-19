# Single Stair Visualizer

An interactive visualization tool for Chicago single stair building code reform. Compares current multi-staircase requirements against proposed single stair reform to show how reduced circulation space translates into larger apartments with more bedrooms.

Built for [Strong Towns Chicago](https://www.strongtownschicago.org) advocacy efforts.

## What It Shows

Chicago's building code requires each unit above the second story to access two stairways. On a standard 25-foot lot, that means **three stairways per building** — consuming up to 36% of floor area. Seattle, New York, Austin, and Honolulu already allow single stair with sprinklers.

The visualizer renders side-by-side 2D floor plans and a 3D building view comparing:

- **Current Code**: 3 staircases + hallways on a single lot, 2 + hallway on a double lot
- **Single Stair Reform**: 1 centrally placed staircase with point-access units

## Features

- **2D Floor Plans**: Horizontal SVG floor plans with room subdivisions (Living/Kitchen, Bedrooms, Bath), staircase and hallway overlays, and hover tooltips
- **3D Building View**: Interactive Three.js model with orbit controls, floor slabs, and window indicators
- **Guided Tour**: Step-through camera tour for presentations
- **Configurable**: Toggle lot type (single 25x125 / double 50x125), stories (2-4), and floor selection
- **Live Stats**: Per-floor and whole-building comparison tables with delta highlights
- **URL State**: Configuration persists in the URL hash for sharing specific views
- **Responsive**: Works on desktop and mobile viewports

## Architecture

Pure client-side JavaScript, no build step or dependencies beyond CDN-loaded Three.js.

```
index.html        Main page — markup, CSS, and app controller
layout.js         Layout engine — generates floor plan data from configuration
renderer.js       SVG renderer — converts layout data to horizontal SVG floor plans
stats.js          Stats computation — per-floor and whole-building comparisons
state.js          URL hash encoding/decoding for shareable configuration
mesh.js           3D mesh data — converts layout output to Three.js mesh descriptors
viewer3d.js       3D viewer — Three.js scene, materials, camera, labels
tour.js           Guided tour — step-based camera animation for presentations
tests.js          Test suite — layout, renderer, stats, and state tests
test-runner.html  Browser-based test runner
run-tests.sh      Node.js test runner script
```

### Data Flow

```
Configuration (lot, stories, stair mode)
    │
    ▼
layout.js ──► Floor plan data (units, staircases, hallways with x/y/w/d)
    │
    ├──► renderer.js ──► SVG (coordinate-swapped so depth runs left-to-right)
    ├──► stats.js ──► Comparison tables
    └──► mesh.js ──► viewer3d.js ──► 3D Three.js scene
```

The layout engine produces data in a coordinate system where X = lot width and Y = lot depth. The SVG renderer swaps axes so plans display horizontally (depth left-to-right), making the 20ft x 80ft lot ratio compact on screen.

## Running Locally

Open `index.html` in a browser. No server required.

To run tests:

```bash
node tests.js
# or from WSL:
./run-tests.sh
```

## Lot Dimensions

| Lot Type | Total | Setbacks | Buildable |
|----------|-------|----------|-----------|
| Single   | 25 x 125 ft | 5 ft side, 15 ft front, 30 ft rear | 20 x 80 ft |
| Double   | 50 x 125 ft | 5 ft side, 15 ft front, 30 ft rear | 45 x 80 ft |

## Staircase Rules Modeled

- **2-story buildings**: Single stair allowed under current code (no difference)
- **3+ story, single lot, current code**: 3 staircases (6 ft wide circulation column) + hallways
- **3+ story, double lot, current code**: 2 staircases at ends of central hallway corridor
- **Reform (any)**: 1 centered staircase with small landing vestibule

## Disclaimer

Illustrative visualization for advocacy purposes, not architectural drawings.
