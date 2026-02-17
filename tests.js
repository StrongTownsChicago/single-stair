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
  try {
    const _tour = require("./tour.js");
    if (_tour.createTourSteps) globalThis.createTourSteps = _tour.createTourSteps;
    if (_tour.createTourState) globalThis.createTourState = _tour.createTourState;
    if (_tour.advanceTour) globalThis.advanceTour = _tour.advanceTour;
    if (_tour.easeInOutCubic) globalThis.easeInOutCubic = _tour.easeInOutCubic;
  } catch (e) {}
  try {
    const _viewer = require("./viewer3d.js");
    if (_viewer.MATERIAL_COLORS) globalThis.MATERIAL_COLORS = _viewer.MATERIAL_COLORS;
    if (_viewer.buildCourtyardSegmentMeshes) globalThis.buildCourtyardSegmentMeshes = _viewer.buildCourtyardSegmentMeshes;
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

// Current code: 3+ story buildings get multiple stairs on ALL floors (stairs run full height)
const curr_single_3 = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
});
assertEqual(
  curr_single_3.floors[0].staircases.length,
  3,
  "Single lot, current code, 3-story, floor 1: 3 staircases (stairs run full height)",
);
assertEqual(
  curr_single_3.floors[1].staircases.length,
  3,
  "Single lot, current code, 3-story, floor 2: 3 staircases (stairs run full height)",
);
assertEqual(
  curr_single_3.floors[2].staircases.length,
  3,
  "Single lot, current code, 3-story, floor 3: 3 staircases",
);

