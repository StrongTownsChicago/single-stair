// Single Stair Visualizer — Test Suite
// Minimal assertion framework, no dependencies

// Load source files when running in Node
if (typeof require !== "undefined") {
  const _layout = require("./layout.js");
  if (_layout.generateLayout) globalThis.generateLayout = _layout.generateLayout;
  try {
    const _renderer = require("./renderer.js");
    if (_renderer.renderFloorPlanSVG) globalThis.renderFloorPlanSVG = _renderer.renderFloorPlanSVG;
    if (_renderer.renderComparator) globalThis.renderComparator = _renderer.renderComparator;
    if (_renderer.renderCourtyardSVG) globalThis.renderCourtyardSVG = _renderer.renderCourtyardSVG;
  } catch (e) {}
  try {
    const _stats = require("./stats.js");
    if (_stats.computeStats) globalThis.computeStats = _stats.computeStats;
  } catch (e) {}
  try {
    const _state = require("./state.js");
    if (_state.encodeConfigToHash) globalThis.encodeConfigToHash = _state.encodeConfigToHash;
    if (_state.decodeHashToConfig) globalThis.decodeHashToConfig = _state.decodeHashToConfig;
  } catch (e) {}
  try {
    const _mesh = require("./mesh.js");
    if (_mesh.buildMeshData) globalThis.buildMeshData = _mesh.buildMeshData;
  } catch (e) {}
  try {
    const _courtyard = require("./courtyard.js");
    if (_courtyard.generateCourtyardLayout) globalThis.generateCourtyardLayout = _courtyard.generateCourtyardLayout;
  } catch (e) {}
}

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

// Helper used by overlap tests
function overlaps(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y
  );
}

// =============================================================
// 1.1 — Layout Engine Tests (RED)
// =============================================================

// --- Lot Geometry Tests ---

console.log("=== Lot Geometry Tests ===");

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

// --- Staircase Count Tests ---

console.log("=== Staircase Count Tests ===");

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

// 2-story buildings: no difference between current and reform
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

// --- Area Conservation Tests ---

console.log("=== Area Conservation Tests ===");

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

// --- Comparative Assertions (reform >= current) ---

console.log("=== Comparative Assertions ===");

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

// --- Window Wall Tests ---

console.log("=== Window Wall Tests ===");

// Reform should produce >= window walls per unit
const currWin = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
});
const reformWin = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
  ground: "residential",
});
const currWindows = currWin.floors[2].units.reduce(
  (s, u) => s + u.windowWalls.length,
  0,
);
const reformWindows = reformWin.floors[2].units.reduce(
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

// --- Commercial Ground Floor Tests ---

console.log("=== Commercial Ground Floor Tests ===");

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

// --- No Overlaps Tests ---

console.log("=== No Overlaps Tests ===");

// Bounding box overlap check for all elements on each floor
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

// =============================================================
// 1.2 — SVG Renderer Tests (RED)
// =============================================================

console.log("=== SVG Renderer Tests ===");

// Helper: count occurrences of a data-type attribute in SVG string
function countDataType(svgStr, type) {
  const regex = new RegExp(`data-type="${type}"`, "g");
  return (svgStr.match(regex) || []).length;
}

// Render a known layout and check the resulting SVG string
const svgLayout = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
});
const svgStr = renderFloorPlanSVG(svgLayout, 2); // Floor 3 (0-indexed)

// Element count tests
const unitRectCount = countDataType(svgStr, "unit");
assertEqual(
  unitRectCount,
  svgLayout.floors[2].units.length,
  "SVG has one rect per unit",
);

const stairRectCount = countDataType(svgStr, "staircase");
assertEqual(
  stairRectCount,
  svgLayout.floors[2].staircases.length,
  "SVG has one rect per staircase",
);

// Color tests: staircase rects should reference red color or staircase class
const stairMatches = svgStr.match(/data-type="staircase"[^>]*/g) || [];
stairMatches.forEach((match, i) => {
  assert(
    match.includes("ef4444") || match.includes("staircase"),
    `Staircase rect ${i} is red or has staircase class`,
  );
});

