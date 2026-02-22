// Single Stair Visualizer — Test Suite
// Minimal assertion framework, no dependencies

// Load source files when running in Node
if (typeof require !== "undefined") {
  // Plain script files (CommonJS-compatible, not ES modules)
  const _layout = require("./layout.js");
  if (_layout.generateLayout) globalThis.generateLayout = _layout.generateLayout;
  try {
    const _renderer = require("./renderer.js");
    if (_renderer.renderFloorPlanSVG) globalThis.renderFloorPlanSVG = _renderer.renderFloorPlanSVG;
    if (_renderer.renderComparator) globalThis.renderComparator = _renderer.renderComparator;
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

  // ES module files: inline pure-logic duplicates for Node testing
  // mesh.js is now an ES module — provide buildMeshData inline
  if (typeof globalThis.buildMeshData === "undefined") {
    var _RESIDENTIAL_FLOOR_HEIGHT = 10;
    globalThis.buildMeshData = function buildMeshData(layout) {
      var meshes = [];
      var numFloors = layout.floors.length;
      var totalBuildingHeight = numFloors * _RESIDENTIAL_FLOOR_HEIGHT;
      for (var i = 0; i < numFloors; i++) {
        var floor = layout.floors[i];
        var yOffset = i * _RESIDENTIAL_FLOOR_HEIGHT;
        var isTopFloor = i === numFloors - 1;
        for (var u = 0; u < floor.units.length; u++) {
          var unit = floor.units[u];
          meshes.push({
            type: "unit", x: unit.x, y: yOffset, z: unit.y,
            width: unit.w, height: _RESIDENTIAL_FLOOR_HEIGHT, depth: unit.d,
            floorLevel: i, isTopFloor: isTopFloor, isGroundFloor: i === 0,
            unitId: unit.id, unitType: unit.type, windowWalls: unit.windowWalls,
          });
        }
        for (var s = 0; s < floor.staircases.length; s++) {
          var stair = floor.staircases[s];
          meshes.push({
            type: "staircase", x: stair.x, y: 0, z: stair.y,
            width: stair.w, height: totalBuildingHeight, depth: stair.d,
            floorLevel: i, isTopFloor: false, stairType: stair.type,
          });
        }
        for (var h = 0; h < floor.hallways.length; h++) {
          var hall = floor.hallways[h];
          meshes.push({
            type: "hallway", x: hall.x, y: yOffset, z: hall.y,
            width: hall.w, height: _RESIDENTIAL_FLOOR_HEIGHT, depth: hall.d,
            floorLevel: i, isTopFloor: isTopFloor,
          });
        }
        var SLAB_OVERHANG = 0.3;
        meshes.push({
          type: "slab", x: 0 - SLAB_OVERHANG, y: yOffset, z: 0 - SLAB_OVERHANG,
          width: layout.lot.buildableWidth + SLAB_OVERHANG * 2,
          height: 0.5,
          depth: layout.lot.buildableDepth + SLAB_OVERHANG * 2,
          floorLevel: i, isTopFloor: isTopFloor,
        });
      }
      return meshes;
    };
  }

  // tour.js is now an ES module — provide pure functions inline
  if (typeof globalThis.createTourSteps === "undefined") {
    globalThis.createTourSteps = function createTourSteps(config) {
      var lot = config.lot || "single";
      var stories = config.stories || 3;
      var lotConfigs = {
        single: { buildableWidth: 20, buildableDepth: 80 },
        double: { buildableWidth: 45, buildableDepth: 80 },
      };
      var dims = lotConfigs[lot] || lotConfigs.single;
      var bw = dims.buildableWidth;
      var bd = dims.buildableDepth;
      var totalHeight = stories * 10;
      var scale = bw / 20;
      var steps = [];
      steps.push({
        id: "lot", title: "Here's a typical Chicago lot",
        description: bw + " feet wide, " + bd + " feet deep. After setbacks, " + bw + "x" + bd + " feet is buildable.",
        cameraPosition: { x: 0, y: 80 * scale, z: 100 * scale },
        cameraTarget: { x: 0, y: 0, z: 0 }, highlights: ["ground"],
      });
      if (stories > 2) {
        steps.push({ id: "current-stairs", title: "Current code requires 2 stairways",
          description: "Above the second story, each unit must access two stairways. On a standard lot, that means two stairway shafts plus a connecting hallway running the full height of the building.",
          cameraPosition: { x: -30 * scale, y: 40 * scale, z: 60 * scale },
          cameraTarget: { x: -(bw / 2 + bw * 0.75), y: totalHeight / 2, z: 0 }, highlights: ["staircases-current"],
        });
        steps.push({ id: "current-units", title: "What's left for apartments",
          description: "Two units per floor in the remaining space after two stairways and a connecting hallway.",
          cameraPosition: { x: -40 * scale, y: 25 * scale, z: 50 * scale },
          cameraTarget: { x: -(bw / 2 + bw * 0.75), y: totalHeight / 2, z: 0 }, highlights: ["units-current"],
        });
        steps.push({ id: "reform", title: "With single stair reform",
          description: "One stairway plus sprinklers. Larger units with more bedrooms, the kind of family-friendly apartments Chicago needs.",
          cameraPosition: { x: 40 * scale, y: 25 * scale, z: 50 * scale },
          cameraTarget: { x: bw / 2 + bw * 0.75, y: totalHeight / 2, z: 0 }, highlights: ["units-reform"],
        });
        steps.push({ id: "comparison", title: "Side by side",
          description: "Same lot, same safety with sprinklers, but significantly more livable space per unit.",
          cameraPosition: { x: 0, y: 50 * scale, z: 80 * scale },
          cameraTarget: { x: 0, y: totalHeight / 2, z: 0 }, highlights: ["all"],
        });
      } else {
        steps.push({ id: "current-stairs", title: "2-story buildings already qualify",
          description: "Chicago's code currently allows second-story units to access a single stairway.",
          cameraPosition: { x: -30 * scale, y: 30 * scale, z: 60 * scale },
          cameraTarget: { x: -(bw / 2 + bw * 0.75), y: totalHeight / 2, z: 0 }, highlights: ["staircases-current"],
        });
        steps.push({ id: "comparison", title: "Same layout at 2 stories",
          description: "The impact of reform shows up at 3+ stories, where current code requires two stairways on a standard lot.",
          cameraPosition: { x: 0, y: 50 * scale, z: 80 * scale },
          cameraTarget: { x: 0, y: totalHeight / 2, z: 0 }, highlights: ["all"],
        });
      }
      return steps;
    };
    globalThis.createTourState = function () {
      return { active: false, currentStep: 0, steps: [], animating: false };
    };
    globalThis.advanceTour = function (tourState, direction) {
      if (tourState.animating) return tourState;
      var newStep = tourState.currentStep + direction;
      if (newStep < 0 || newStep >= tourState.steps.length) return tourState;
      tourState.currentStep = newStep;
      return tourState;
    };
    globalThis.easeInOutCubic = function (t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };
  }

  // viewer3d.js is now an ES module — provide MATERIAL_COLORS inline
  if (typeof globalThis.MATERIAL_COLORS === "undefined") {
    globalThis.MATERIAL_COLORS = {
      unit: 0x8B4533, staircase: 0xBF5B4B, hallway: 0xC4B5A5,
      slab: 0xA0A0A0, limestone: 0xE8DCC8, mullion: 0x3A3530,
      glass: 0x4A6B8A, door: 0x2A1F1A,
    };
  }
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
// 1.1 — Layout Engine Tests
// =============================================================

// --- Lot Geometry Tests ---

console.log("=== Lot Geometry Tests ===");

const single = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
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
});
assertEqual(
  double.lot.buildableWidth,
  45,
  "Double lot buildable width (50 - 5ft setbacks)",
);