const curr_double_3 = generateLayout({
  lot: "double",
  stories: 3,
  stair: "current",
  ground: "residential",
});
assertEqual(
  curr_double_3.floors[0].staircases.length,
  2,
  "Double lot, current code, 3-story, floor 1: 2 staircases (stairs run full height)",
);
assertEqual(
  curr_double_3.floors[2].staircases.length,
  2,
  "Double lot, current code, 3-story, floor 3: 2 staircases",
);
assertEqual(
  curr_double_3.floors[0].hallways.length,
  1,
  "Double lot, current code, 3-story, floor 1: 1 connecting hallway",
);
assertEqual(
  curr_double_3.floors[2].hallways.length,
  1,
  "Double lot, current code, 3-story, floor 3: 1 connecting hallway",
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
// 3.1b — Building-Level Stair Consistency Tests
// =============================================================

console.log("=== Building-Level Stair Consistency Tests ===");

// All floors of a 3+ story building must have the same stair count
for (const lot of ["single", "double", "corner"]) {
  for (const stories of [3, 4]) {
    const layout = generateLayout({ lot, stories, stair: "current", ground: "residential" });
    const floorStairCounts = layout.floors.map(f => f.staircases.length);
    const allSame = floorStairCounts.every(c => c === floorStairCounts[0]);
    assert(allSame, `${lot}/${stories}story: all floors have same stair count (${floorStairCounts.join(',')})`);
  }
}

// All floors of a 3+ story building must have the same hallway count
for (const lot of ["single", "double", "corner"]) {
  for (const stories of [3, 4]) {
    const layout = generateLayout({ lot, stories, stair: "current", ground: "residential" });
    const floorHallCounts = layout.floors.map(f => f.hallways.length);
    const allSame = floorHallCounts.every(c => c === floorHallCounts[0]);
    assert(allSame, `${lot}/${stories}story: all floors have same hallway count (${floorHallCounts.join(',')})`);
  }
}

// Floor 1 layout should match floor 3 layout on 3-story single lot
const msFloor1 = multiStairLayout.floors[0];
assertEqual(
  msFloor1.staircases.length,
  msFloor3.staircases.length,
  "3-story single lot: floor 1 stair count matches floor 3",
);
assertEqual(
  msFloor1.hallways.length,
  msFloor3.hallways.length,
  "3-story single lot: floor 1 hallway count matches floor 3",
);
assertApprox(
  msFloor1.livableSqft,
  msFloor3.livableSqft,
  1,
  "3-story single lot: floor 1 livable area matches floor 3",
);

// 2-story buildings still get 1 stair on all floors
const curr2story = generateLayout({ lot: "single", stories: 2, stair: "current", ground: "residential" });
assertEqual(curr2story.floors[0].staircases.length, 1, "2-story single lot, floor 1: 1 staircase");
assertEqual(curr2story.floors[1].staircases.length, 1, "2-story single lot, floor 2: 1 staircase");
assertEqual(curr2story.floors[0].hallways.length, 0, "2-story single lot, floor 1: 0 hallways");

// Reform always gets 1 stair regardless of building height
for (const stories of [2, 3, 4]) {
  const ref = generateLayout({ lot: "single", stories, stair: "reform", ground: "residential" });
  for (let i = 0; i < stories; i++) {
    assertEqual(ref.floors[i].staircases.length, 1, `Reform ${stories}story floor ${i+1}: 1 staircase`);
    assertEqual(ref.floors[i].hallways.length, 0, `Reform ${stories}story floor ${i+1}: 0 hallways`);
  }
}

// Commercial ground floor still gets 1 staircase even in 3+ story buildings
const commCurr3 = generateLayout({ lot: "single", stories: 3, stair: "current", ground: "commercial" });
assertEqual(commCurr3.floors[0].staircases.length, 1, "Commercial ground floor: 1 staircase (stair shaft exists but retail wraps around)");
assertEqual(commCurr3.floors[1].staircases.length, 3, "Commercial 3-story, floor 2: 3 staircases");
assertEqual(commCurr3.floors[2].staircases.length, 3, "Commercial 3-story, floor 3: 3 staircases");

// Delta is now impactful on every floor of a 3+ story building (not just floor 3+)
for (const lot of ["single", "corner"]) {
  const c = generateLayout({ lot, stories: 3, stair: "current", ground: "residential" });
  const r = generateLayout({ lot, stories: 3, stair: "reform", ground: "residential" });
  for (let i = 0; i < 3; i++) {
    const cLiv = c.floors[i].units.reduce((s, u) => s + u.sqft, 0);
    const rLiv = r.floors[i].units.reduce((s, u) => s + u.sqft, 0);
    const deltaPct = ((rLiv - cLiv) / cLiv) * 100;
    assert(
      deltaPct >= 15,
      `${lot} 3-story floor ${i+1}: reform delta ${deltaPct.toFixed(1)}% >= 15%`,
    );
  }
}

// No overlaps on floor 1 of multi-stair layout
const msF1AllElements = [...msFloor1.units, ...msFloor1.staircases, ...msFloor1.hallways];
for (let i = 0; i < msF1AllElements.length; i++) {
  for (let j = i + 1; j < msF1AllElements.length; j++) {
    assert(
      !overlaps(msF1AllElements[i], msF1AllElements[j]),
      `Multi-stair floor 1: elements ${i} and ${j} must not overlap`,
    );
  }
}

// Area conservation on floor 1 of multi-stair layout
const msF1UnitArea = msFloor1.units.reduce((s, u) => s + u.sqft, 0);
const msF1StairArea = msFloor1.staircases.reduce((s, st) => s + st.w * st.d, 0);
const msF1HallArea = msFloor1.hallways.reduce((s, h) => s + h.w * h.d, 0);
assertApprox(
  msF1UnitArea + msF1StairArea + msF1HallArea,
  msTotalBuildable,
  20,
  "Multi-stair floor 1: areas sum to buildable area",
);

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
// 4.1 — 3D Scene Construction Tests
// =============================================================

console.log("=== 3D Scene Construction Tests ===");

// Staircase deduplication for rendering
const dedup3Layout = generateLayout({ lot: "single", stories: 3, stair: "current", ground: "residential" });
const dedup3Meshes = buildMeshData(dedup3Layout);
const allStairs3 = dedup3Meshes.filter(m => m.type === "staircase");
assertEqual(allStairs3.length, 9, "Raw mesh data has 9 staircase meshes (3 per floor x 3 floors)");
const dedupedStairs3 = allStairs3.filter(m => m.floorLevel === 0);
assertEqual(dedupedStairs3.length, 3, "Deduped: 3 unique staircase meshes");
dedupedStairs3.forEach(m => {
  assertEqual(m.y, 0, "Deduped staircase starts at y=0");
  assertEqual(m.height, 30, "Deduped staircase spans full 3-story height (30ft)");
});

// Reform has fewer meshes after deduplication
const reformDedupLayout = generateLayout({ lot: "single", stories: 3, stair: "reform", ground: "residential" });
const reformDedupMeshes = buildMeshData(reformDedupLayout);
const reformDedupStairs = reformDedupMeshes.filter(m => m.type === "staircase" && m.floorLevel === 0);
const reformDedupHalls = reformDedupMeshes.filter(m => m.type === "hallway");
assertEqual(reformDedupStairs.length, 1, "Reform deduped: 1 staircase mesh");
assertEqual(reformDedupHalls.length, 0, "Reform: 0 hallway meshes");

// Material color mapping validation
const materialTypes = ["unit", "staircase", "hallway", "slab", "commercial"];
const expectedColors = {
  unit: 0xF0EBE1,
  staircase: 0xBF5B4B,
  hallway: 0xC4B5A5,
  slab: 0xCCC7BF,
  commercial: 0x4FA393,
};
materialTypes.forEach(type => {
  assertEqual(MATERIAL_COLORS[type], expectedColors[type], `MATERIAL_COLORS.${type} is correct`);
});

// Commercial unit type detection
const commSceneLayout = generateLayout({ lot: "single", stories: 3, stair: "reform", ground: "commercial" });
const commSceneMeshes = buildMeshData(commSceneLayout);
const commUnitMeshes = commSceneMeshes.filter(m => m.type === "unit" && m.unitType === "commercial");
assert(commUnitMeshes.length > 0, "Commercial layout has commercial-type unit meshes");
commUnitMeshes.forEach(m => {
  assertEqual(m.unitType, "commercial", "Commercial unit mesh has unitType 'commercial'");
});

// Side-by-side positioning math
const ssConfig = { lot: "single", stories: 3, ground: "residential" };
const ssCurrentLayout = generateLayout({ ...ssConfig, stair: "current" });
const ssBw = ssCurrentLayout.lot.buildableWidth;
const ssGap = ssBw * 1.5;
const ssCurrentCenterX = -(ssBw / 2 + ssGap / 2);
const ssReformCenterX = ssBw / 2 + ssGap / 2;
assert(ssCurrentCenterX < 0, "Current code building center is at negative X");
assert(ssReformCenterX > 0, "Reform building center is at positive X");
assertApprox(Math.abs(ssCurrentCenterX), Math.abs(ssReformCenterX), 0.001, "Buildings equidistant from center");

// Courtyard mode detection
const cyBuildingType = "L";
const isCyMode = cyBuildingType === "L" || cyBuildingType === "U";
assert(isCyMode, "L-shape triggers courtyard mode");
const notCyMode = "standard" === "L" || "standard" === "U";
assert(!notCyMode, "Standard does not trigger courtyard mode");

// Window wall data presence
const wwLayout = generateLayout({ lot: "single", stories: 3, stair: "reform", ground: "residential" });
const wwMeshData = buildMeshData(wwLayout);
const wwUnitMeshes = wwMeshData.filter(m => m.type === "unit");
wwUnitMeshes.forEach(m => {
  assert(Array.isArray(m.windowWalls), `Unit mesh has windowWalls array`);
  assert(m.windowWalls.length > 0, `Unit mesh has at least one window wall`);
});

// Front units should have 'north' window wall
const wwFrontUnits = wwUnitMeshes.filter(m => m.unitId === "A");
wwFrontUnits.forEach(m => {
  assert(m.windowWalls.includes("north"), "Front unit has north window wall");
});

// =============================================================
// 4.2 — Tour Step Tests
// =============================================================

console.log("=== Tour Step Tests ===");

// Standard config: at least 5 steps
const tourConfig3 = { lot: "single", stories: 3, ground: "residential", buildingType: "standard" };
const tourSteps3 = createTourSteps(tourConfig3);
assert(tourSteps3.length >= 5, `Tour has ${tourSteps3.length} steps (expected >= 5)`);

// Each step has required fields
const requiredTourFields = ["id", "title", "description", "cameraPosition", "cameraTarget"];
tourSteps3.forEach((step, i) => {
  requiredTourFields.forEach(field => {
    assert(step[field] !== undefined, `Tour step ${i} (${step.id}) has field '${field}'`);
  });
  assert(typeof step.cameraPosition.x === "number", `Step ${step.id}: cameraPosition.x is a number`);
  assert(typeof step.cameraPosition.y === "number", `Step ${step.id}: cameraPosition.y is a number`);
  assert(typeof step.cameraPosition.z === "number", `Step ${step.id}: cameraPosition.z is a number`);
  assert(typeof step.cameraTarget.x === "number", `Step ${step.id}: cameraTarget.x is a number`);
  assert(typeof step.cameraTarget.y === "number", `Step ${step.id}: cameraTarget.y is a number`);
  assert(typeof step.cameraTarget.z === "number", `Step ${step.id}: cameraTarget.z is a number`);
});

// Courtyard step only in L/U mode
const tourStdSteps = createTourSteps({ lot: "single", stories: 3, ground: "residential", buildingType: "standard" });
const tourLSteps = createTourSteps({ lot: "single", stories: 3, ground: "residential", buildingType: "L" });
const stdHasCourtyard = tourStdSteps.some(s => s.id === "courtyard");
const lHasCourtyard = tourLSteps.some(s => s.id === "courtyard");
assert(!stdHasCourtyard, "Standard config tour does not have courtyard step");
assert(lHasCourtyard, "L-shape config tour has courtyard step");

// 2-story building: fewer or different comparison steps
const tourSteps2 = createTourSteps({ lot: "single", stories: 2, ground: "residential", buildingType: "standard" });
assert(tourSteps2.length >= 3, `2-story tour has ${tourSteps2.length} steps (expected >= 3)`);
const compStep2 = tourSteps2.find(s => s.id === "comparison");
if (compStep2) {
  assert(
    compStep2.description.includes("2-story") || compStep2.description.includes("same") || compStep2.description.includes("3+"),
    "2-story comparison step acknowledges no difference"
  );
}

// Camera positions scale with lot size
const tourSingleSteps = createTourSteps({ lot: "single", stories: 3, ground: "residential", buildingType: "standard" });
const tourDoubleSteps = createTourSteps({ lot: "double", stories: 3, ground: "residential", buildingType: "standard" });
const singleAerial = tourSingleSteps.find(s => s.id === "lot" || s.id === "comparison");
const doubleAerial = tourDoubleSteps.find(s => s.id === "lot" || s.id === "comparison");
if (singleAerial && doubleAerial) {
  const singleDist = Math.sqrt(singleAerial.cameraPosition.x ** 2 + singleAerial.cameraPosition.y ** 2 + singleAerial.cameraPosition.z ** 2);
  const doubleDist = Math.sqrt(doubleAerial.cameraPosition.x ** 2 + doubleAerial.cameraPosition.y ** 2 + doubleAerial.cameraPosition.z ** 2);
  assert(doubleDist > singleDist, "Double lot tour has farther camera distance than single lot");
}

// Tour state management
const tState = createTourState();
assertEqual(tState.active, false, "Initial tour state is inactive");
assertEqual(tState.currentStep, 0, "Initial step is 0");

// Advance tour
tState.steps = tourSteps3;
tState.active = true;
advanceTour(tState, 1);
assertEqual(tState.currentStep, 1, "Tour advances to step 1");
advanceTour(tState, -1);
assertEqual(tState.currentStep, 0, "Tour retreats to step 0");
advanceTour(tState, -1);
assertEqual(tState.currentStep, 0, "Tour does not go below 0");

// Easing function
assertApprox(easeInOutCubic(0), 0, 0.001, "Ease at t=0 is 0");
assertApprox(easeInOutCubic(0.5), 0.5, 0.001, "Ease at t=0.5 is 0.5");
assertApprox(easeInOutCubic(1), 1, 0.001, "Ease at t=1 is 1");

// =============================================================
// 4.4 — Integration Tests (Config -> Layout -> Mesh -> 3D roundtrip)
// =============================================================

console.log("=== 3D Integration Tests ===");

// Complete data flow validation
const intLayout = generateLayout({ lot: "single", stories: 3, stair: "current", ground: "residential" });
const intMeshData = buildMeshData(intLayout);

for (let i = 0; i < intLayout.floors.length; i++) {
  const floor = intLayout.floors[i];
  const floorMeshes = intMeshData.filter(m => m.floorLevel === i);
  const unitMeshes = floorMeshes.filter(m => m.type === "unit");
  assertEqual(unitMeshes.length, floor.units.length, `Floor ${i + 1}: unit mesh count matches layout`);
  const stairMeshes = floorMeshes.filter(m => m.type === "staircase");
  assertEqual(stairMeshes.length, floor.staircases.length, `Floor ${i + 1}: staircase mesh count matches layout`);
  const hallMeshes = floorMeshes.filter(m => m.type === "hallway");
  assertEqual(hallMeshes.length, floor.hallways.length, `Floor ${i + 1}: hallway mesh count matches layout`);
  const slabMesh = floorMeshes.find(m => m.type === "slab");
  assert(slabMesh, `Floor ${i + 1}: has a slab mesh`);
}

// Different configs produce different mesh counts
const intConfigs = [
  { lot: "single", stories: 2, stair: "reform", ground: "residential" },
  { lot: "single", stories: 3, stair: "current", ground: "residential" },
  { lot: "double", stories: 3, stair: "current", ground: "residential" },
  { lot: "single", stories: 3, stair: "reform", ground: "commercial" },
];
const intMeshCounts = intConfigs.map(c => {
  const layout = generateLayout(c);
  return buildMeshData(layout).length;
});
const intUniqueCounts = new Set(intMeshCounts);
assert(intUniqueCounts.size > 1, "Different configs produce different mesh counts");

// Courtyard mesh building covers all segments
const intCyLayout = generateCourtyardLayout({ shape: "U", stories: 3, ground: "residential" });
for (let s = 0; s < intCyLayout.segments.length; s++) {
  const seg = intCyLayout.segments[s];
  assertEqual(seg.floors.length, 3, `U-shape segment ${s}: has 3 floors`);
  assert(seg.floors[0].units.length > 0, `U-shape segment ${s}: has units on floor 1`);
  assert(seg.floors[0].staircases.length > 0, `U-shape segment ${s}: has staircases on floor 1`);
}

// Courtyard segment mesh builder produces meshes
const intCySeg = intCyLayout.segments[0];
const intCySegMeshes = buildCourtyardSegmentMeshes(intCySeg, 3, "residential");
assert(intCySegMeshes.length > 0, "Courtyard segment mesh builder produces meshes");
const intCySegUnits = intCySegMeshes.filter(m => m.type === "unit");
assert(intCySegUnits.length > 0, "Courtyard segment has unit meshes");
const intCySegStairs = intCySegMeshes.filter(m => m.type === "staircase");
assert(intCySegStairs.length > 0, "Courtyard segment has staircase meshes");
const intCySegSlabs = intCySegMeshes.filter(m => m.type === "slab");
assertEqual(intCySegSlabs.length, 3, "Courtyard segment has 1 slab per floor");

// =============================================================

summary();