// Label tests
const labelCount = countDataType(svgStr, "unit-label");
assertEqual(
  labelCount,
  svgLayout.floors[2].units.length,
  "Each unit has a label",
);
assert(svgStr.includes("sf"), "Unit label includes square footage");
assert(svgStr.includes("BR"), "Unit label includes bedroom count");

// Window wall highlight tests
const windowWallCount = countDataType(svgStr, "window-wall");
const expectedWindowWalls = svgLayout.floors[2].units.reduce(
  (s, u) => s + u.windowWalls.length,
  0,
);
assertEqual(
  windowWallCount,
  expectedWindowWalls,
  "Correct number of window wall highlights",
);

// Scale test: SVG viewBox aspect ratio matches lot aspect ratio
const viewBoxMatch = svgStr.match(/viewBox="([^"]+)"/);
assert(viewBoxMatch, "SVG has a viewBox attribute");
if (viewBoxMatch) {
  const parts = viewBoxMatch[1].split(" ").map(Number);
  const svgWidth = parts[2];
  const svgHeight = parts[3];
  assertApprox(
    svgWidth / svgHeight,
    svgLayout.lot.buildableWidth / svgLayout.lot.buildableDepth,
    0.1,
    "SVG aspect ratio matches lot aspect ratio",
  );
}

// Side-by-side comparator test
const comparatorStr = renderComparator(
  { lot: "single", stories: 3, ground: "residential" },
  2, // floor index
);
const planCount = (comparatorStr.match(/class="floor-plan"/g) || []).length;
assertEqual(planCount, 2, "Comparator renders two floor plans");
assert(
  comparatorStr.includes("plan-label-current"),
  "Left plan labeled Current Code",
);
assert(
  comparatorStr.includes("plan-label-reform"),
  "Right plan labeled Single Stair Reform",
);
assert(
  comparatorStr.includes("delta-callout"),
  "Delta callout exists between plans",
);

// =============================================================
// 1.3 — Stats Dashboard Tests (RED)
// =============================================================

console.log("=== Stats Dashboard Tests ===");

// computeStats takes two layouts (current + reform) and returns comparison data
const statsCurr = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
});
const statsReform = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
  ground: "residential",
});
const stats = computeStats(statsCurr, statsReform);

// Structure tests
assert(stats.perFloor, "Stats include per-floor breakdown");
assert(stats.wholeBuilding, "Stats include whole-building summary");
assert(stats.deltas, "Stats include deltas");

// Per-floor math
const floor3stats = stats.perFloor[2]; // floor 3
assertEqual(
  floor3stats.current.units,
  statsCurr.floors[2].units.length,
  "Current unit count matches layout",
);
assertEqual(
  floor3stats.reform.units,
  statsReform.floors[2].units.length,
  "Reform unit count matches layout",
);
assertApprox(
  floor3stats.current.livableArea,
  statsCurr.floors[2].units.reduce((s, u) => s + u.sqft, 0),
  1,
  "Current livable area matches sum of unit sqft",
);

// Whole-building totals are sums across all floors
const expectedTotalCurrentUnits = statsCurr.floors.reduce(
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

// =============================================================
// 1.4 — URL State Tests (RED)
// =============================================================

console.log("=== URL State Tests ===");

// URL hash encoding/decoding roundtrip
const urlConfig = {
  lot: "double",
  stories: 4,
  stair: "reform",
  ground: "commercial",
};
const hash = encodeConfigToHash(urlConfig);
const decoded = decodeHashToConfig(hash);
assertEqual(decoded.lot, urlConfig.lot, "Roundtrip: lot");
assertEqual(decoded.stories, urlConfig.stories, "Roundtrip: stories");
assertEqual(decoded.stair, urlConfig.stair, "Roundtrip: stair");
assertEqual(decoded.ground, urlConfig.ground, "Roundtrip: ground");

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

// =============================================================
// 2.2 — 3D Geometry Tests (RED)
// =============================================================

console.log("=== 3D Geometry Tests ===");

const FLOOR_HEIGHT = 10; // feet

// buildMeshData takes a layout and returns an array of mesh descriptors
const meshLayout = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
});
const meshes = buildMeshData(meshLayout);

