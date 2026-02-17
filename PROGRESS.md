# Single Stair Visualizer — Build Progress

## Current Status: 3D View Complete

**Test suite: 517 passed, 0 failed**

Both the 2D floor plan comparator and the 3D view are fully functional. The 3D view uses Three.js to render side-by-side current-code vs reform buildings with orbit controls and a guided tour. All configurations (lot types, stories, ground floor, building type) update the 3D view in real time.

---

## What Has Been Built

### Test Infrastructure
- `tests.js` — Minimal assertion framework (`assert`, `assertEqual`, `assertApprox`, `summary`) + 385 tests across 17 categories
- `test-runner.html` — Browser-based test runner that loads all source files and displays results
- `run-tests.sh` — Shell script to run tests via Node from WSL (uses `/mnt/c/nvm4w/nodejs/node.exe` with Windows paths)

### Stage 1: 2D Floor Plan Comparator (COMPLETE)

#### 1.1 Layout Engine — `layout.js`
- `generateLayout(config)` — Core function that takes `{lot, stories, stair, ground}` and returns a full building layout
- Supports lot types: `single` (25x125), `double` (50x125), `corner` (25x125)
- Supports stair rules: `current` (Chicago current code) and `reform` (single stair)
- Supports ground floor: `residential` and `commercial`
- Stories: 2, 3, or 4
- **Building-level stair decision**: Stair count is determined ONCE based on total building height (`stories`), not per-floor. This is physically correct — stairway shafts run from ground to roof. All floors of a 3+ story building get the same stair layout. (See "Code Accuracy Fix" section below.)
- **Key architecture decision**: Units are placed as non-overlapping rectangles to the right of the staircase column. The `sqft` property includes allocated dead-zone area beyond the unit's bounding box (the area test uses `u.sqft` while overlap tests use `x,y,w,d`).
- Floor layout strategies:
  - `generateStandardFloor()` — Single/corner lot, 1 stair: stairs along left wall, 2 units to the right
  - `generateMultiStairFloor()` — Single/corner lot, 3+ story current code: 6ft-wide circulation column with 3 stairs (front/center/rear) + 2 connecting hallways, units in remaining 14ft width. **Produces +440 sf (+39%) delta vs reform on single lots.**
  - `generateDoubleFloor()` — Double lot, 1 stair: centered staircase, 4 quadrant units
  - `generateDoubleHallwayFloor()` — Double lot, 3+ story current code: central hallway with 2 stairs at ends, 4 units
  - `generateCommercialFloor()` — Commercial ground floor: 1 retail unit + stair in corner (exception: always 1 stair regardless of building height)
- Constants: `STAIR_W=4`, `STAIR_D=10`, `HALLWAY_W=5`, `MULTI_STAIR_W=6`, `FRONT_SETBACK=15`, `REAR_SETBACK=30`
- Exports via `module.exports` for Node and global scope for browser

