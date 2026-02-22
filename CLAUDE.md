# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive advocacy visualization for Strong Towns Chicago comparing Chicago's current multi-staircase building code against proposed single stair reform. Shows how reduced circulation space enables larger apartments on standard 25-foot lots. **This is an advocacy tool, not architectural drawings.**

## Development

No build step. Serve the project root with any local HTTP server (ES modules require it):

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then open `http://localhost:8000`.

**Run tests:**
```bash
node tests.js
# or from WSL:
./run-tests.sh
```

The test suite (`tests.js`) uses a custom zero-dependency assertion framework (assert, assertEqual, assertApprox) that runs in both Node.js and the browser (`test-runner.html`). Tests are grouped by module: TestLayout, TestRenderer, TestStats, TestState, TestTour.

## Architecture

Pure client-side JavaScript with no npm dependencies. Three.js r183 loaded via CDN import map (ES modules). Full Three.js API documentation is available at `docs/threejs/threejs_full_llms.txt` for reference when working on the 3D viewer.

**All application code lives in the root directory** — there are no src/ or lib/ directories:

| File | Role |
|------|------|
| `index.html` | App shell: markup, all CSS, import map for Three.js r183 |
| `app.js` | App controller (ES module): imports from viewer3d.js and tour.js, event handlers, DOM updates, initialization |
| `layout.js` | Layout engine (plain script): generates floor plan data (units, staircases, hallways with x/y/w/d coordinates) from configuration |
| `renderer.js` | SVG renderer (plain script): converts layout data to horizontal SVG floor plans |
| `viewer3d.js` | 3D viewer (ES module): Three.js scene, PBR materials, post-processing, CSS2D labels, camera, orbit controls |
| `mesh.js` | 3D mesh data (ES module): converts layout output to Three.js mesh descriptors |
| `stats.js` | Per-floor and whole-building comparison statistics (plain script) |
| `state.js` | URL hash encoding/decoding for shareable configuration (plain script) |
| `tour.js` | Step-based guided camera tour for presentations (ES module) |

### Data Flow

```
Configuration (lot type, stories, stair mode)
    → layout.js → floor plan data {units, staircases, hallways}
        → renderer.js → SVG (2D plans)
        → stats.js → comparison tables
        → mesh.js → viewer3d.js → Three.js 3D scene
    → state.js ↔ URL hash
```

### Coordinate System

The layout engine (`layout.js`) uses X = lot width, Y = lot depth. The SVG renderer (`renderer.js`) **swaps axes** so depth runs left-to-right, making the narrow 20×80 ft lot ratio display compactly as a horizontal plan.

### Module System

The project uses a hybrid module approach:
- **ES modules** (`type="module"`): `app.js`, `viewer3d.js`, `mesh.js`, `tour.js` — these use `import`/`export` and are loaded via the import map in `index.html`
- **Plain scripts**: `layout.js`, `renderer.js`, `stats.js`, `state.js` — these attach to `window` globals and are loaded as regular `<script>` tags before `app.js`

### 3D Viewer

`viewer3d.js` is an ES module that imports directly from Three.js r183 addons:
- **Materials**: MeshPhysicalMaterial with clearcoat (PBR)
- **Lighting**: Directional lights + RectAreaLight + PMREMGenerator environment map (RoomEnvironment)
- **Post-processing**: EffectComposer pipeline — RenderPass → UnrealBloomPass → SMAAPass → OutputPass
- **Labels**: CSS2DRenderer / CSS2DObject (replaces canvas text sprites from r128)
- **Geometry details**: Window insets on exterior walls, roof parapets on top floors, floor slab overhangs, staircase diagonal indicators, ground plane with contact shadows

Module-level state (`_renderer`, `_scene`, `_camera`, `_controls`) is reused across renders to prevent WebGL context leaks. The render loop uses idle timeouts for performance.

## Lot Dimensions

| Lot | Total | Buildable (after setbacks) |
|-----|-------|---------------------------|
| Single | 25×125 ft | 20×80 ft |
| Double | 50×125 ft | 45×80 ft |

## Staircase Rules

- 2-story buildings: single stair allowed under current code (no difference between modes)
- 3+ story, single lot, current code: 2 staircases + side corridor (5 ft wide)
- 3+ story, double lot, current code: 2 staircases at ends of central hallway corridor
- Reform (any height): 1 centered staircase with small landing vestibule

## Planning & Implementation Workflow

Feature plans go in `feature_planning/<feature-name>/` with `plan.md`, `technical_notes.md`, and `test_plan.md`. Use the `/planner` skill to create plans and `/implementer` skill to execute them.

## Design System

CSS custom properties defined in `index.html`:
- Dark theme: `--bg: #10131a`, `--bg-surface: #171b24`
- Accent: `#e8963a` (warm orange)
- Current code color: `--current: #e07a5a` (terracotta)
- Reform color: `--reform: #5bbf82` (green)
- Typography: DM Serif Display (headlines), Instrument Sans (body), JetBrains Mono (numbers)