// Correct mesh count: units + staircases + hallways + floor slabs
const expectedMeshes = meshLayout.floors.reduce(
  (s, f) => s + f.units.length + f.staircases.length + f.hallways.length + 1, // +1 for floor slab
  0,
);
assertEqual(meshes.length, expectedMeshes, "Correct number of meshes");

// Unit meshes have correct height
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
  meshLayout.lot.buildableWidth,
  1,
  "3D bounding box width matches lot",
);
assertApprox(
  bboxDepth,
  meshLayout.lot.buildableDepth,
  1,
  "3D bounding box depth matches lot",
);

// Y positions: each floor's meshes are at correct height
meshLayout.floors.forEach((floor, i) => {
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
const commLayout = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
  ground: "commercial",
});
const commMeshes = buildMeshData(commLayout);
const groundUnits = commMeshes.filter(
  (m) => m.type === "unit" && m.floorLevel === 0,
);
groundUnits.forEach((m) => {
  assertEqual(m.height, 14, "Commercial ground floor is 14ft tall");
});

// =============================================================
// 2.3 — Floor Stacking Tests (RED)
// =============================================================

console.log("=== Floor Stacking Tests ===");

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

// =============================================================
// 2.4 — Courtyard Layout Tests (RED)
// =============================================================

console.log("=== Courtyard Layout Tests ===");

// Helper for 2D bounding box overlap
function overlaps2D(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y
  );
}
function getSegmentBoundingBox(seg) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const floor of seg.floors) {
    for (const u of floor.units) {
      minX = Math.min(minX, u.x);
      minY = Math.min(minY, u.y);
      maxX = Math.max(maxX, u.x + u.w);
      maxY = Math.max(maxY, u.y + u.d);
    }
    for (const st of floor.staircases) {
      minX = Math.min(minX, st.x);
      minY = Math.min(minY, st.y);
      maxX = Math.max(maxX, st.x + st.w);
      maxY = Math.max(maxY, st.y + st.d);
    }
  }
  return { x: minX, y: minY, w: maxX - minX, d: maxY - minY };
}

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

// Compare courtyard to non-courtyard: courtyard has more total window walls
const noCourtyardLayout = generateLayout({
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
const noCourtyardWindows = noCourtyardLayout.floors.reduce(
  (s, f) => s + f.units.reduce((us, u) => us + u.windowWalls.length, 0),
  0,
);
assert(
  lShapeWindows > noCourtyardWindows,
  "Courtyard configuration has more total window walls than block configuration",
);

// =============================================================
// 3.1 — Multi-Stair Hallway Tests (RED → GREEN with layout.js changes)
// =============================================================

console.log("=== Multi-Stair Hallway Tests ===");

// Single lot, current code, floor 3: should have hallway elements
const multiStairLayout = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
});
const msFloor3 = multiStairLayout.floors[2];

assert(
  msFloor3.hallways.length > 0,
  "Single lot, current code, floor 3: has hallway elements connecting stairs",
);

// Circulation column should be wider for 3-stair floors than 1-stair floors
const reformLayout = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
  ground: "residential",
});
const refFloor3 = reformLayout.floors[2];

// Get circulation width from staircase x + w (the right edge of the circulation column)
const msCircRight = Math.max(
  ...msFloor3.staircases.map((s) => s.x + s.w),
  ...msFloor3.hallways.map((h) => h.x + h.w),
);
const refCircRight = Math.max(
  ...refFloor3.staircases.map((s) => s.x + s.w),
);
assert(
  msCircRight > refCircRight,
  `3-stair circulation column (${msCircRight}ft) wider than 1-stair (${refCircRight}ft)`,
);

// Stairs distributed front/center/rear
const stairYs = msFloor3.staircases.map((s) => s.y).sort((a, b) => a - b);
assertEqual(stairYs.length, 3, "Floor 3 has exactly 3 staircases");
assertApprox(stairYs[0], 0, 1, "First staircase at front (y ≈ 0)");
const bd = multiStairLayout.lot.buildableDepth;
assertApprox(
  stairYs[1],
  35,
  5,
  "Second staircase near center",
);
assertApprox(
  stairYs[2],
  bd - 10,
  1,
  "Third staircase at rear",
);

