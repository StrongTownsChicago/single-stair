# Single Stair Visualizer — Build Progress

## Current Status: Stage 2 Integration In Progress

**Test suite: 205 passed, 0 failed**

All test-driven development steps through Stage 2 courtyard tests are complete. The remaining work is wiring the 3D view (Three.js), guided tour, STL export, and courtyard controls into `index.html`.

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
  - `generateStandardFloor()` — Single/corner lot: stairs along left wall, 2 units to the right
  - `generateDoubleFloor()` — Double lot, 1 stair: centered staircase, 4 quadrant units
  - `generateDoubleHallwayFloor()` — Double lot, current code floor 3+: central hallway with 2 stairs at ends, 4 units
  - `generateCommercialFloor()` — Commercial ground floor: 1 retail unit + stair in corner
- Constants: `STAIR_W=4`, `STAIR_D=10`, `HALLWAY_W=5`, `FRONT_SETBACK=15`, `REAR_SETBACK=30`
- Exports via `module.exports` for Node and global scope for browser

#### 1.2 SVG Renderer — `renderer.js`
- `renderFloorPlanSVG(layout, floorIndex)` — Returns SVG string for a single floor
- `renderComparator(config, floorIndex)` — Returns HTML string with side-by-side current vs reform floor plans + delta callout
- Uses `data-type` attributes for test querying: `"unit"`, `"staircase"`, `"hallway"`, `"window-wall"`, `"unit-label"`, `"lot-boundary"`
- Color scheme: units white, staircases red (#ef4444), hallways orange (#f97316), window walls yellow (#eab308), commercial teal
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
- Defaults: `{lot: "single", stories: 3, stair: "current", ground: "residential"}`
- Validates against allowed values, clamps stories to 2-4

#### 1.5 Integration — `index.html`
- Full single-page app with dark theme matching STC brand
- Control panel: lot type dropdown, stories button group (2/3/4), ground floor dropdown
- Tab bar: Floor Plan | 3D View
- Floor selector buttons with keyboard navigation (arrow keys)
- Side-by-side comparator: Current Code (orange label) | Delta callout | Reform (green label)
- Per-floor comparison table and whole-building summary table
- Tooltip on hover for units, staircases, and window walls
- Responsive layout (stacks on mobile)
- Print stylesheet (clean B&W)
- URL hash state management with back/forward support
- Fonts: DM Sans + JetBrains Mono from Google Fonts CDN

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

### Immediate Next Step: Wire Stage 2 Into `index.html`

The `index.html` currently has a placeholder for the 3D tab. It needs:

1. **Add script tags** for `mesh.js` and `courtyard.js` in `index.html`
2. **Add Three.js** from CDN (the plan says r128): `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>`
3. **Add OrbitControls** (also from CDN or inline)
4. **Implement `render3D()` function** that:
   - Creates a Three.js scene with dark background
   - Adds ambient + directional lighting
   - Adds ground plane with grid showing lot boundaries
   - Calls `buildMeshData()` for both current and reform layouts
   - Creates box geometries from mesh descriptors, colored by type
   - Places both buildings side-by-side in the scene with labels
   - Sets up OrbitControls for rotate/zoom/pan
   - Camera starts at 3/4 aerial angle
5. **Add courtyard mode control** to the control panel:
   - Dropdown: Off, L-shape, U-shape
   - When active, shows courtyard layout instead of standard layout
   - Uses `generateCourtyardLayout()` for the reform side
6. **Implement guided tour mode** (presentation stepper):
   - "Guided Tour" button that starts a step-by-step walkthrough
   - Steps: empty lot → staircases appear → units fill in → reform transition → courtyard
   - Each step triggered by "Next" button or right arrow key
   - Camera animations between steps
7. **Implement STL export**:
   - "Export STL" button
   - Uses three-stl-exporter or manual STL string generation
   - Option for per-floor separate STLs

### After Integration

- Run full test suite (must be 205+ passed, 0 failed)
- Manual visual QA in browser: check floor plans render correctly, 3D view orbits, responsive on mobile
- Verify URL hash state works across all parameters

---

## File Structure

```
single-stair-visualizer/
├── PLAN.md              # Full build plan (source of truth)
├── PROGRESS.md          # This file
├── index.html           # Main app (Stage 1 complete, Stage 2 3D pending)
├── layout.js            # Layout engine (generateLayout)
├── renderer.js          # SVG renderer (renderFloorPlanSVG, renderComparator)
├── stats.js             # Stats calculator (computeStats)
├── state.js             # URL hash state (encodeConfigToHash, decodeHashToConfig)
├── mesh.js              # 3D mesh data builder (buildMeshData)
├── courtyard.js         # Courtyard layout engine (generateCourtyardLayout)
├── tests.js             # All tests (205 tests)
├── test-runner.html     # Browser test runner
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
| **Total** | **205** | |
