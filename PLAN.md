# Single Stair Visualizer — Build Plan

An interactive web tool combining a 2D floor plan comparator with a 3D building explorer to support Chicago single stair reform advocacy by Strong Towns Chicago and Abundant Housing Illinois.

---

## Goals

The tool needs to persuade three audiences:

1. **Aldermen** — "What does this mean for housing in my ward?"
2. **CFD / DOB** — "This is safe and scoped narrowly."
3. **General public** — "This means bigger, brighter apartments for families."

It must be dead simple to use in a meeting (pull up on a laptop, no install), shareable via URL, and produce visuals clean enough to screenshot for social media or print for handouts.

---

## Development Methodology: Red/Green TDD

**Every feature in this plan follows strict red/green test-driven development.** No implementation code is written until a failing test exists for it. This is non-negotiable — the layout engine has enough spatial edge cases that untested code will produce wrong floor plans that undermine advocacy credibility.

### The Cycle

```
RED:    Write a test that describes the expected behavior. Run it. It MUST fail.
GREEN:  Write the minimum implementation to make the test pass. Run it. It MUST pass.
REFACTOR: Clean up the code without changing behavior. Run tests. They MUST still pass.
```

### Test Infrastructure

Tests live in a separate `tests.js` file (or inline `<script>` block during development). Use a minimal assertion helper — no framework needed:

```javascript
let _passed = 0,
  _failed = 0;
function assert(condition, msg) {
  if (condition) {
    _passed++;
  } else {
    _failed++;
    console.error(`FAIL: ${msg}`);
  }
}
function assertEqual(actual, expected, msg) {
  assert(
    actual === expected,
    `${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  );
}
function assertApprox(actual, expected, tolerance, msg) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${msg} — got ${actual}, expected ${expected} ±${tolerance}`,
  );
}
function summary() {
  console.log(`\n${_passed} passed, ${_failed} failed`);
  if (_failed > 0) throw new Error(`${_failed} tests failed`);
}
```

### Test Categories

| Category                      | What It Tests                                                                | When Written                 |
| ----------------------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| **Layout invariants**         | Spatial math: areas add up, units fit within buildable envelope, no overlaps | Before layout engine (1.1)   |
| **Configuration correctness** | Right number of stairs/hallways for each lot+code combination                | Before layout engine (1.1)   |
| **Comparative assertions**    | Reform always produces ≥ livable area as current code for same lot           | Before stats dashboard (1.3) |
| **Render smoke tests**        | SVG output contains expected elements (rect count, label text)               | Before SVG renderer (1.2)    |
| **3D geometry tests**         | Mesh count, positions, bounding box dimensions match layout                  | Before 3D renderer (2.2)     |
| **Regression tests**          | Any bug found in the wild gets a test added BEFORE the fix                   | Ongoing                      |

### Rule: No Test, No Code

If an agent is implementing this plan and finds itself writing layout logic, rendering code, or UI behavior without a corresponding failing test already in place, it must **stop, write the test first, confirm it fails, and only then proceed.** This applies to bug fixes too — reproduce the bug as a failing test before touching the implementation.

---

## Core Parameters (shared between 2D and 3D views)

These are the user-controlled inputs that drive both views:

| Parameter             | Options                                           | Default       |
| --------------------- | ------------------------------------------------- | ------------- |
| **Lot configuration** | Single (25×125), Double (50×125), Corner (25×125) | Single        |
| **Staircase rule**    | Current code (2+ stairs) vs. Single stair reform  | Side-by-side  |
| **Number of stories** | 2, 3, 4                                           | 3             |
| **Ground floor use**  | Residential, Commercial/retail                    | Residential   |
| **Units per floor**   | Auto-calculated from lot + stair config           | —             |
| **Courtyard mode**    | Off, L-shape, U-shape                             | Off (Stage 2) |

When a parameter changes, both the 2D floor plan and 3D model update simultaneously.

---

## Stage 1: 2D Floor Plan Comparator

**Goal:** A polished, self-contained side-by-side floor plan comparison that could ship standalone and be immediately useful in meetings.

### 1.1 — Data Model & Layout Engine

Before drawing anything, define the spatial logic in pure JavaScript. This is the foundation everything else builds on.

**Lot geometry:**

- Single lot: 25ft wide × 125ft deep. Subtract 5ft combined side setbacks → 20ft buildable width. Front and rear setbacks per zoning (typically 15ft front, 30ft rear for residential) → ~80ft buildable depth.
- Double lot: 50ft × 125ft → 45ft buildable width, same depth.
- Corner lot: 25ft × 125ft but only one side setback (2.5ft) → 22.5ft buildable width, with windows allowed on the street-facing side wall.

**Staircase dimensions:**

