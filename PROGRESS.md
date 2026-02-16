# Single Stair Visualizer — Build Progress

## Current Status: Advocacy Tool Enhancements Complete

**Test suite: 253 passed, 0 failed**

All test-driven development steps through Stage 2 courtyard tests are complete. The advocacy-focused enhancements (dramatic delta, courtyard UI, narrative headline) are now wired in. The remaining work is the 3D view (Three.js), guided tour, and STL export.

---

## What Has Been Built

### Test Infrastructure
- `tests.js` — Minimal assertion framework (`assert`, `assertEqual`, `assertApprox`, `summary`) + all tests for Stages 1 and 2
- `test-runner.html` — Browser-based test runner that loads all source files and displays results
- `run-tests.sh` — Shell script to run tests via Node from WSL (uses `/mnt/c/nvm4w/nodejs/node.exe` with Windows paths)

### Stage 1: 2D Floor Plan Comparator (COMPLETE)

#### 1.1 Layout Engine — `layout.js`
- `generateLayout(config)` — Core function that takes `{lot, stories, stair, ground}` and returns a full building layout
- Supports lot types: `single` (25×125), `double` (50×125), `corner` (25×125)
- Supports stair rules: `current` (Chicago current code) and `reform` (single stair)
- Supports ground floor: `residential` and `commercial`
- Stories: 2, 3, or 4
- **Key architecture decision**: Units are placed as non-overlapping rectangles to the right of the staircase column. The `sqft` property includes allocated dead-zone area beyond the unit's bounding box (the area test uses `u.sqft` while overlap tests use `x,y,w,d`). This was the hardest design problem — see details below.
- Floor layout strategies:
  - `generateStandardFloor()` — Single/corner lot: stairs along left wall, 2 units to the right (used for 1-stair floors)
  - `generateMultiStairFloor()` — Single/corner lot, floor 3+ current code: 6ft-wide circulation column with 3 stairs (front/center/rear) + 2 connecting hallways, units in remaining 14ft width. **Produces +440 sf (+39%) delta vs reform on single lots.**
  - `generateDoubleFloor()` — Double lot, 1 stair: centered staircase, 4 quadrant units
  - `generateDoubleHallwayFloor()` — Double lot, current code floor 3+: central hallway with 2 stairs at ends, 4 units
  - `generateCommercialFloor()` — Commercial ground floor: 1 retail unit + stair in corner
- Constants: `STAIR_W=4`, `STAIR_D=10`, `HALLWAY_W=5`, `MULTI_STAIR_W=6`, `FRONT_SETBACK=15`, `REAR_SETBACK=30`
- Exports via `module.exports` for Node and global scope for browser

