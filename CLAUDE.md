# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive advocacy visualization for Strong Towns Chicago comparing Chicago's current multi-staircase building code against proposed single stair reform. Shows how reduced circulation space enables larger apartments on standard 25-foot lots. **This is an advocacy tool, not architectural drawings.**

## Development

No build step. Open `index.html` directly in a browser.

**Run tests:**
```bash
node tests.js
# or from WSL:
./run-tests.sh
```

The test suite (`tests.js`) uses a custom zero-dependency assertion framework (assert, assertEqual, assertApprox) that runs in both Node.js and the browser (`test-runner.html`). Tests are grouped by module: TestLayout, TestRenderer, TestStats, TestState, TestTour.

## Architecture

Pure client-side JavaScript with no npm dependencies. Three.js r128 loaded via CDN.

**All application code lives in the root directory** — there are no src/ or lib/ directories:

| File | Role |
|------|------|
| `index.html` | App shell: markup, all CSS, UI controller logic (event handlers, DOM updates, app initialization) |
| `layout.js` | Layout engine: generates floor plan data (units, staircases, hallways with x/y/w/d coordinates) from configuration |
| `renderer.js` | SVG renderer: converts layout data to horizontal SVG floor plans |
| `viewer3d.js` | Three.js 3D scene: materials, camera, orbit controls, render loop, labels |
| `mesh.js` | Converts layout output to Three.js mesh descriptors |
| `stats.js` | Per-floor and whole-building comparison statistics |
| `state.js` | URL hash encoding/decoding for shareable configuration |
| `tour.js` | Step-based guided camera tour for presentations |

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

### 3D Viewer Resource Management

`viewer3d.js` uses module-level state (`_renderer`, `_scene`, `_camera`, `_controls`) and reuses them across renders to prevent WebGL context leaks. The render loop uses idle timeouts for performance.

## Lot Dimensions

| Lot | Total | Buildable (after setbacks) |
|-----|-------|---------------------------|
| Single | 25×125 ft | 20×80 ft |
| Double | 50×125 ft | 45×80 ft |

## Staircase Rules

- 2-story buildings: single stair allowed under current code (no difference between modes)
- 3+ story, single lot, current code: 3 staircases (6 ft wide circulation column) + hallways
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