- Interior staircase footprint: approximately 4ft × 10ft per stair (code minimum width 44", plus walls and landing).
- Hallway connecting two stairs: 5ft wide minimum, runs the depth of the building.
- Under current code for 3+ story buildings on a single lot: 3 staircases required (front, back, side gangway). On a double lot: 2 staircases with connecting hallway.
- Under single stair reform: 1 staircase per cluster of up to 4 units per floor.

**Unit layout logic:**

- Each floor is divided into units. On a single lot under current code: typically 2 units per floor (front/back), each ~20ft × 35ft minus staircase intrusions. Under single stair: same 2 units but larger because only 1 staircase consumes floor area.
- On a double lot under current code: 4 units per floor arranged around a central hallway connecting 2 staircases. Under single stair: 4 units per floor, no hallway, one central staircase, each unit gets a corner with two window walls.
- Calculate and store: unit dimensions, window wall count, livable square footage, bedroom estimate (rule of thumb: 1 BR per ~150sf of non-kitchen/bath space, capped by window walls).

**Output of this step:** A JSON-like structure describing each floor's layout:

```javascript
{
  lot: { width: 25, depth: 125, buildableWidth: 20, buildableDepth: 80 },
  floors: [
    {
      level: 1,
      units: [
        { id: 'A', x: 0, y: 0, w: 20, d: 38, sqft: 760, bedrooms: 2, windowWalls: ['north'], position: 'front' },
        { id: 'B', x: 0, y: 42, w: 20, d: 38, sqft: 760, bedrooms: 2, windowWalls: ['south'], position: 'rear' }
      ],
      staircases: [
        { x: 0, y: 0, w: 4, d: 10, type: 'interior' },
        { x: 16, y: 35, w: 4, d: 10, type: 'interior' },
        { x: 0, y: 70, w: 4, d: 10, type: 'gangway' }
      ],
      hallways: [],
      circulationSqft: 120,
      livableSqft: 1400
    }
  ]
}
```

**Key decision:** The layout engine doesn't need to be architecturally precise. It needs to be _directionally correct_ — showing the right proportions, the right number of stairs, and the right qualitative difference. Actual architects will refine the details; this tool makes the argument legible.

#### 1.1 TDD: Write These Tests FIRST (Red), Then Implement (Green)

Before writing any layout engine code, create every test below and confirm they all fail. Then implement `generateLayout(config)` until they pass.

**Lot geometry tests:**

```javascript
// RED: Write these. They must fail before any layout code exists.

// Buildable dimensions
const single = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
});
assertEqual(single.lot.width, 25, "Single lot width");
assertEqual(
  single.lot.buildableWidth,
  20,
  "Single lot buildable width (25 - 5ft setbacks)",
);
assertApprox(single.lot.buildableDepth, 80, 5, "Single lot buildable depth");

const double = generateLayout({
  lot: "double",
  stories: 3,
  stair: "current",
  ground: "residential",
});
assertEqual(
  double.lot.buildableWidth,
  45,
  "Double lot buildable width (50 - 5ft setbacks)",
);

const corner = generateLayout({
  lot: "corner",
  stories: 3,
  stair: "current",
  ground: "residential",
});
assertApprox(
  corner.lot.buildableWidth,
  22.5,
  1,
  "Corner lot buildable width (one fewer setback)",
);
```

**Staircase count tests — the core of the argument:**

```javascript
// Current code: floors 1-2 get 1 staircase, floor 3+ gets 3 (single lot) or 2 (double lot)
const curr_single_3 = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
});
assertEqual(
  curr_single_3.floors[0].staircases.length,
  1,
  "Single lot, current code, floor 1: 1 staircase",
);
assertEqual(
  curr_single_3.floors[2].staircases.length,
  3,
  "Single lot, current code, floor 3: 3 staircases",
);

const curr_double_3 = generateLayout({
  lot: "double",
  stories: 3,
  stair: "current",
  ground: "residential",
});
assertEqual(
  curr_double_3.floors[2].staircases.length,
  2,
  "Double lot, current code, floor 3: 2 staircases",
);
assertEqual(
  curr_double_3.floors[2].hallways.length,
  1,
  "Double lot, current code, floor 3: 1 connecting hallway",
);

// Single stair reform: always 1 staircase, no hallways
const reform_single_3 = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
  ground: "residential",
});
assertEqual(
  reform_single_3.floors[2].staircases.length,
  1,
  "Single lot, reform, floor 3: 1 staircase",
);
assertEqual(
  reform_single_3.floors[2].hallways.length,
  0,
  "Single lot, reform, floor 3: 0 hallways",
);

// 2-story buildings: no difference between current and reform (current already allows single stair)
const curr_single_2 = generateLayout({
  lot: "single",
  stories: 2,
  stair: "current",
  ground: "residential",
});
const reform_single_2 = generateLayout({
  lot: "single",
  stories: 2,
  stair: "reform",
  ground: "residential",
});
assertEqual(
  curr_single_2.floors[1].staircases.length,
  reform_single_2.floors[1].staircases.length,
  "2-story building: same staircase count under both codes",
);
```

**Area conservation — nothing appears or disappears:**

```javascript
// Total floor area must equal livable + circulation + staircase area (within rounding)
for (const floor of curr_single_3.floors) {
  const unitArea = floor.units.reduce((s, u) => s + u.sqft, 0);
  const stairArea = floor.staircases.reduce((s, st) => s + st.w * st.d, 0);
  const hallArea = floor.hallways.reduce((s, h) => s + h.w * h.d, 0);
  const totalBuildable =
    curr_single_3.lot.buildableWidth * curr_single_3.lot.buildableDepth;
  assertApprox(
    unitArea + stairArea + hallArea,
    totalBuildable,
    20,
    `Floor ${floor.level}: areas must sum to buildable area`,
  );
}
```

**The key comparative assertion — reform is always better or equal:**

```javascript
// For every lot type and story count, reform must produce >= livable area
for (const lot of ["single", "double", "corner"]) {
  for (const stories of [2, 3, 4]) {
    const curr = generateLayout({
      lot,
      stories,
      stair: "current",
      ground: "residential",
    });
    const reform = generateLayout({
      lot,
      stories,
      stair: "reform",
      ground: "residential",
    });
    for (let i = 0; i < stories; i++) {
      const currLivable = curr.floors[i].units.reduce((s, u) => s + u.sqft, 0);
      const reformLivable = reform.floors[i].units.reduce(
        (s, u) => s + u.sqft,
        0,
      );
      assert(
        reformLivable >= currLivable,
        `${lot} lot, ${stories} stories, floor ${i + 1}: reform livable (${reformLivable}) >= current (${currLivable})`,
      );
    }
  }
}
```

**Window wall tests:**

```javascript
// Reform should produce >= window walls per unit (fewer stairs blocking exterior walls)
const curr = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
});
const reform = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
  ground: "residential",
});
const currWindows = curr.floors[2].units.reduce(
  (s, u) => s + u.windowWalls.length,
  0,
);
const reformWindows = reform.floors[2].units.reduce(
  (s, u) => s + u.windowWalls.length,
  0,
);
assert(
  reformWindows >= currWindows,
  `Reform has >= window walls on floor 3: ${reformWindows} >= ${currWindows}`,
);

// Corner lot gets side windows
const cornerReform = generateLayout({
  lot: "corner",
  stories: 3,
  stair: "reform",
  ground: "residential",
});
const hasSideWindows = cornerReform.floors[0].units.some(
  (u) => u.windowWalls.includes("east") || u.windowWalls.includes("west"),
);
assert(
  hasSideWindows,
  "Corner lot has at least one unit with side window wall",
);
```

**Commercial ground floor:**

```javascript
const commercial = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
  ground: "commercial",
});
assertEqual(
  commercial.floors[0].units.length,
  1,
  "Commercial ground floor: 1 retail unit",
);
assertEqual(
  commercial.floors[0].units[0].type,
  "commercial",
  "Ground floor unit type is commercial",
);
assertEqual(
  commercial.floors[1].units[0].type,
  "residential",
  "Floor 2 is residential",
);
```

**No overlaps — units and staircases must not share space:**

```javascript
// Bounding box overlap check for all elements on each floor
function overlaps(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y
  );
}
for (const config of [curr_single_3, reform_single_3, curr_double_3]) {
  for (const floor of config.floors) {
    const allElements = [
      ...floor.units,
      ...floor.staircases,
      ...floor.hallways,
    ];
    for (let i = 0; i < allElements.length; i++) {
      for (let j = i + 1; j < allElements.length; j++) {
        assert(
          !overlaps(allElements[i], allElements[j]),
          `Floor ${floor.level}: elements ${i} and ${j} must not overlap`,
        );
      }
    }
  }
}
```

**GREEN: Only after ALL of the above tests exist and fail, begin implementing `generateLayout()`. Work test by test — pick one failing test, write the minimum code to pass it, run all tests, repeat.**

### 1.2 — 2D SVG Renderer

Render the layout engine's output as clean SVG floor plans. SVG because it's resolution-independent (crisp on any screen or when printed), interactive (hover/click events on elements), and can be styled with CSS.

**Visual language:**

| Element       | Color                                       | Style                                      |
| ------------- | ------------------------------------------- | ------------------------------------------ |
| Livable space | White/light fill                            | —                                          |
| Staircases    | Red (`#ef4444`)                             | Crosshatch or stair-step pattern           |
| Hallways      | Orange (`#f97316`)                          | Solid fill                                 |
| Walls         | Dark gray lines                             | 2px stroke                                 |
| Window walls  | Yellow (`#eab308`) highlight or dashed line | Glow effect on exterior walls with windows |
| Unit labels   | Inside each unit                            | "Unit A · 760 sf · 2 BR"                   |
| Lot boundary  | Light dashed line                           | Shows setbacks                             |

**Layout of the comparator:**

- Two floor plans side by side: left = "Current Code", right = "Single Stair Reform"
- Shared title bar above with the lot configuration and floor number
- Below each plan: summary stats card (total livable sf, units, avg bedrooms, window walls, % floor lost to circulation)
- A "delta" callout between them: "+18% livable space", "+4 window walls", "+2 bedrooms per floor"

**Floor selector:**

- If multi-story, show a vertical tab strip or numbered buttons (1, 2, 3, 4) to switch which floor is displayed.
- Ground floor differs if commercial ground floor is selected (show retail space instead of units).
- Floors 1–2 under current code only need 1 staircase (current code allows single stair up to 2nd floor), so the difference only appears on floor 3+. This is important to show — the comparator should highlight "floors 1–2: same under both codes" vs. "floors 3–4: dramatically different."

**Interactions:**

- Hover a unit → highlight it, show tooltip with detailed stats
- Hover a staircase → highlight in red, show "X sq ft consumed"
- Hover a window wall → highlight in yellow, show "natural light access"
- Toggle animation: a smooth morph between current code and single stair layouts, so users can _watch_ the hallways disappear and apartments expand. This is the money shot for presentations.

#### 1.2 TDD: SVG Render Tests (Red, Then Green)

These tests validate that the renderer produces correct SVG structure from layout engine output. Write all of them before writing any SVG generation code.

```javascript
// Render a known layout and parse the resulting SVG
const layout = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
});
const svg = renderFloorPlanSVG(layout, 2); // Floor 3 (0-indexed)

// Element count tests
const unitRects = svg.querySelectorAll('[data-type="unit"]');
assertEqual(
  unitRects.length,
  layout.floors[2].units.length,
  "SVG has one rect per unit",
);

const stairRects = svg.querySelectorAll('[data-type="staircase"]');
assertEqual(
  stairRects.length,
  layout.floors[2].staircases.length,
  "SVG has one rect per staircase",
);

// Color tests
stairRects.forEach((rect) => {
  assert(
    rect.getAttribute("fill").includes("ef4444") ||
      rect.classList.contains("staircase"),
    "Staircase rects are red",
  );
});

// Label tests
const labels = svg.querySelectorAll('[data-type="unit-label"]');
assertEqual(
  labels.length,
  layout.floors[2].units.length,
  "Each unit has a label",
);
assert(
  labels[0].textContent.includes("sf"),
  "Unit label includes square footage",
);
assert(
  labels[0].textContent.includes("BR"),
  "Unit label includes bedroom count",
);

// Window wall highlight tests
const windowWalls = svg.querySelectorAll('[data-type="window-wall"]');
const expectedWindowWalls = layout.floors[2].units.reduce(
  (s, u) => s + u.windowWalls.length,
  0,
);
assertEqual(
  windowWalls.length,
  expectedWindowWalls,
  "Correct number of window wall highlights",
);

// Scale test: SVG dimensions are proportional to lot dimensions
const svgWidth = parseFloat(svg.getAttribute("viewBox").split(" ")[2]);
const svgHeight = parseFloat(svg.getAttribute("viewBox").split(" ")[3]);
assertApprox(
  svgWidth / svgHeight,
  layout.lot.buildableWidth / layout.lot.buildableDepth,
  0.1,
  "SVG aspect ratio matches lot aspect ratio",
);

// Side-by-side comparator test
const comparatorEl = renderComparator(
  { lot: "single", stories: 3, ground: "residential" },
  2, // floor index
);
const plans = comparatorEl.querySelectorAll(".floor-plan");
assertEqual(plans.length, 2, "Comparator renders two floor plans");
assert(
  comparatorEl.querySelector(".plan-label-current"),
  "Left plan labeled Current Code",
);
assert(
  comparatorEl.querySelector(".plan-label-reform"),
  "Right plan labeled Single Stair Reform",
);
assert(
  comparatorEl.querySelector(".delta-callout"),
  "Delta callout exists between plans",
);
```

### 1.3 — Stats Dashboard

Below the floor plans, a summary section:

**Per-floor comparison table:**

|                  | Current Code | Single Stair | Difference |
| ---------------- | ------------ | ------------ | ---------- |
| Livable area     | 1,200 sf     | 1,420 sf     | +18%       |
| Units            | 2            | 2            | —          |
| Avg unit size    | 600 sf       | 710 sf       | +18%       |
| Bedrooms (est.)  | 4            | 6            | +50%       |
| Window walls     | 2            | 4            | +100%      |
| Staircases       | 3            | 1            | −2         |
| Circulation area | 360 sf       | 120 sf       | −67%       |

**Whole-building summary** (accounts for all floors):

|                            | Current Code     | Single Stair |
| -------------------------- | ---------------- | ------------ |
| Total units                | 6 (3 floors × 2) | 6            |
| Total bedrooms             | 12               | 18           |
| Avg unit size              | 600 sf           | 710 sf       |
| Total livable area         | 3,600 sf         | 4,260 sf     |
| Space lost to stairs/halls | 1,080 sf         | 360 sf       |

These stats directly support the "family-friendly apartments with more bedrooms and natural light" argument from the brief.

#### 1.3 TDD: Stats Calculation Tests (Red, Then Green)

The stats are derived from layout engine output. Write these tests before implementing `computeStats()`.

```javascript
// computeStats takes two layouts (current + reform) and returns comparison data
const curr = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
});
const reform = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
  ground: "residential",
});
const stats = computeStats(curr, reform);

// Structure tests
assert(stats.perFloor, "Stats include per-floor breakdown");
assert(stats.wholeBuilding, "Stats include whole-building summary");
assert(stats.deltas, "Stats include deltas");

// Per-floor math
const floor3stats = stats.perFloor[2]; // floor 3
assertEqual(
  floor3stats.current.units,
  curr.floors[2].units.length,
  "Current unit count matches layout",
);
assertEqual(
  floor3stats.reform.units,
  reform.floors[2].units.length,
  "Reform unit count matches layout",
);
assertApprox(
  floor3stats.current.livableArea,
  curr.floors[2].units.reduce((s, u) => s + u.sqft, 0),
  1,
  "Current livable area matches sum of unit sqft",
);

// Whole-building totals are sums across all floors
const expectedTotalCurrentUnits = curr.floors.reduce(
  (s, f) => s + f.units.length,
  0,
);
assertEqual(
  stats.wholeBuilding.current.totalUnits,
  expectedTotalCurrentUnits,
  "Whole-building current total units",
);

// Deltas must be mathematically correct
assertEqual(
  stats.deltas.livableArea,
  stats.wholeBuilding.reform.totalLivableArea -
    stats.wholeBuilding.current.totalLivableArea,
  "Delta livable area = reform - current",
);
assertApprox(
  stats.deltas.livableAreaPct,
  (stats.wholeBuilding.reform.totalLivableArea /
    stats.wholeBuilding.current.totalLivableArea -
    1) *
    100,
  0.1,
  "Delta percentage is correct",
);

// Deltas must be non-negative for standard configs (reform is never worse)
for (const lot of ["single", "double", "corner"]) {
  for (const stories of [3, 4]) {
    const c = generateLayout({
      lot,
      stories,
      stair: "current",
      ground: "residential",
    });
    const r = generateLayout({
      lot,
      stories,
      stair: "reform",
      ground: "residential",
    });
    const s = computeStats(c, r);
    assert(
      s.deltas.livableArea >= 0,
      `${lot}/${stories}story: reform livable >= current`,
    );
    assert(
      s.deltas.windowWalls >= 0,
      `${lot}/${stories}story: reform windows >= current`,
    );
    assert(
      s.deltas.bedrooms >= 0,
      `${lot}/${stories}story: reform bedrooms >= current`,
    );
  }
}

// 2-story building: deltas should be zero (no code difference)
const c2 = generateLayout({
  lot: "single",
  stories: 2,
  stair: "current",
  ground: "residential",
});
const r2 = generateLayout({
  lot: "single",
  stories: 2,
  stair: "reform",
  ground: "residential",
});
const s2 = computeStats(c2, r2);
assertEqual(
  s2.deltas.livableArea,
  0,
  "2-story building: zero livable area delta",
);
assertEqual(s2.deltas.staircases, 0, "2-story building: zero staircase delta");
```

### 1.4 — Polish & Responsiveness

- Responsive layout: on desktop, plans are side-by-side; on mobile, stacked vertically with a toggle between "Current" and "Reform"
- Print stylesheet: clean black-and-white version for handouts
- Screenshot-friendly: clean enough that a screenshot of the side-by-side can go directly into a tweet or slide deck
- Shareable URL with parameters encoded in the hash: `#lot=single&stories=3&ground=residential` so Alex can send specific configurations to aldermen
- Keyboard accessible: arrow keys to switch floors, tab between elements

#### 1.4 TDD: URL State & Integration Tests (Red, Then Green)

```javascript
// URL hash encoding/decoding roundtrip
const config = {
  lot: "double",
  stories: 4,
  stair: "reform",
  ground: "commercial",
};
const hash = encodeConfigToHash(config);
const decoded = decodeHashToConfig(hash);
assertEqual(decoded.lot, config.lot, "Roundtrip: lot");
assertEqual(decoded.stories, config.stories, "Roundtrip: stories");
assertEqual(decoded.stair, config.stair, "Roundtrip: stair");
assertEqual(decoded.ground, config.ground, "Roundtrip: ground");

// Defaults when hash is empty
const defaults = decodeHashToConfig("");
assertEqual(defaults.lot, "single", "Default lot is single");
assertEqual(defaults.stories, 3, "Default stories is 3");
assertEqual(
  defaults.stair,
  "current",
  "Default stair is current (show comparison)",
);
assertEqual(defaults.ground, "residential", "Default ground is residential");

// Invalid hash values fall back to defaults
const bad = decodeHashToConfig("#lot=mansion&stories=99");
assertEqual(bad.lot, "single", "Invalid lot falls back to single");
assertEqual(bad.stories, 4, "Stories capped at 4");
```

### 1.5 — Stage 1 Deliverable

A single HTML file (like the permits map) with:

- Control panel: lot type, stories, ground floor use, stair rule
- Side-by-side SVG floor plans with hover interactions
- Summary stats with delta callouts
- Responsive, printable, shareable via URL

**This alone is a complete, useful advocacy tool.** Everything after this is additive.

---

## Stage 2: 3D Building Explorer

**Goal:** Add a 3D tab that uses the same layout engine to render the full building, supporting Alex's goals of showing courtyard configurations and stackable floors.

### 2.1 — Three.js Scene Setup

Add Three.js (loaded from CDN, like Chart.js in the permits map). Create a tabbed interface: "Floor Plan" and "3D View" tabs, similar to the Map/Trends tabs in the permits explorer.

**Scene basics:**

- Dark background matching the STC brand or a neutral gray
- Orbit controls: click-drag to rotate, scroll to zoom, right-drag to pan
- Ambient + directional lighting for clean shadows
- Ground plane with a subtle grid showing lot boundaries and setbacks
- Camera starts at a 3/4 aerial angle (like an architectural rendering)

### 2.2 — Building Geometry from Layout Engine

Extrude the 2D floor plans into 3D boxes. Each floor becomes a slab:

```
For each floor in layout:
  For each unit:
    Create a box geometry (unit.w × floor_height × unit.d)
    Position at (unit.x, floor.level × floor_height, unit.y)
    Color by unit (alternating warm colors to distinguish adjacent units)

  For each staircase:
    Create a box (staircase.w × total_building_height × staircase.d)
    Color red, semi-transparent

  For each hallway:
    Create a box, color orange, semi-transparent

  Floor slab: thin box at each level, slight overhang, gray
```

**Floor height:** ~10ft per residential floor, ~14ft for commercial ground floor.

**Window walls:** On exterior faces that have windows, apply a different material — lighter color with subtle "window" texture or grid lines. Non-window exterior walls are solid/darker.

**Side-by-side in 3D:** Show both buildings (current code and reform) in the same scene, spaced apart with labels floating above each. The orbit controls keep them in sync so both rotate together.

#### 2.2 TDD: 3D Geometry Tests (Red, Then Green)

Before writing any Three.js code, write tests that validate the 3D geometry matches the layout engine. These tests operate on the mesh data, not the visual rendering.

```javascript
// buildMeshData takes a layout and returns an array of mesh descriptors
const layout = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
});
const meshes = buildMeshData(layout);

// Correct mesh count: units + staircases + hallways + floor slabs
const expectedMeshes = layout.floors.reduce(
  (s, f) => s + f.units.length + f.staircases.length + f.hallways.length + 1, // +1 for floor slab
  0,
);
assertEqual(meshes.length, expectedMeshes, "Correct number of meshes");

// Unit meshes have correct height
const FLOOR_HEIGHT = 10; // feet
const unitMeshes = meshes.filter((m) => m.type === "unit");
unitMeshes.forEach((m) => {
  assertEqual(m.height, FLOOR_HEIGHT, `Unit mesh height is ${FLOOR_HEIGHT}ft`);
});

// Staircase meshes span full building height
const BUILDING_HEIGHT = 3 * FLOOR_HEIGHT;
const stairMeshes = meshes.filter((m) => m.type === "staircase");
stairMeshes.forEach((m) => {
  assertEqual(
    m.height,
    BUILDING_HEIGHT,
    "Staircase mesh spans full building height",
  );
});

// Building bounding box matches lot dimensions
const allPositions = meshes.map((m) => ({
  minX: m.x,
  maxX: m.x + m.width,
  minZ: m.z,
  maxZ: m.z + m.depth,
}));
const bboxWidth =
  Math.max(...allPositions.map((p) => p.maxX)) -
  Math.min(...allPositions.map((p) => p.minX));
const bboxDepth =
  Math.max(...allPositions.map((p) => p.maxZ)) -
  Math.min(...allPositions.map((p) => p.minZ));
assertApprox(
  bboxWidth,
  layout.lot.buildableWidth,
  1,
  "3D bounding box width matches lot",
);
assertApprox(
  bboxDepth,
  layout.lot.buildableDepth,
  1,
  "3D bounding box depth matches lot",
);

// Y positions: each floor's meshes are at correct height
layout.floors.forEach((floor, i) => {
  const floorMeshes = meshes.filter((m) => m.floorLevel === i);
  floorMeshes
    .filter((m) => m.type === "unit")
    .forEach((m) => {
      assertApprox(
        m.y,
        i * FLOOR_HEIGHT,
        0.1,
        `Floor ${i + 1} units at correct Y`,
      );
    });
});

// Commercial ground floor has taller height
const commercial = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
  ground: "commercial",
});
const commMeshes = buildMeshData(commercial);
const groundUnits = commMeshes.filter(
  (m) => m.type === "unit" && m.floorLevel === 0,
);
groundUnits.forEach((m) => {
  assertEqual(m.height, 14, "Commercial ground floor is 14ft tall");
});
```

#### 2.3 TDD: Floor Stacking Tests

```javascript
// Adding/removing a floor produces correct mesh count delta
const layout3 = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
  ground: "residential",
});
const layout4 = generateLayout({
  lot: "single",
  stories: 4,
  stair: "reform",
  ground: "residential",
});
const meshes3 = buildMeshData(layout3);
const meshes4 = buildMeshData(layout4);

const floor4meshes = meshes4.filter((m) => m.floorLevel === 3);
assert(floor4meshes.length > 0, "Adding 4th floor produces new meshes");
assertEqual(
  meshes4.length,
  meshes3.length + floor4meshes.length,
  "4-story mesh count = 3-story + new floor meshes",
);

// Total building height changes
const maxY3 = Math.max(...meshes3.map((m) => m.y + m.height));
const maxY4 = Math.max(...meshes4.map((m) => m.y + m.height));
assertApprox(
  maxY4 - maxY3,
  FLOOR_HEIGHT,
  1,
  "Adding floor increases height by one floor",
);
```

### 2.3 — Interactive Floor Stacking

This is Alex's goal #3 — "make the floors stackable."

**Controls:**

- A vertical slider or +/− buttons for number of stories (2, 3, 4)
- When adding a floor, animate it sliding down from above into place
- When removing, animate it lifting off and fading
- A toggle for "commercial ground floor" that swaps the first floor's geometry and color (retail = blue/teal, larger open floor plate, no unit subdivisions)

**The animation is key for presentations.** Being able to say "now watch what happens when we add a third floor" and having the staircase situation visibly change is more persuasive than any static image.

### 2.4 — Courtyard Mode

Alex's goal #2 — "show how 2–3 single stair clusters form L-shaped or U-shaped courtyards."

**Implementation:**

Add a "Courtyard" control with options: Off, L-shape, U-shape, S-shape (matching Exhibit D from the brief).

When activated:

- The scene shows multiple building segments arranged around a central courtyard
- Each segment is a single-stair cluster (one staircase serving up to 4 units per floor)
- The courtyard is rendered as an open green/landscaped area at ground level
- Camera pulls back to show the full complex

**L-shape:** Two segments at a 90° angle. One faces the street, one runs along the side lot line. Courtyard in the interior corner.

**U-shape:** Three segments forming a U. Front segment faces the street, two side segments run back. Courtyard opens to the rear or to the street.

**Key visual:** In the 3D view, highlight how each apartment has windows facing _into_ the courtyard (light + air) rather than staring at a hallway wall. The courtyard itself should feel inviting — maybe a subtle tree or green plane to suggest landscaping.

#### 2.4 TDD: Courtyard Layout Tests (Red, Then Green)

Courtyard mode is the most complex layout. Write these before implementing `generateCourtyardLayout()`.

```javascript
// L-shape: 2 segments, each a single-stair cluster
const lShape = generateCourtyardLayout({
  shape: "L",
  stories: 3,
  ground: "residential",
});
assertEqual(lShape.segments.length, 2, "L-shape has 2 building segments");
lShape.segments.forEach((seg) => {
  assertEqual(
    seg.floors[0].staircases.length,
    1,
    "Each L-shape segment has 1 staircase",
  );
  assert(seg.floors[0].units.length <= 4, "Max 4 units per floor per cluster");
});

// U-shape: 3 segments
const uShape = generateCourtyardLayout({
  shape: "U",
  stories: 3,
  ground: "residential",
});
assertEqual(uShape.segments.length, 3, "U-shape has 3 building segments");

// Courtyard exists and is open space
assert(lShape.courtyard, "L-shape has a courtyard area");
assert(lShape.courtyard.area > 0, "Courtyard has positive area");

// No segment overlaps the courtyard
lShape.segments.forEach((seg, i) => {
  const segBBox = getSegmentBoundingBox(seg);
  assert(
    !overlaps2D(segBBox, lShape.courtyard.bounds),
    `Segment ${i} does not overlap courtyard`,
  );
});

// No segments overlap each other
for (let i = 0; i < lShape.segments.length; i++) {
  for (let j = i + 1; j < lShape.segments.length; j++) {
    assert(
      !overlaps2D(
        getSegmentBoundingBox(lShape.segments[i]),
        getSegmentBoundingBox(lShape.segments[j]),
      ),
      `Segments ${i} and ${j} do not overlap`,
    );
  }
}

// Courtyard-facing units have window walls toward courtyard
lShape.segments.forEach((seg) => {
  const courtyardFacingUnits = seg.floors[0].units.filter((u) =>
    u.windowWalls.includes("courtyard"),
  );
  assert(
    courtyardFacingUnits.length > 0,
    "At least one unit per segment faces courtyard",
  );
});

// Compare courtyard to non-courtyard: same lot area, courtyard has more total window walls
const noCourtyard = generateLayout({
  lot: "double",
  stories: 3,
  stair: "reform",
  ground: "residential",
});
const lShapeWindows = lShape.segments.reduce(
  (s, seg) =>
    s +
    seg.floors.reduce(
      (fs, f) => fs + f.units.reduce((us, u) => us + u.windowWalls.length, 0),
      0,
    ),
  0,
);
const noCourtyardWindows = noCourtyard.floors.reduce(
  (s, f) => s + f.units.reduce((us, u) => us + u.windowWalls.length, 0),
  0,
);
assert(
  lShapeWindows > noCourtyardWindows,
  "Courtyard configuration has more total window walls than block configuration",
);
```

**Contrast:** Show the same lot with current code — the courtyard gets consumed by hallways connecting the two required staircases, or the building can't wrap around the courtyard at all because the hallway geometry doesn't work. This is Exhibit F from the brief, now in 3D.

### 2.5 — Annotation & Storytelling Layer

For meeting use, add a "guided tour" mode:

1. **"Here's a typical Chicago lot"** — camera shows the empty lot with dimensions
2. **"Under current code, you need 3 staircases"** — staircases appear in red, one by one
3. **"That leaves this much space for apartments"** — units fill in, stats appear
4. **"With single stair reform"** — staircases animate away (2 disappear), apartments expand, window highlights appear
5. **"And you can combine them into courtyards"** — camera pulls back, adjacent segments appear, courtyard forms

Each step triggered by clicking "Next" or pressing the right arrow key. This is a presentation tool Alex can walk CFD through in real time.

### 2.6 — STL Export (Bonus)

Since Alex mentioned 3D printing:

- Add an "Export STL" button that converts the current Three.js geometry to STL format
- Use a client-side library like `three-stl-exporter`
- The exported file can be sent directly to a 3D printer
- Each floor as a separate STL if Alex wants physically stackable pieces

This is low-priority but nearly free to add once the 3D geometry exists.

### 2.7 — Stage 2 Deliverable

Same HTML file, now with two tabs:

- **Floor Plan** tab (Stage 1, unchanged)
- **3D View** tab with orbit controls, stackable floors, courtyard mode, guided tour, and optional STL export

---

## Stage 3: Enhancements (Post-Launch)

### 3.1 — Real Address Lookup

Enter a Chicago address → the tool fetches the actual lot dimensions, zoning classification, and current building from the city's GIS APIs. It auto-configures the parameters (lot type, max allowed stories, max units from MLA) and shows "here's what could be built on THIS lot." Useful for developers and for ward-specific conversations.

**Data sources:**

- Zoning: `https://data.cityofchicago.org/Community-Economic-Development/Boundaries-Zoning-Districts/p8va-airx`
- Parcels: Cook County GIS
- Current buildings: Chicago building footprints dataset

### 3.2 — Ward Impact Overlay

Connect to the permits explorer. For a given ward, count how many parcels are:

- Zoned RM-4.5 or above (eligible for multi-unit)
- Currently underbuilt relative to zoning capacity
- On standard lots (25×125 or similar)

Estimate the additional units that single stair reform would unlock. "Ward 47 has 342 standard lots zoned for 5+ units that are currently underbuilt. Single stair reform could enable approximately 400–600 additional apartments."

### 3.3 — Fire Safety Data Integration

Pull Chicago fire incident data and show outcomes in sprinklered vs. non-sprinklered residential buildings. Directly addresses CFD concerns with empirical evidence from their own city.

### 3.4 — Peer City Comparison

Interactive timeline/table showing Seattle, Austin, NYC, Honolulu — when they adopted single stair, what their parameters are (height cap, sprinkler requirement, units-per-floor cap), and any available housing production data before/after. Positions Chicago's proposed ordinance within the landscape of precedent.

---

## Technical Decisions

| Decision             | Choice                                      | Rationale                                                                                                                                 |
| -------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**        | Vanilla JS, single HTML file                | Same as permits map. No build step, easy to host/share, works offline.                                                                    |
| **2D rendering**     | SVG (inline, generated via JS)              | Resolution-independent, interactive, printable, CSS-stylable. Canvas would work but SVG is better for floor plans with discrete elements. |
| **3D rendering**     | Three.js r128 (CDN)                         | Already available in the Claude artifact environment. Lightweight, well-documented.                                                       |
| **Charts**           | Chart.js (CDN)                              | For stats comparisons if needed. Already a known dependency.                                                                              |
| **Fonts**            | DM Sans + JetBrains Mono                    | Consistent with permits explorer brand.                                                                                                   |
| **Color palette**    | Same dark theme as permits map              | Consistency, and dark backgrounds make architectural diagrams pop.                                                                        |
| **State management** | URL hash parameters                         | Enables sharing specific configurations. `#lot=double&stories=4&stair=reform&courtyard=L`                                                 |
| **Testing**          | Custom assert helpers, no framework         | Runs in browser or Node. Zero dependencies. Tests live in `tests.js`, runner in `test-runner.html`.                                       |
| **Responsive**       | CSS media queries, stacked layout on mobile | Must work on a phone for quick sharing, but primary use is laptop in meetings.                                                            |

---

## Estimated Effort

| Stage | Scope                                 | TDD Step                                                                                                                                                              | Estimated Complexity       |
| ----- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1.1a  | Layout engine **tests**               | 🔴 RED: Write all layout invariant, staircase count, area conservation, comparison, window wall, overlap, and commercial ground floor tests. Run them. All must fail. | Medium                     |
| 1.1b  | Layout engine **implementation**      | 🟢 GREEN: Implement `generateLayout()` one test at a time until all pass. Then refactor.                                                                              | Medium-High                |
| 1.2a  | SVG renderer **tests**                | 🔴 RED: Write element count, color, label, window wall, aspect ratio, and comparator structure tests. All must fail.                                                  | Low-Medium                 |
| 1.2b  | SVG renderer **implementation**       | 🟢 GREEN: Implement `renderFloorPlanSVG()` and `renderComparator()`.                                                                                                  | Medium                     |
| 1.3a  | Stats dashboard **tests**             | 🔴 RED: Write stats structure, per-floor math, whole-building totals, delta correctness, non-negativity, and 2-story zero-delta tests. All must fail.                 | Low                        |
| 1.3b  | Stats dashboard **implementation**    | 🟢 GREEN: Implement `computeStats()`.                                                                                                                                 | Low                        |
| 1.4a  | URL state **tests**                   | 🔴 RED: Write roundtrip, defaults, and invalid-input tests.                                                                                                           | Low                        |
| 1.4b  | URL state + polish **implementation** | 🟢 GREEN: Implement hash encode/decode, responsive CSS, print styles.                                                                                                 | Low-Medium                 |
| 1.5   | **Stage 1 complete**                  | All tests green. Run full suite. Ship.                                                                                                                                | **Usable advocacy tool**   |
| 2.1   | Three.js setup                        | No new tests (boilerplate).                                                                                                                                           | Low                        |
| 2.2a  | 3D geometry **tests**                 | 🔴 RED: Write mesh count, height, bounding box, Y-position, commercial height tests.                                                                                  | Low-Medium                 |
| 2.2b  | 3D geometry **implementation**        | 🟢 GREEN: Implement `buildMeshData()` and Three.js rendering.                                                                                                         | Medium                     |
| 2.3a  | Floor stacking **tests**              | 🔴 RED: Write mesh count delta and building height tests.                                                                                                             | Low                        |
| 2.3b  | Floor stacking **implementation**     | 🟢 GREEN: Implement add/remove floor animation.                                                                                                                       | Low-Medium                 |
| 2.4a  | Courtyard **tests**                   | 🔴 RED: Write segment count, staircase-per-segment, courtyard area, no-overlap, courtyard-facing windows, and courtyard-vs-block window comparison tests.             | Medium                     |
| 2.4b  | Courtyard **implementation**          | 🟢 GREEN: Implement `generateCourtyardLayout()` and courtyard rendering.                                                                                              | Medium                     |
| 2.5   | Guided tour                           | Low-medium — step sequencer with camera animations.                                                                                                                   | Low-Medium                 |
| 2.6   | STL export                            | Low — library integration.                                                                                                                                            | Low                        |
| 2.7   | **Stage 2 complete**                  | All tests green. Run full suite. Ship.                                                                                                                                | **Full presentation tool** |
| 3.x   | Enhancements                          | Follow same red/green cycle for each feature.                                                                                                                         | Variable                   |

---

## Development Sequence (Mandatory)

This is the exact order an agent must follow. No skipping ahead.

```
STAGE 1:

  Step 1 — Create test infrastructure
    - Create tests.js with assert helpers
    - Create an HTML test runner that loads tests.js and reports results
    - Verify the runner works (0 passed, 0 failed)

  Step 2 — Layout engine (RED)
    - Write ALL 1.1 tests from the plan into tests.js
    - Run tests → all fail (generateLayout is not defined)
    - Commit: "red: layout engine tests"

  Step 3 — Layout engine (GREEN)
    - Implement generateLayout() in layout.js
    - Work one test group at a time:
        lot geometry → staircase counts → area conservation →
        comparisons → window walls → commercial → overlaps
    - After each group passes, run FULL suite to check for regressions
    - Commit after each group: "green: lot geometry tests passing", etc.
    - REFACTOR only when all tests pass

  Step 4 — SVG renderer (RED)
    - Write ALL 1.2 tests
    - Run → all fail
    - Commit: "red: SVG renderer tests"

  Step 5 — SVG renderer (GREEN)
    - Implement renderFloorPlanSVG() and renderComparator()
    - Commit when all 1.2 tests pass + no 1.1 regressions

  Step 6 — Stats (RED then GREEN)
    - Write 1.3 tests → fail → implement computeStats() → pass
    - Commit

  Step 7 — URL state (RED then GREEN)
    - Write 1.4 tests → fail → implement → pass
    - Commit

  Step 8 — Integration & polish
    - Wire everything into single HTML file
    - Add CSS, responsive styles, print stylesheet
    - Run FULL test suite — must be 100% green
    - Manual visual QA in browser
    - Commit: "stage 1 complete"

STAGE 2:

  Step 9 — 3D geometry (RED then GREEN)
    - Write 2.2 tests → fail → implement buildMeshData() → pass

  Step 10 — Floor stacking (RED then GREEN)
    - Write 2.3 tests → fail → implement → pass

  Step 11 — Courtyard (RED then GREEN)
    - Write 2.4 tests → fail → implement generateCourtyardLayout() → pass

  Step 12 — Guided tour + STL export
    - Implement (lighter TDD — these are UI/animation features)
    - Run FULL suite — must be 100% green

  Step 13 — Integration
    - Wire 3D view into tabbed interface alongside floor plan
    - Run FULL suite
    - Manual visual QA
    - Commit: "stage 2 complete"
```

### Critical Rules for the Agent

1. **Never write implementation code without a failing test.** If you catch yourself writing `generateLayout()` before the layout tests exist, stop. Write the tests first.

2. **Never skip the red step.** The test must actually fail before you implement. If you write a test and it passes immediately, the test is wrong — it's not testing what you think, or the behavior already exists.

3. **Run the full suite after every change.** Not just the tests for the current feature — ALL tests. A green test from Step 3 that goes red in Step 5 means you introduced a regression.

4. **Commit at each red→green transition.** This creates a clean history where you can bisect if something breaks later. Label commits clearly: `red: courtyard layout tests` → `green: courtyard layout passing`.

5. **Refactor only when green.** Never restructure code while tests are failing. Get to green first, then clean up, then confirm still green.

6. **Bugs get tests first.** If a user reports "the corner lot window wall count is wrong," write a test that asserts the correct count, confirm it fails (reproducing the bug), then fix it and confirm it passes. This is how the regression suite grows organically.

---

## Key Risks

1. **Architectural accuracy.** The layouts won't be to code. Mitigation: label everything as "illustrative" and have AIA Chicago review before public release. The tool shows _proportional differences_, not construction documents.

2. **Lot variation.** Real Chicago lots vary — some are 24ft, some 26ft, setbacks differ by zoning. Mitigation: the defaults cover the most common case (25×125 standard lot), and the layout engine can be extended to accept custom dimensions.

3. **Scope creep into Stage 2 before Stage 1 ships.** Mitigation: Stage 1 is defined as a complete deliverable. Ship it, get feedback from Alex and the 47th Ward, then build Stage 2 based on what they actually need for their next meeting.

4. **CFD dismissing it as "just a cartoon."** Mitigation: the stats underneath are real (square footage math is straightforward), and the tool links to the actual code sections and Exhibit G ordinance language. The visualization makes the math legible, not fictional.

5. **Tests passing but visuals wrong.** TDD validates the data model, not the aesthetics. A floor plan can be mathematically correct but visually misleading (e.g., elements too small to read, colors ambiguous). Mitigation: treat visual QA as a manual gate at the end of each stage — after all tests are green, eyeball the output in-browser and on a phone. File visual bugs as new failing tests before fixing.