#### 1.2 SVG Renderer — `renderer.js`
- `renderFloorPlanSVG(layout, floorIndex)` — Returns SVG string for a single floor
- `renderComparator(config, floorIndex)` — Returns HTML string with side-by-side current vs reform floor plans + delta callout
- `renderCourtyardSVG(courtyardLayout, floorIndex)` — Returns SVG string for courtyard layouts (L-shape/U-shape) with green courtyard rect, segment units, staircases, and window walls
- Uses `data-type` attributes for test querying: `"unit"`, `"staircase"`, `"hallway"`, `"window-wall"`, `"unit-label"`, `"lot-boundary"`, `"courtyard"`, `"courtyard-label"`
- Color scheme: units cream (#EDE8DF), staircases red (#D64545), hallways orange (#D4903A), window walls gold (#D9B84A), commercial teal, courtyard green (#86efac)
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
- Control panel: lot type dropdown, stories button group (2/3/4), ground floor dropdown, **building type dropdown** (Standard Block / L-Shape Courtyard / U-Shape Courtyard)
- Tab bar: Floor Plan | 3D View
- Floor selector buttons with keyboard navigation (arrow keys)
- **Defaults to Floor 3** (where reform impact is visible) instead of Floor 1
- **Narrative headline** above comparator: dynamic text based on floor/mode explaining the reform argument
- Side-by-side comparator: Current Code (orange label) | Delta callout | Reform (green label)
- **Courtyard mode**: when L-Shape or U-Shape is selected, left panel shows standard reform block, right panel shows courtyard layout with green open space; delta panel shows courtyard-specific metrics
- Dynamic panel labels update for courtyard mode
- Per-floor comparison table and whole-building summary table
- Tooltip on hover for units, staircases, and window walls
- Responsive layout (stacks on mobile)
- Print stylesheet (clean B&W)
- URL hash state management with back/forward support (includes `building=` param)
- Fonts: DM Serif Display + Outfit + JetBrains Mono from Google Fonts CDN

### Advocacy Tool Enhancements (COMPLETE)

These changes make the visualizer dramatically more compelling for the STC/AHI advocacy brief:

#### Wider Circulation Zone — `layout.js`
- Added `MULTI_STAIR_W = 6` (vs `STAIR_W = 4` for single-stair floors)
- New `generateMultiStairFloor()` for single/corner lots with 3 staircases on floor 3+
- 3 stairs distributed front/center/rear in a 6ft-wide column with 2 connecting hallways
- Units get 14ft width (was 16ft) — **delta jumps from +80 sf (+5%) to +440 sf (+39%)**
- Area conservation holds exactly: 1120 (units) + 180 (stairs) + 300 (hallways) = 1600 sf

#### Courtyard SVG Rendering — `renderer.js`
- `renderCourtyardSVG()` renders L-shape and U-shape courtyard layouts
- Calculates bounding box from all segments + courtyard bounds
- Green courtyard rect with area label
- Reuses existing visual language (same colors, font sizing, data attributes)

#### Courtyard Mode UI — `index.html`
- "Building Type" dropdown: Standard Block / L-Shape Courtyard / U-Shape Courtyard
- Courtyard mode shows standard reform block on left, courtyard on right
- Delta panel shows courtyard-specific metrics (livable area, window walls, courtyard space)
- Dynamic panel labels ("Single Stair Reform (L-Shape Courtyard)")

#### Default Floor 3 — `index.html`
- Changed `currentFloorIndex` from 0 to 2 (Floor 3)
- Floor 3 is where reform impact is visible (3 staircases under current code)
- Existing clamp logic handles 2-story buildings gracefully

#### Narrative Headline — `index.html`
- Dynamic `.narrative-headline` div above the comparator
- Floor 3+ standard: "Current code requires 3 staircases above the 2nd floor, wasting **X sf (+Y%)** of livable space per floor."
- Floor 1-2: "Floors 1-2 are the same under both codes. **Select Floor 3** to see the difference."
- Courtyard mode: "Single stair reform enables **L/U-Shape courtyard buildings** with apartments facing shared open space for more natural light."

#### URL State — `state.js`
- Added `buildingType` to defaults, encoding, decoding, and validation
- Encoded as `building=` URL param; valid values: `"standard"`, `"L"`, `"U"`

### Stage 2: 3D Building Explorer (TESTS COMPLETE, INTEGRATION PENDING)

#### 2.2-2.3 Mesh Data — `mesh.js`
- `buildMeshData(layout)` — Converts layout to array of mesh descriptors
- Each mesh has: `{type, x, y, z, width, height, depth, floorLevel, ...}`
- Unit meshes: one per unit per floor, height = floor height (10ft residential, 14ft commercial)
- Staircase meshes: one per staircase entry per floor, height = total building height (spans all floors)
- Hallway meshes: one per hallway per floor
- Floor slab meshes: one per floor (0.5ft thick)
- **Note**: Staircase meshes are NOT deduplicated across floors (the plan's tests expect one mesh per staircase per floor)

#### 2.4 Courtyard Layout — `courtyard.js`
- `generateCourtyardLayout(config)` — Takes `{shape, stories, ground}`, returns `{segments, courtyard}`
- L-shape: 2 segments at 90° angle with interior courtyard
- U-shape: 3 segments (front + two sides) with interior courtyard
- Each segment has its own floors array with 1 staircase and up to 2 units per floor
- Courtyard-facing units get `"courtyard"` in their windowWalls array
- Constants: `CY_SEGMENT_WIDTH=20`, `CY_SEGMENT_DEPTH=40`

---

## What Remains To Be Done

### 3D View Integration (Stage 2 — `index.html`)

The `index.html` currently has a placeholder for the 3D tab. It needs:

1. **Add Three.js** from CDN (the plan says r128): `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>`
2. **Add OrbitControls** (also from CDN or inline)
3. **Implement `render3D()` function** that:
   - Creates a Three.js scene with dark background
   - Adds ambient + directional lighting
   - Adds ground plane with grid showing lot boundaries
   - Calls `buildMeshData()` for both current and reform layouts
   - Creates box geometries from mesh descriptors, colored by type
   - Places both buildings side-by-side in the scene with labels
   - Sets up OrbitControls for rotate/zoom/pan
   - Camera starts at 3/4 aerial angle
4. **Implement guided tour mode** (presentation stepper):
   - "Guided Tour" button that starts a step-by-step walkthrough
   - Steps: empty lot → staircases appear → units fill in → reform transition → courtyard
   - Each step triggered by "Next" button or right arrow key
   - Camera animations between steps
5. **Implement STL export**:
   - "Export STL" button
   - Uses three-stl-exporter or manual STL string generation
   - Option for per-floor separate STLs

---

## File Structure

```
single-stair-visualizer/
├── PLAN.md              # Full build plan (source of truth)
├── PROGRESS.md          # This file
├── index.html           # Main app (Stage 1 + advocacy enhancements complete, Stage 2 3D pending)
├── layout.js            # Layout engine (generateLayout, generateMultiStairFloor)
├── renderer.js          # SVG renderer (renderFloorPlanSVG, renderComparator, renderCourtyardSVG)
├── stats.js             # Stats calculator (computeStats)
├── state.js             # URL hash state (encodeConfigToHash, decodeHashToConfig, buildingType)
├── mesh.js              # 3D mesh data builder (buildMeshData)
├── courtyard.js         # Courtyard layout engine (generateCourtyardLayout)
├── tests.js             # All tests (253 tests)
├── test-runner.html     # Browser test runner (loads all source files including mesh.js and courtyard.js)
└── run-tests.sh         # Node test runner script (WSL → Windows node.exe)
```

---

## Key Technical Decisions & Gotchas

### Running Tests
- **No `node` on PATH in this WSL environment.** Must use `/mnt/c/nvm4w/nodejs/node.exe` with Windows-style paths.
- `run-tests.sh` handles the path conversion automatically.
- Tests run in Node using `require()` with `module.exports`. In browser, scripts are loaded via `<script>` tags and functions are global.

### The Overlap Problem (Most Important Architectural Decision)
The layout engine's biggest challenge was making units, staircases, and hallways tile without overlapping while also having areas sum to the total buildable area. The solution:

- **Units are offset** from stairs (placed in the right portion of the floor, to the right of the staircase column at x=STAIR_W)
- **Dead zones** (areas beside stairs not covered by any element) are calculated and their area is distributed proportionally to unit `sqft` values
- **`sqft` is the effective livable area** (includes allocated dead-zone bonus), NOT necessarily `w × d`
- The area conservation test uses `u.sqft` (effective), while the overlap test uses `x, y, w, d` (physical bounding box)
- This means a unit's `sqft` is always >= `w × d`

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

### TDD Compliance
The plan mandates strict red/green TDD. Every feature was implemented in this order:
1. Write failing tests (RED) — confirm they fail
2. Implement minimum code to pass (GREEN) — confirm all pass
3. No implementation code exists without a corresponding test

### Constants Shared Across Files
- `layout.js` and `courtyard.js` both define their own stair/lot constants (not shared via import since these are plain script files)
- `mesh.js` defines `RESIDENTIAL_FLOOR_HEIGHT=10` and `COMMERCIAL_FLOOR_HEIGHT=14`
- If constants need to change, update in all files

---

## Test Categories and Counts

| Category | Count | File Section |
|---|---|---|
| Lot geometry | 4 | 1.1 tests |
| Staircase counts | 6 | 1.1 tests |
| Area conservation | 3 | 1.1 tests |
| Comparative (reform >= current) | ~27 | 1.1 tests (3 lots × 3 story counts × 3 floors) |
| Window walls | 3 | 1.1 tests |
| Commercial ground floor | 3 | 1.1 tests |
| No overlaps | ~67 | 1.1 tests (all element pairs on all floors) |
| SVG renderer | 15 | 1.2 tests |
| Stats dashboard | ~29 | 1.3 tests |
| URL state | 8 | 1.4 tests |
| 3D geometry | ~20 | 2.2 tests |
| Floor stacking | 4 | 2.3 tests |
| Courtyard layout | ~16 | 2.4 tests |
| Multi-stair hallways | ~14 | 3.1 tests (hallway elements, wider circulation, stair distribution, delta >=15%, area conservation, no overlaps) |
| Courtyard SVG renderer | 4 | 3.2 tests (SVG output, courtyard rect, unit count, staircase count) |
| URL state buildingType | 3 | 3.3 tests (roundtrip, default, invalid fallback) |
| **Total** | **253** | |