#### 1.2 SVG Renderer — `renderer.js`
- `renderFloorPlanSVG(layout, floorIndex)` — Returns SVG string for a single floor
- `renderComparator(config, floorIndex)` — Returns HTML string with side-by-side current vs reform floor plans + delta callout
- `renderCourtyardSVG(courtyardLayout, floorIndex)` — Returns SVG string for courtyard layouts (L-shape/U-shape) with green courtyard rect, segment units, staircases, and window walls
- Interior room detail: dashed partition lines showing Living/Kitchen, BR 1-3, Bath inside each unit
- STAIR/HALL labels rendered inside circulation elements
- Uses `data-type` attributes for test querying: `"unit"`, `"staircase"`, `"hallway"`, `"window-wall"`, `"unit-label"`, `"lot-boundary"`, `"courtyard"`, `"courtyard-label"`, `"room-line"`, `"room-label"`, `"stair-label"`, `"hall-label"`
- Color scheme: units cream (#EDE8DF), staircases red (#D64545), hallways orange (#D4903A), window walls gold (#D9B84A), commercial teal (#3DA89A), courtyard green (#86efac)
- `SCALE = 5` pixels per foot
- SVG viewBox matches buildable dimensions for correct aspect ratio

#### 1.3 Stats Dashboard — `stats.js`
- `computeStats(current, reform)` — Takes two layout objects, returns `{perFloor, wholeBuilding, deltas}`
- Per-floor stats: units, livableArea, avgUnitSize, bedrooms, windowWalls, staircases, circulationArea
- Whole-building stats: totals across all floors
- Deltas: livableArea, livableAreaPct, units, bedrooms, windowWalls, staircases, circulation

#### 1.4 URL State — `state.js`
- `encodeConfigToHash(config)` — Encodes config to URL hash string
- `decodeHashToConfig(hash)` — Decodes hash to config with validation and defaults
- Defaults: `{lot: "single", stories: 3, stair: "current", ground: "residential", buildingType: "standard"}`
- Validates against allowed values, clamps stories to 2-4
- `buildingType` encoded as `building=` URL param; valid values: `"standard"`, `"L"`, `"U"`

#### 1.5 Integration — `index.html`
- Full single-page app with dark theme matching STC brand
- Hero section: "What If Chicago Allowed Single Stair Buildings?" with key stats
- Control panel: lot type dropdown, stories button group (2/3/4), ground floor dropdown, building type dropdown (Standard Block / L-Shape Courtyard / U-Shape Courtyard)
- Tab bar: Floor Plan | 3D View (fully functional)
- Color legend bar
- Floor selector buttons with keyboard navigation (arrow keys)
- Defaults to Floor 3 (where reform impact is visible)
- Narrative headline above comparator: dynamic text based on config explaining the reform argument
- Context panel with advocacy facts (fire safety, stair irony)
- Side-by-side comparator: Current Code (orange label) | Delta callout | Reform (green label)
- Courtyard mode: when L-Shape or U-Shape selected, shows centered courtyard layout with feature cards
- Per-floor comparison table and whole-building summary table
- Tooltip on hover for units, staircases, and window walls
- 3D View tab: Three.js r128 + OrbitControls from CDN, Guided Tour button, tour controls overlay, 3D re-render on config change, keyboard navigation guard during tour
- Responsive layout (stacks on mobile)
- Print stylesheet (clean B&W, excludes 3D tab)
- URL hash state management with back/forward support
- Fonts: DM Serif Display + Instrument Sans + JetBrains Mono from Google Fonts CDN
- Footer: key facts grid, irony callout, peer cities, CTA with STC/AHI links, safety badge

### Stage 2: 3D View & Guided Tour (COMPLETE)

#### 2.1 Three.js 3D Viewer — `viewer3d.js`
- `initScene(container)` — Creates Three.js scene with dark background, ambient + directional lighting, ground plane
- Builds both current-code and reform buildings side-by-side from mesh data, colored by type
- Canvas-based sprite labels ("Current Code" in orange, "Reform" in green) above each building
- Window wall edge highlighting with gold outlines
- Staircase deduplication (stair shafts rendered once spanning full building height, not per-floor)
- Courtyard rendering: single centered building with green courtyard plane for L/U building types
- Hybrid render loop: active during orbit interaction, idles after 2 seconds
- OrbitControls for rotate/zoom/pan; camera starts at 3/4 aerial angle
- ResizeObserver for responsive canvas sizing
- WebGL context reuse and memory-safe cleanup on re-render

#### 2.2 Guided Tour — `tour.js`
- `createTourSteps(config)` — Generates data-driven tour steps scaled to building dimensions
- `createTourState()` + `advanceTour()` — State machine for tour progression
- `animateCamera()` — Smooth camera transitions with ease-in-out cubic interpolation
- 5 steps for standard buildings (overview, current code, reform, comparison, conclusion); courtyard step conditional on L/U type
- 2-story building handling (adjusted messaging)
- Tour UI: annotation overlay with title/description, step indicator, prev/next buttons

#### 2.3-2.4 Mesh Data — `mesh.js`
- `buildMeshData(layout)` — Converts layout to array of mesh descriptors
- Each mesh has: `{type, x, y, z, width, height, depth, floorLevel, ...}`
- Unit meshes: one per unit per floor, height = floor height (10ft residential, 14ft commercial)
- Staircase meshes: one per staircase entry per floor, height = total building height (spans all floors)
- Hallway meshes: one per hallway per floor
- Floor slab meshes: one per floor (0.5ft thick)

#### 2.4 Courtyard Layout — `courtyard.js`
- `generateCourtyardLayout(config)` — Takes `{shape, stories, ground}`, returns `{segments, courtyard}`
- L-shape: 2 segments at 90 angle with interior courtyard
- U-shape: 3 segments (front + two sides) with interior courtyard
- Each segment has its own floors array with 1 staircase and up to 2 units per floor
- Courtyard-facing units get `"courtyard"` in their windowWalls array
- Constants: `CY_SEGMENT_WIDTH=20`, `CY_SEGMENT_DEPTH=40`

---

## Code Accuracy Fix (Most Recent Change)

Documented in `STAIRCASE-CODE-ACCURACY.md`. Two factual inaccuracies were identified by researching the reference PDFs in the repo and the Chicago building code:

### Finding 1: Floor-by-Floor Stair Count Was Physically Wrong

**Problem:** The layout engine assigned stair counts per floor (`floorLevel <= 2` gets 1 stair, `floorLevel >= 3` gets 3 stairs). This is physically impossible — stairway shafts are vertical structures that run from ground to roof. Exhibit A in the STC brief shows a "TYPICAL FLOOR PLAN" label and the 3D view shows stair shafts running continuously through every story.

**Fix:** Moved the stair-count decision from inside the floor loop to before it, basing it on total `stories` instead of individual `floorLevel`:
- 2-story buildings: 1 stair on all floors (unchanged)
- 3+ story buildings, current code: 3 stairs on ALL floors (single/corner lot) or 2 stairs on ALL floors (double lot)
- Reform: always 1 stair (unchanged)
- Commercial ground floor: still gets 1 staircase via `generateCommercialFloor()` (exception preserved)

**Impact:** The reform benefit (3 stairs -> 1 stair) now applies to every floor, not just floor 3+. Total livable area gained increases significantly. The per-floor comparison is impactful on every floor.

### Finding 2: Narrative Messaging Was Incorrect

**Problem:** Several messages said "Floors 1-2 already allow a single stair" and "Same under both codes." These were wrong for 3+ story buildings after the layout fix.

**Fix:**
- Removed "Floors 1-2 already allow a single stair" headline
- Replaced per-floor conditional narrative with a universal one showing the delta on every floor
- Updated floor note from per-floor to building-level: "All floors: Current code requires 3 staircases for buildings above 2 stories"
- Updated context panel to show for all floors of 3+ story buildings
- Updated hero subtitle from "above the 2nd floor" to "over 2 stories"

### New Tests Added: 132 (253 -> 385)

- Building-level stair consistency: all floors have same stair count in 3+ story buildings (all lot types)
- Building-level hallway consistency: all floors have same hallway count
- Floor 1 layout matches floor 3 on 3-story single lot (stair count, hallway count, livable sqft)
- 2-story buildings still get 1 stair on all floors
- Reform always gets 1 stair regardless of building height (2, 3, 4 stories)
- Commercial ground floor exception preserved (1 stair even in 3+ story buildings)
- Delta >= 15% on every floor of 3+ story single/corner lot buildings
- No overlaps on floor 1 of multi-stair layouts
- Area conservation on floor 1 of multi-stair layouts

---

## What Remains To Be Done

### Stage 3: Enhancements (Post-Launch)

- Real address lookup (Chicago GIS APIs)
- Ward impact overlay (estimate additional units from reform)
- Fire safety data integration
- Peer city comparison timeline

---

## File Structure

```
single-stair-visualizer/
├── PLAN.md                           # Original build plan
├── PROGRESS.md                       # This file
├── STAIRCASE-CODE-ACCURACY.md        # Research & fix plan for stair count accuracy
├── IMPROVEMENT-PLAN.md               # Earlier plan: wider circulation zone + courtyard rendering
├── ADVOCACY-REDESIGN-PLAN.md         # Earlier plan: room detail, bedroom formula, page redesign
├── Brief on Approaching [...].pdf    # 8-page STC brief for Alderman Matt Martin (reference)
├── Single Stair One Pager.pdf        # 1-page STC policy one-pager (reference)
├── index.html                        # Main app (Stage 1 + Stage 2 complete)
├── layout.js                         # Layout engine (generateLayout + 5 floor generators)
├── renderer.js                       # SVG renderer (renderFloorPlanSVG, renderComparator, renderCourtyardSVG)
├── stats.js                          # Stats calculator (computeStats)
├── state.js                          # URL hash state (encodeConfigToHash, decodeHashToConfig)
├── mesh.js                           # 3D mesh data builder (buildMeshData)
├── courtyard.js                      # Courtyard layout engine (generateCourtyardLayout)
├── viewer3d.js                       # Three.js 3D scene manager (initScene, cleanup, render loop)
├── tour.js                           # Guided tour (createTourSteps, animateCamera, state management)
├── tests.js                          # Full test suite (517 tests)
├── test-runner.html                  # Browser test runner
└── run-tests.sh                      # Node test runner script (WSL)
```

---

## Key Technical Decisions & Gotchas

### Running Tests
- **No `node` on PATH in this WSL environment.** Must use `/mnt/c/nvm4w/nodejs/node.exe` with Windows-style paths.
- `run-tests.sh` handles the path conversion automatically.
- Tests run in Node using `require()` with `module.exports`. In browser, scripts are loaded via `<script>` tags and functions are global.

### The Overlap Problem (Most Important Architectural Decision)
The layout engine's biggest challenge was making units, staircases, and hallways tile without overlapping while also having areas sum to the total buildable area. The solution:

- **Units are offset** from stairs (placed in the right portion of the floor, to the right of the staircase column at x=STAIR_W or x=MULTI_STAIR_W)
- **Dead zones** (areas beside stairs not covered by any element) are calculated and their area is distributed proportionally to unit `sqft` values
- **`sqft` is the effective livable area** (includes allocated dead-zone bonus), NOT necessarily `w * d`
- The area conservation test uses `u.sqft` (effective), while the overlap test uses `x, y, w, d` (physical bounding box)
- This means a unit's `sqft` is always >= `w * d`

### Building-Level vs Floor-Level Stair Logic
The stair count decision is made ONCE before the floor loop, based on total `stories` (not per-floor `floorLevel`). This is physically correct because stairway shafts run the full height of the building. The commercial ground floor is the sole exception: `generateCommercialFloor()` always places 1 stair regardless, since the retail space wraps around the shaft differently.

### Module Pattern
Every JS file uses the same pattern:
```javascript
function myFunction() { ... }

if (typeof module !== "undefined" && module.exports) {
  module.exports = { myFunction };
}
```
And `tests.js` loads them:
```javascript
if (typeof require !== "undefined") {
  const _mod = require("./myfile.js");
  if (_mod.myFunction) globalThis.myFunction = _mod.myFunction;
}
```

### Constants Shared Across Files
- `layout.js` and `courtyard.js` both define their own stair/lot constants (not shared via import since these are plain script files)
- `mesh.js` defines `RESIDENTIAL_FLOOR_HEIGHT=10` and `COMMERCIAL_FLOOR_HEIGHT=14`
- If constants need to change, update in all files

---

## Test Categories and Counts

| Category | Count | File Section |
|---|---|---|
| Lot geometry | 4 | 1.1 tests |
| Staircase counts | 10 | 1.1 tests (updated: floor 1 of 3-story now asserts 3 stairs) |
| Area conservation | 3 | 1.1 tests |
| Comparative (reform >= current) | ~27 | 1.1 tests (3 lots x 3 story counts x 3 floors) |
| Window walls | 3 | 1.1 tests |
| Commercial ground floor | 3 | 1.1 tests |
| No overlaps | ~85 | 1.1 tests (all element pairs on all floors, now more elements per floor) |
| SVG renderer | 15 | 1.2 tests |
| Stats dashboard | ~29 | 1.3 tests |
| URL state | 8 | 1.4 tests |
| 3D geometry | ~20 | 2.2 tests |
| Floor stacking | 4 | 2.3 tests |
| Courtyard layout | ~16 | 2.4 tests |
| Multi-stair hallways | ~14 | 3.1 tests |
| Building-level stair consistency | ~80 | 3.1b tests (stair/hallway consistency, floor matching, 2-story check, reform check, commercial exception, delta on every floor, no overlaps, area conservation) |
| Courtyard SVG renderer | 4 | 3.2 tests |
| URL state buildingType | 3 | 3.3 tests |
| 3D scene construction | ~20 | 4.1 tests |
| Tour steps | ~15 | 4.2 tests |
| 3D integration | ~12 | 4.4 tests |
| **Total** | **517** | |

---

## Changelog

### 2026-02-16: 3D View & Guided Tour
- Added Three.js 3D viewer with side-by-side building comparison (`viewer3d.js`)
- Added guided tour with smooth camera animations and annotation overlay (`tour.js`)
- Wired 3D tab in `index.html` with OrbitControls, tour UI, action buttons
- Real-time 3D re-render on config change
- Courtyard mode renders single centered building with green courtyard plane
- Added 132 new tests for scene construction, tour steps, and integration (385 -> 517)

### 2026-02-16: Code Accuracy Fix
- Fixed stair-count logic from per-floor to per-building (`layout.js`)
- Updated narrative messaging to remove incorrect "floors 1-2 same" claims (`index.html`)
- Added 132 new tests for building-level stair consistency (`tests.js`)
- Documented research and fix in `STAIRCASE-CODE-ACCURACY.md`

### Earlier: Advocacy Redesign
- Added room subdivisions inside units (BR 1, BR 2, BR 3, Bath, Kitchen)
- Fixed bedroom estimation formula (cap raised from `windowWalls * 2` to `windowWalls * 3`)
- Added STAIR/HALL labels inside circulation elements
- Redesigned page: hero section, stat cards, legend, narrative headline, context panel, footer with CTA
- Dark theme with design tokens

### Earlier: Courtyard & Delta Enhancement
- Added `generateMultiStairFloor()` with 6ft-wide circulation column (+39% delta)
- Added `renderCourtyardSVG()` for L-shape and U-shape courtyard rendering
- Added courtyard mode UI with feature cards and single-layout stats tables
- Added `buildingType` to URL state
- Defaulted to Floor 3

### Earlier: Core Build (Stages 1-2 data layer)
- Layout engine, SVG renderer, stats dashboard, URL state
- 3D mesh data builder
- Courtyard layout engine
- Test infrastructure