// Single lot floor 3 delta >= 15% (the dramatic delta assertion)
const currF3Livable = msFloor3.units.reduce((s, u) => s + u.sqft, 0);
const refF3Livable = refFloor3.units.reduce((s, u) => s + u.sqft, 0);
const deltaPctF3 = ((refF3Livable - currF3Livable) / currF3Livable) * 100;
assert(
  deltaPctF3 >= 15,
  `Single lot floor 3 delta is ${deltaPctF3.toFixed(1)}% — must be >= 15%`,
);

// Corner lot floor 3 should also have hallways and wider circulation
const cornerMultiStair = generateLayout({
  lot: "corner",
  stories: 3,
  stair: "current",
  ground: "residential",
});
const cornerF3 = cornerMultiStair.floors[2];
assert(
  cornerF3.hallways.length > 0,
  "Corner lot, current code, floor 3: has hallway elements",
);

// Area conservation still holds with wider circulation
const msUnitArea = msFloor3.units.reduce((s, u) => s + u.sqft, 0);
const msStairArea = msFloor3.staircases.reduce((s, st) => s + st.w * st.d, 0);
const msHallArea = msFloor3.hallways.reduce((s, h) => s + h.w * h.d, 0);
const msTotalBuildable = multiStairLayout.lot.buildableWidth * multiStairLayout.lot.buildableDepth;
assertApprox(
  msUnitArea + msStairArea + msHallArea,
  msTotalBuildable,
  20,
  "Multi-stair floor 3: areas sum to buildable area",
);

// No overlaps on multi-stair floor
const msAllElements = [...msFloor3.units, ...msFloor3.staircases, ...msFloor3.hallways];
for (let i = 0; i < msAllElements.length; i++) {
  for (let j = i + 1; j < msAllElements.length; j++) {
    assert(
      !overlaps(msAllElements[i], msAllElements[j]),
      `Multi-stair floor 3: elements ${i} and ${j} must not overlap`,
    );
  }
}

// =============================================================
// 3.2 — Courtyard SVG Renderer Tests (RED → GREEN with renderer.js changes)
// =============================================================

console.log("=== Courtyard SVG Renderer Tests ===");

const cyLayout = generateCourtyardLayout({
  shape: "L",
  stories: 3,
  ground: "residential",
});
const cySvg = renderCourtyardSVG(cyLayout, 1); // floor 2 (0-indexed)

// SVG is produced
assert(cySvg.includes("<svg"), "renderCourtyardSVG produces SVG element");

// Contains courtyard rect
assert(
  cySvg.includes('data-type="courtyard"'),
  "Courtyard SVG has courtyard rect",
);

// Contains correct number of unit rects (2 segments × 2 units each for L-shape)
const cyUnitCount = countDataType(cySvg, "unit");
const expectedCyUnits = cyLayout.segments.reduce(
  (s, seg) => s + seg.floors[1].units.length,
  0,
);
assertEqual(
  cyUnitCount,
  expectedCyUnits,
  `Courtyard SVG has ${expectedCyUnits} unit rects`,
);

// Contains staircase rects (1 per segment)
const cyStairCount = countDataType(cySvg, "staircase");
const expectedCyStairs = cyLayout.segments.reduce(
  (s, seg) => s + seg.floors[1].staircases.length,
  0,
);
assertEqual(
  cyStairCount,
  expectedCyStairs,
  `Courtyard SVG has ${expectedCyStairs} staircase rects`,
);

// =============================================================
// 3.3 — URL State buildingType Tests (RED → GREEN with state.js changes)
// =============================================================

console.log("=== URL State buildingType Tests ===");

// Roundtrip for buildingType
const btConfig = {
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
  buildingType: "L",
};
const btHash = encodeConfigToHash(btConfig);
const btDecoded = decodeHashToConfig(btHash);
assertEqual(btDecoded.buildingType, "L", "Roundtrip: buildingType L");

// Default buildingType
const btDefaults = decodeHashToConfig("");
assertEqual(btDefaults.buildingType, "standard", "Default buildingType is standard");

// Invalid buildingType falls back
const btBad = decodeHashToConfig("#building=X");
assertEqual(btBad.buildingType, "standard", "Invalid buildingType falls back to standard");

// =============================================================

summary();
