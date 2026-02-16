# Plan: Make the Single Stair Visualizer a Compelling Advocacy Tool

## Context

The Single Stair Visualizer currently shows only a +5% livable area difference on single lots (the most common Chicago case). This is because all 3 staircases are crammed into a 4ft-wide left column, making the circulation overhead nearly invisible. The courtyard apartment argument (half the advocacy brief) is completely absent from the 2D view. The app defaults to Floor 1 where deltas are zero. An alderman or CFD official opening this tool would see no compelling reason to support reform.

**Goal:** Make the floor plan comparator visually and numerically dramatic enough to support the three core arguments from the STC/AHI brief:
1. Current code wastes space on stairs/hallways (~39% more livable area under reform)
2. Courtyard apartments become feasible under reform (currently not shown at all)
3. The difference only matters on Floor 3+ (so we should start there)

---

## Changes

### 1. Widen the circulation zone for 3-staircase floors (`layout.js`)

**Why:** In reality, 3 distributed staircases on a 20ft-wide building need landing space, fire doors, and connecting corridors — not just a 4ft column. A 6ft-wide circulation zone is architecturally honest.

**What changes:**
- Add constant `MULTI_STAIR_W = 6` (vs current `STAIR_W = 4`)
- Add new function `generateMultiStairFloor()` for single/corner lots with 3 staircases
- Set `needsHallway = true` for single/corner lot floor 3+ under current code
- Pass `needsHallway` through `generateFloor()` → `generateStandardFloor()`

**New layout for current code, single lot, floor 3+ (3 stairs):**
```
circW=6, bw=20, bd=80, halfD=40

Staircase 1: {x:0, y:0,  w:6, d:10}  (front)
Hallway 1:   {x:0, y:10, w:6, d:25}  (corridor between stairs)
Staircase 2: {x:0, y:35, w:6, d:10}  (center)
Hallway 2:   {x:0, y:45, w:6, d:25}  (corridor between stairs)
Staircase 3: {x:0, y:70, w:6, d:10}  (rear/gangway)

Unit A: {x:6, y:0,  w:14, d:40}  → 560 sf
Unit B: {x:6, y:40, w:14, d:40}  → 560 sf
Total: 560+560+180+300 = 1600 = 20×80 ✓ (area conservation holds)
No overlaps ✓ (all circulation at x:0-6, all units at x:6-20)
```

**Reform (1 stair) stays unchanged:** Units at 780 sf each = 1560 sf total.

**New delta: +440 sf (+39%)** vs current +80 sf (+5%).

The visual impact is huge: the current-code floor plan will show a wide orange/red corridor running the full depth of the building alongside narrower white units.

### 2. Add courtyard SVG rendering (`renderer.js`)

**Why:** Courtyard apartments are half the advocacy brief. `courtyard.js` already produces the data, but there's zero rendering code.

**What changes:**
- Add `renderCourtyardSVG(courtyardLayout, floorIndex)` function
- Calculates bounding box from all segments + courtyard bounds
- Renders courtyard open space as a light green rect with label
- Renders each segment's units, staircases, and window walls (reusing existing visual language)
- Dynamic font sizing (same formula as the fix already applied)
- Export via `module.exports`

### 3. Wire courtyard mode into the UI (`index.html`)

**What changes:**
- Add `<script src="courtyard.js"></script>`
- Add "Building Type" control: Standard Block / L-Shape Courtyard / U-Shape Courtyard
- Branch `render()`: standard mode uses existing comparator; courtyard mode renders standard block on left, courtyard on right
- Update reform panel label dynamically ("Single Stair Reform (L-Shape Courtyard)")
- Wire event listener for building type select

### 4. Default to Floor 3 (`index.html`)

**What changes:**
- Change `let currentFloorIndex = 0` → `let currentFloorIndex = 2`
- Existing clamp logic (line 444) already handles 2-story buildings

### 5. Add narrative headline (`index.html`)

**What changes:**
- Add `.narrative-headline` div above the comparator
- Dynamic text based on floor and building type:
  - Floor 3+ standard: "Current code requires 3 staircases above the 2nd floor, wasting **X sf (+Y%)** of livable space per floor."
  - Floor 1-2: "Floors 1-2 are the same under both codes. Select Floor 3 to see the difference."
  - Courtyard mode: "Single stair reform enables courtyard buildings with apartments facing shared open space for more natural light."

### 6. Update URL state for building type (`state.js`)

**What changes:**
- Add `buildingType` to defaults, encoding, decoding, and validation
- Valid values: `"standard"`, `"L"`, `"U"`

### 7. Update tests (`tests.js`)

Per TDD methodology, tests are written FIRST (before implementation).

**New tests (~15):**
- 3-staircase floors have hallway elements on single lots
- Circulation column is wider for 3-stair vs 1-stair floors
- Stairs distributed front/center/rear (y-position checks)
- Single lot floor 3 delta >= 15% (the dramatic delta assertion)
- `renderCourtyardSVG` produces SVG with correct unit/stair/courtyard element counts
- URL state roundtrip for `buildingType`

**Existing tests that should still pass (verified by arithmetic):**
- Area conservation: 560+560+180+300 = 1600 exactly (within ±20 tolerance)
- No overlaps: all circulation at x:0-6, all units at x:6-20
- Reform >= current livable: 1560 >> 1120, passes easily
- Reform >= current windows: same window walls (both get north/south), passes
- Staircase counts: unchanged (3 for current floor 3+, 1 for reform)

---

## Files Modified

| File | Changes |
|------|---------|
| `tests.js` | Add ~15 new tests FIRST (TDD red) |
| `layout.js` | Add `MULTI_STAIR_W=6`, `generateMultiStairFloor()`, update `needsHallway` logic |
| `renderer.js` | Add `renderCourtyardSVG()` (~70 lines) |
| `state.js` | Add `buildingType` parameter |
| `index.html` | Add courtyard control, default floor 3, narrative headline, courtyard render branch |
| `test-runner.html` | Add `courtyard.js` script tag |

## Execution Order (TDD)

1. **RED:** Write all new tests in `tests.js`, confirm they fail
2. **GREEN (layout):** Implement `generateMultiStairFloor()` in `layout.js`
3. **GREEN (renderer):** Implement `renderCourtyardSVG()` in `renderer.js`
4. **GREEN (state):** Add `buildingType` to `state.js`
5. **UI:** Wire everything into `index.html` (default floor, courtyard control, narrative)
6. **Verify:** Run full test suite, then visual QA in Chrome DevTools MCP

## Verification

- Run tests via `test-runner.html` in browser — all 205+ tests must pass
- Open app in Chrome DevTools MCP:
  - Default view should be Floor 3, showing dramatic difference
  - Single lot: delta should be ~+440 sf (+39%), with visible orange hallway on current code side
  - Switch to L-Shape/U-Shape courtyard: reform panel shows courtyard layout with green open space
  - Check all lot types (single, double, corner) × stories (2,3,4) × ground floors
  - Verify URL hash includes `building=` parameter and roundtrips correctly