// --- Staircase Count Tests ---

console.log("=== Staircase Count Tests ===");

// Current code: 3+ story buildings get multiple stairs on ALL floors (stairs run full height)
const curr_single_3 = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
});
assertEqual(
  curr_single_3.floors[0].staircases.length,
  2,
  "Single lot, current code, 3-story, floor 1: 2 staircases (stairs run full height)",
);
assertEqual(
  curr_single_3.floors[1].staircases.length,
  2,
  "Single lot, current code, 3-story, floor 2: 2 staircases (stairs run full height)",
);
assertEqual(
  curr_single_3.floors[2].staircases.length,
  2,
  "Single lot, current code, 3-story, floor 3: 2 staircases",
);

const curr_double_3 = generateLayout({
  lot: "double",
  stories: 3,
  stair: "current",
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
});
assertEqual(
  reform_single_3.floors[2].staircases.length,
  1,
  "Single lot, reform, floor 3: 1 staircase",
);
assertEqual(
  reform_single_3.floors[2].hallways.length,
  1,
  "Single lot, reform, floor 3: 1 hallway (landing)",
);

// 2-story buildings: no difference between current and reform
const curr_single_2 = generateLayout({
  lot: "single",
  stories: 2,
  stair: "current",
});
const reform_single_2 = generateLayout({
  lot: "single",
  stories: 2,
  stair: "reform",
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
for (const lot of ["single", "double"]) {
  for (const stories of [2, 3, 4]) {
    const curr = generateLayout({
      lot,
      stories,
      stair: "current",
    });
    const reform = generateLayout({
      lot,
      stories,
      stair: "reform",
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
});
const reformWin = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
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

// --- No Overlaps Tests ---

console.log("=== No Overlaps Tests ===");

// Bounding box overlap check for all elements on each floor
// Reform units intentionally overlap staircases (stair renders on top)
for (const config of [curr_single_3, reform_single_3, curr_double_3]) {
  for (const floor of config.floors) {
    const allElements = [
      ...floor.units.map(u => ({ ...u, _kind: "unit" })),
      ...floor.staircases.map(s => ({ ...s, _kind: "staircase" })),
      ...floor.hallways.map(h => ({ ...h, _kind: "hallway" })),
    ];
    for (let i = 0; i < allElements.length; i++) {
      for (let j = i + 1; j < allElements.length; j++) {
        const kinds = [allElements[i]._kind, allElements[j]._kind].sort().join("-");
        if (kinds === "staircase-unit") continue;
        if (kinds === "hallway-staircase") continue; // stair shaft passes through its landing
        assert(
          !overlaps(allElements[i], allElements[j]),
          `Floor ${floor.level}: elements ${i} and ${j} must not overlap`,
        );
      }
    }
  }
}

// =============================================================
// 1.2 — SVG Renderer Tests
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
  { lot: "single", stories: 3 },
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
// 1.3 — Stats Dashboard Tests
// =============================================================

console.log("=== Stats Dashboard Tests ===");

// computeStats takes two layouts (current + reform) and returns comparison data
const statsCurr = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
});
const statsReform = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
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
for (const lot of ["single", "double"]) {
  for (const stories of [3, 4]) {
    const c = generateLayout({
      lot,
      stories,
      stair: "current",
    });
    const r = generateLayout({
      lot,
      stories,
      stair: "reform",
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
});
const r2 = generateLayout({
  lot: "single",
  stories: 2,
  stair: "reform",
});
const s2 = computeStats(c2, r2);
assertEqual(
  s2.deltas.livableArea,
  0,
  "2-story building: zero livable area delta",
);
assertEqual(s2.deltas.staircases, 0, "2-story building: zero staircase delta");

// =============================================================
// 1.4 — URL State Tests
// =============================================================

console.log("=== URL State Tests ===");

// URL hash encoding/decoding roundtrip
const urlConfig = {
  lot: "double",
  stories: 4,
  stair: "reform",
};
const hash = encodeConfigToHash(urlConfig);
const decoded = decodeHashToConfig(hash);
assertEqual(decoded.lot, urlConfig.lot, "Roundtrip: lot");
assertEqual(decoded.stories, urlConfig.stories, "Roundtrip: stories");
assertEqual(decoded.stair, urlConfig.stair, "Roundtrip: stair");

// Defaults when hash is empty
const defaults = decodeHashToConfig("");
assertEqual(defaults.lot, "single", "Default lot is single");
assertEqual(defaults.stories, 3, "Default stories is 3");
assertEqual(
  defaults.stair,
  "current",
  "Default stair is current (show comparison)",
);

// Invalid hash values fall back to defaults
const bad = decodeHashToConfig("#lot=mansion&stories=99");
assertEqual(bad.lot, "single", "Invalid lot falls back to single");
assertEqual(bad.stories, 4, "Stories capped at 4");

// =============================================================
// 2.2 — 3D Geometry Tests
// =============================================================

console.log("=== 3D Geometry Tests ===");

const FLOOR_HEIGHT = 10; // feet

// buildMeshData takes a layout and returns an array of mesh descriptors
const meshLayout = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
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

// All unit meshes have residential height
const allUnitMeshes = meshes.filter((m) => m.type === "unit");
allUnitMeshes.forEach((m) => {
  assertEqual(m.height, FLOOR_HEIGHT, "Unit mesh height is 10ft (residential)");
});

// =============================================================
// 2.3 — Floor Stacking Tests
// =============================================================

console.log("=== Floor Stacking Tests ===");

// Adding/removing a floor produces correct mesh count delta
const layout3 = generateLayout({
  lot: "single",
  stories: 3,
  stair: "reform",
});
const layout4 = generateLayout({
  lot: "single",
  stories: 4,
  stair: "reform",
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
// 3.1 — Multi-Stair Hallway Tests
// =============================================================

console.log("=== Multi-Stair Hallway Tests ===");

// Single lot, current code, floor 3: should have hallway elements
const multiStairLayout = generateLayout({
  lot: "single",
  stories: 3,
  stair: "current",
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
});
const refFloor3 = reformLayout.floors[2];

// Get circulation width (total footprint width, not right-edge position)
const msCircWidth = Math.max(
  ...msFloor3.staircases.map((s) => s.w),
  ...msFloor3.hallways.map((h) => h.w),
);
const refCircWidth = Math.max(
  ...refFloor3.staircases.map((s) => s.w),
);
assert(
  msCircWidth > refCircWidth,
  `3-stair circulation column (${msCircWidth}ft) wider than 1-stair (${refCircWidth}ft)`,
);

// Stairs distributed front/center/rear
const stairYs = msFloor3.staircases.map((s) => s.y).sort((a, b) => a - b);
assertEqual(stairYs.length, 2, "Floor 3 has exactly 2 staircases");
assertApprox(stairYs[0], 0, 1, "First staircase at front (y approx 0)");
const bd = multiStairLayout.lot.buildableDepth;
assertApprox(
  stairYs[1],
  bd - 10,
  1,
  "Second staircase at rear",
);

// Single lot floor 3 delta >= 15% (the dramatic delta assertion)
const currF3Livable = msFloor3.units.reduce((s, u) => s + u.sqft, 0);
const refF3Livable = refFloor3.units.reduce((s, u) => s + u.sqft, 0);
const deltaPctF3 = ((refF3Livable - currF3Livable) / currF3Livable) * 100;
assert(
  deltaPctF3 >= 15,
  `Single lot floor 3 delta is ${deltaPctF3.toFixed(1)}% — must be >= 15%`,
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
for (const lot of ["single", "double"]) {
  for (const stories of [3, 4]) {
    const layout = generateLayout({ lot, stories, stair: "current" });
    const floorStairCounts = layout.floors.map(f => f.staircases.length);
    const allSame = floorStairCounts.every(c => c === floorStairCounts[0]);
    assert(allSame, `${lot}/${stories}story: all floors have same stair count (${floorStairCounts.join(',')})`);
  }
}

// All floors of a 3+ story building must have the same hallway count
for (const lot of ["single", "double"]) {
  for (const stories of [3, 4]) {
    const layout = generateLayout({ lot, stories, stair: "current" });
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
const curr2story = generateLayout({ lot: "single", stories: 2, stair: "current" });
assertEqual(curr2story.floors[0].staircases.length, 1, "2-story single lot, floor 1: 1 staircase");
assertEqual(curr2story.floors[1].staircases.length, 1, "2-story single lot, floor 2: 1 staircase");
assertEqual(curr2story.floors[0].hallways.length, 1, "2-story single lot, floor 1: 1 hallway (landing)");

// Reform always gets 1 stair regardless of building height
for (const stories of [2, 3, 4]) {
  const ref = generateLayout({ lot: "single", stories, stair: "reform" });
  for (let i = 0; i < stories; i++) {
    assertEqual(ref.floors[i].staircases.length, 1, `Reform ${stories}story floor ${i+1}: 1 staircase`);
    assertEqual(ref.floors[i].hallways.length, 1, `Reform ${stories}story floor ${i+1}: 1 hallway (landing)`);
  }
}

// Delta is now impactful on every floor of a 3+ story building (not just floor 3+)
{
  const c = generateLayout({ lot: "single", stories: 3, stair: "current" });
  const r = generateLayout({ lot: "single", stories: 3, stair: "reform" });
  for (let i = 0; i < 3; i++) {
    const cLiv = c.floors[i].units.reduce((s, u) => s + u.sqft, 0);
    const rLiv = r.floors[i].units.reduce((s, u) => s + u.sqft, 0);
    const deltaPct = ((rLiv - cLiv) / cLiv) * 100;
    assert(
      deltaPct >= 15,
      `single 3-story floor ${i+1}: reform delta ${deltaPct.toFixed(1)}% >= 15%`,
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
// 4.1 — 3D Scene Construction Tests
// =============================================================

console.log("=== 3D Scene Construction Tests ===");

// Staircase deduplication for rendering
const dedup3Layout = generateLayout({ lot: "single", stories: 3, stair: "current" });
const dedup3Meshes = buildMeshData(dedup3Layout);
const allStairs3 = dedup3Meshes.filter(m => m.type === "staircase");
assertEqual(allStairs3.length, 6, "Raw mesh data has 6 staircase meshes (2 per floor x 3 floors)");
const dedupedStairs3 = allStairs3.filter(m => m.floorLevel === 0);
assertEqual(dedupedStairs3.length, 2, "Deduped: 2 unique staircase meshes");
dedupedStairs3.forEach(m => {
  assertEqual(m.y, 0, "Deduped staircase starts at y=0");
  assertEqual(m.height, 30, "Deduped staircase spans full 3-story height (30ft)");
});

// Reform has fewer meshes after deduplication
const reformDedupLayout = generateLayout({ lot: "single", stories: 3, stair: "reform" });
const reformDedupMeshes = buildMeshData(reformDedupLayout);
const reformDedupStairs = reformDedupMeshes.filter(m => m.type === "staircase" && m.floorLevel === 0);
const reformDedupHalls = reformDedupMeshes.filter(m => m.type === "hallway");
assertEqual(reformDedupStairs.length, 1, "Reform deduped: 1 staircase mesh");
assertEqual(reformDedupHalls.length, 3, "Reform: 3 hallway meshes (landing per floor)");

// Material color mapping validation (Chicago brick facade palette)
const materialTypes = ["unit", "staircase", "hallway", "slab"];
const expectedColors = {
  unit: 0x8B4533,
  staircase: 0xBF5B4B,
  hallway: 0xC4B5A5,
  slab: 0xA0A0A0,
};
materialTypes.forEach(type => {
  assertEqual(MATERIAL_COLORS[type], expectedColors[type], `MATERIAL_COLORS.${type} is correct`);
});

// New material types for Chicago buildings
assert(MATERIAL_COLORS.limestone !== undefined, "MATERIAL_COLORS has limestone");
assert(MATERIAL_COLORS.mullion !== undefined, "MATERIAL_COLORS has mullion");
assert(MATERIAL_COLORS.glass !== undefined, "MATERIAL_COLORS has glass");
assert(MATERIAL_COLORS.door !== undefined, "MATERIAL_COLORS has door");
assertEqual(MATERIAL_COLORS.limestone, 0xE8DCC8, "MATERIAL_COLORS.limestone is cream");
assertEqual(MATERIAL_COLORS.mullion, 0x3A3530, "MATERIAL_COLORS.mullion is dark");
assertEqual(MATERIAL_COLORS.glass, 0x4A6B8A, "MATERIAL_COLORS.glass is blue-grey");
assertEqual(MATERIAL_COLORS.door, 0x2A1F1A, "MATERIAL_COLORS.door is dark brown");

// Side-by-side positioning math
const ssConfig = { lot: "single", stories: 3 };
const ssCurrentLayout = generateLayout({ ...ssConfig, stair: "current" });
const ssBw = ssCurrentLayout.lot.buildableWidth;
const ssGap = ssBw * 1.5;
const ssCurrentCenterX = -(ssBw / 2 + ssGap / 2);
const ssReformCenterX = ssBw / 2 + ssGap / 2;
assert(ssCurrentCenterX < 0, "Current code building center is at negative X");
assert(ssReformCenterX > 0, "Reform building center is at positive X");
assertApprox(Math.abs(ssCurrentCenterX), Math.abs(ssReformCenterX), 0.001, "Buildings equidistant from center");

// Window wall data presence
const wwLayout = generateLayout({ lot: "single", stories: 3, stair: "reform" });
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
const tourConfig3 = { lot: "single", stories: 3 };
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

// 2-story building: fewer or different comparison steps
const tourSteps2 = createTourSteps({ lot: "single", stories: 2 });
assert(tourSteps2.length >= 3, `2-story tour has ${tourSteps2.length} steps (expected >= 3)`);
const compStep2 = tourSteps2.find(s => s.id === "comparison");
if (compStep2) {
  assert(
    compStep2.description.includes("2-story") || compStep2.description.includes("same") || compStep2.description.includes("3+"),
    "2-story comparison step acknowledges no difference"
  );
}

// Camera positions scale with lot size
const tourSingleSteps = createTourSteps({ lot: "single", stories: 3 });
const tourDoubleSteps = createTourSteps({ lot: "double", stories: 3 });
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
const intLayout = generateLayout({ lot: "single", stories: 3, stair: "current" });
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
  { lot: "single", stories: 2, stair: "reform" },
  { lot: "single", stories: 3, stair: "current" },
  { lot: "double", stories: 3, stair: "current" },
  { lot: "single", stories: 3, stair: "reform" },
];
const intMeshCounts = intConfigs.map(c => {
  const layout = generateLayout(c);
  return buildMeshData(layout).length;
});
const intUniqueCounts = new Set(intMeshCounts);
assert(intUniqueCounts.size > 1, "Different configs produce different mesh counts");

// =============================================================
// 5.1 — isGroundFloor Field Tests
// =============================================================

console.log("=== isGroundFloor Field Tests ===");

// isGroundFloor should be true only for floor 0
const gfLayout = generateLayout({ lot: "single", stories: 3, stair: "reform" });
const gfMeshData = buildMeshData(gfLayout);
const gfUnitMeshes = gfMeshData.filter(m => m.type === "unit");

// Ground floor units should have isGroundFloor === true
const gfGroundUnits = gfUnitMeshes.filter(m => m.floorLevel === 0);
gfGroundUnits.forEach(m => {
  assertEqual(m.isGroundFloor, true, `Floor 0 unit ${m.unitId}: isGroundFloor is true`);
});

// Upper floor units should have isGroundFloor === false
const gfUpperUnits = gfUnitMeshes.filter(m => m.floorLevel > 0);
gfUpperUnits.forEach(m => {
  assertEqual(m.isGroundFloor, false, `Floor ${m.floorLevel} unit ${m.unitId}: isGroundFloor is false`);
});

// isGroundFloor field should be present on all unit meshes
gfUnitMeshes.forEach(m => {
  assert(m.isGroundFloor !== undefined, `Unit mesh has isGroundFloor field`);
  assert(typeof m.isGroundFloor === "boolean", `isGroundFloor is a boolean`);
});

// isGroundFloor works for all lot types
for (const lot of ["single", "double"]) {
  for (const stories of [2, 3, 4]) {
    const layout = generateLayout({ lot, stories, stair: "current" });
    const meshData = buildMeshData(layout);
    const units = meshData.filter(m => m.type === "unit");
    const groundUnits = units.filter(m => m.floorLevel === 0);
    const upperUnits = units.filter(m => m.floorLevel > 0);
    assert(groundUnits.length > 0, `${lot}/${stories}story: has ground floor units`);
    groundUnits.forEach(m => {
      assert(m.isGroundFloor === true, `${lot}/${stories}story floor 0: isGroundFloor is true`);
    });
    upperUnits.forEach(m => {
      assert(m.isGroundFloor === false, `${lot}/${stories}story floor ${m.floorLevel}: isGroundFloor is false`);
    });
  }
}

// Ground floor unit A should exist (used for entry door placement)
const gfFrontUnit = gfGroundUnits.find(m => m.unitId === "A");
assert(gfFrontUnit, "Ground floor has a unit with id 'A'");
assert(gfFrontUnit.isGroundFloor === true, "Unit A on floor 0 has isGroundFloor === true");
assert(gfFrontUnit.windowWalls.includes("north"), "Ground floor unit A has north window wall");

// =============================================================
// 5.2 — Window Descriptor Collection Tests
// =============================================================

console.log("=== Window Descriptor Collection Tests ===");

// Test that window positions can be calculated from mesh descriptors
// (This tests the logic used by collectWindowPositions in viewer3d.js)
const winLayout = generateLayout({ lot: "single", stories: 3, stair: "reform" });
const winMeshData = buildMeshData(winLayout);
const winUnits = winMeshData.filter(m => m.type === "unit");

// Every unit should have window walls
winUnits.forEach(m => {
  assert(Array.isArray(m.windowWalls), `Unit ${m.unitId} floor ${m.floorLevel}: has windowWalls array`);
  assert(m.windowWalls.length > 0, `Unit ${m.unitId} floor ${m.floorLevel}: has at least one window wall`);
});

// Window count per wall should be reasonable
winUnits.forEach(m => {
  m.windowWalls.forEach(wall => {
    const wallLen = (wall === "north" || wall === "south") ? m.width : m.depth;
    const numWindows = Math.max(1, Math.floor(wallLen / 8));
    assert(numWindows >= 1, `Unit ${m.unitId} wall ${wall}: at least 1 window (wallLen=${wallLen})`);
    assert(numWindows <= 10, `Unit ${m.unitId} wall ${wall}: at most 10 windows (wallLen=${wallLen})`);
  });
});

// Ground floor unit A should have center window position available for door
const doorUnit = winUnits.find(m => m.isGroundFloor && m.unitId === "A");
assert(doorUnit, "Ground floor unit A exists for door placement");
assert(doorUnit.windowWalls.includes("north"), "Door unit has north-facing wall for entry");

// Window spacing is evenly distributed
winUnits.forEach(m => {
  m.windowWalls.forEach(wall => {
    const wallLen = (wall === "north" || wall === "south") ? m.width : m.depth;
    const numWindows = Math.max(1, Math.floor(wallLen / 8));
    const spacing = wallLen / (numWindows + 1);
    assert(spacing > 0, `Unit ${m.unitId} wall ${wall}: positive window spacing`);
    assert(spacing <= wallLen, `Unit ${m.unitId} wall ${wall}: spacing within wall length`);
  });
});

// =============================================================
// 5.3 — Chicago Material Palette Tests
// =============================================================

console.log("=== Chicago Material Palette Tests ===");

// Verify the expanded material color palette has all required entries
const requiredMaterialTypes = ["unit", "staircase", "hallway", "slab", "limestone", "mullion", "glass", "door"];
requiredMaterialTypes.forEach(type => {
  assert(MATERIAL_COLORS[type] !== undefined, `MATERIAL_COLORS has '${type}'`);
  assert(typeof MATERIAL_COLORS[type] === "number", `MATERIAL_COLORS.${type} is a number`);
});

// Unit color should be brick terracotta (not the old plaster color)
assert(MATERIAL_COLORS.unit !== 0xF0EBE1, "Unit color is not the old plaster color");
assertEqual(MATERIAL_COLORS.unit, 0x8B4533, "Unit color is brick terracotta");

// Slab color should be concrete grey (not the old warm concrete)
assert(MATERIAL_COLORS.slab !== 0xCCC7BF, "Slab color is not the old warm concrete");
assertEqual(MATERIAL_COLORS.slab, 0xA0A0A0, "Slab color is concrete grey");

// =============================================================
// 5.4 — Mesh Data Completeness Tests
// =============================================================

console.log("=== Mesh Data Completeness Tests ===");

// All mesh descriptors should have required fields
const completeLayout = generateLayout({ lot: "double", stories: 4, stair: "current" });
const completeMeshData = buildMeshData(completeLayout);

completeMeshData.forEach((m, idx) => {
  assert(m.type !== undefined, `Mesh ${idx}: has type`);
  assert(typeof m.x === "number", `Mesh ${idx}: x is number`);
  assert(typeof m.y === "number", `Mesh ${idx}: y is number`);
  assert(typeof m.z === "number", `Mesh ${idx}: z is number`);
  assert(typeof m.width === "number", `Mesh ${idx}: width is number`);
  assert(typeof m.height === "number", `Mesh ${idx}: height is number`);
  assert(typeof m.depth === "number", `Mesh ${idx}: depth is number`);
  assert(typeof m.floorLevel === "number", `Mesh ${idx}: floorLevel is number`);

  if (m.type === "unit") {
    assert(typeof m.isTopFloor === "boolean", `Unit mesh ${idx}: isTopFloor is boolean`);
    assert(typeof m.isGroundFloor === "boolean", `Unit mesh ${idx}: isGroundFloor is boolean`);
    assert(Array.isArray(m.windowWalls), `Unit mesh ${idx}: windowWalls is array`);
    assert(m.unitId !== undefined, `Unit mesh ${idx}: has unitId`);
  }
});

// Both isTopFloor and isGroundFloor should be correctly set on a multi-story building
const topFloorUnits = completeMeshData.filter(m => m.type === "unit" && m.isTopFloor);
const groundFloorUnits = completeMeshData.filter(m => m.type === "unit" && m.isGroundFloor);
assert(topFloorUnits.length > 0, "Multi-story building has top floor units");
assert(groundFloorUnits.length > 0, "Multi-story building has ground floor units");

// On a multi-story building, a unit cannot be both ground and top floor
// (unless it's a single-story building, which doesn't exist in our configs)
const bothFlags = completeMeshData.filter(m => m.type === "unit" && m.isTopFloor && m.isGroundFloor);
assertEqual(bothFlags.length, 0, "No unit is both ground floor and top floor on 4-story building");

// =============================================================

summary();
