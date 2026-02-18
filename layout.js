// Single Stair Visualizer — Layout Engine
// Generates floor plan data from configuration parameters

const LOT_CONFIGS = {
  single: { width: 25, depth: 125, sideSetback: 5, buildableWidth: 20 },
  double: { width: 50, depth: 125, sideSetback: 5, buildableWidth: 45 },
  corner: { width: 25, depth: 125, sideSetback: 2.5, buildableWidth: 22.5 },
};

const FRONT_SETBACK = 15;
const REAR_SETBACK = 30;
const STAIR_W = 4;
const STAIR_D = 10;
const HALLWAY_W = 5;
const MULTI_STAIR_W = 6; // Wider circulation zone for 3-staircase floors (landing + fire doors + corridors)

function rectOverlapArea(a, b) {
  const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y));
  return overlapX * overlapY;
}

function generateLayout(config) {
  const { lot: lotType, stories, stair, ground } = config;
  const lotConfig = LOT_CONFIGS[lotType];
  const buildableDepth = lotConfig.depth - FRONT_SETBACK - REAR_SETBACK; // 80ft

  const lot = {
    width: lotConfig.width,
    depth: lotConfig.depth,
    buildableWidth: lotConfig.buildableWidth,
    buildableDepth: buildableDepth,
  };

  // Determine staircase count for the BUILDING (not per-floor).
  // Stairway shafts are vertical structures that run from ground to roof —
  // the same stair layout must apply to every floor.
  let staircaseCount, needsHallway;
  if (stair === "reform") {
    staircaseCount = 1;
    needsHallway = false;
  } else {
    if (stories <= 2) {
      // 2-story buildings: single stair allowed under current Chicago code
      staircaseCount = 1;
      needsHallway = false;
    } else {
      // 3+ story buildings: ALL floors get multiple stairs
      if (lotType === "double") {
        staircaseCount = 2;
        needsHallway = true;
      } else {
        staircaseCount = 3;
        needsHallway = true;
      }
    }
  }

  const floors = [];
  for (let i = 0; i < stories; i++) {
    const floorLevel = i + 1;
    const isGroundFloor = i === 0;
    const isCommercialGround = isGroundFloor && ground === "commercial";

    const floor = generateFloor({
      lot,
      lotType,
      floorLevel,
      staircaseCount,
      needsHallway,
      isCommercialGround,
    });
    floors.push(floor);
  }

  return { lot, floors };
}

function generateFloor(params) {
  const { lot, lotType, floorLevel, staircaseCount, needsHallway, isCommercialGround } = params;
  const bw = lot.buildableWidth;
  const bd = lot.buildableDepth;

  if (isCommercialGround) {
    return generateCommercialFloor(lot, lotType, staircaseCount, needsHallway);
  }

  if (lotType === "double" && needsHallway) {
    return generateDoubleHallwayFloor(lot, floorLevel);
  }

  if (lotType === "double") {
    return generateDoubleFloor(lot, floorLevel);
  }

  if (needsHallway && staircaseCount === 3) {
    return generateMultiStairFloor(lot, lotType, floorLevel);
  }

  return generateStandardFloor(lot, lotType, staircaseCount, floorLevel);
}

// Single/corner lot: single stair, 2 full-width units
// Staircase renders on top of units where it overlaps
function generateStandardFloor(lot, lotType, staircaseCount, floorLevel) {
  const bw = lot.buildableWidth;
  const bd = lot.buildableDepth;
  const halfD = bd / 2;
  const isCorner = lotType === "corner";

  const staircases = [];
  if (staircaseCount === 3) {
    staircases.push({ x: 0, y: 0, w: STAIR_W, d: STAIR_D, type: "interior" });
    staircases.push({ x: 0, y: halfD - STAIR_D / 2, w: STAIR_W, d: STAIR_D, type: "interior" });
    staircases.push({ x: 0, y: bd - STAIR_D, w: STAIR_W, d: STAIR_D, type: "gangway" });
  } else {
    staircases.push({ x: 0, y: halfD - STAIR_D / 2, w: STAIR_W, d: STAIR_D, type: "interior" });
  }

  // Units span full buildable width; sqft deducts stair overlap
  const unitA = { x: 0, y: 0, w: bw, d: halfD };
  const unitB = { x: 0, y: halfD, w: bw, d: halfD };

  const stairPhysicalArea = staircases.reduce((s, st) => s + st.w * st.d, 0);

  const frontWindows = ["north"];
  const backWindows = ["south"];
  if (isCorner) {
    frontWindows.push("east");
    backWindows.push("east");
  }

  const overlapA = staircases.reduce((s, st) => s + rectOverlapArea(unitA, st), 0);
  const overlapB = staircases.reduce((s, st) => s + rectOverlapArea(unitB, st), 0);
  const unitASqft = unitA.w * unitA.d - overlapA;
  const unitBSqft = unitB.w * unitB.d - overlapB;

  const units = [
    {
      id: "A", x: unitA.x, y: unitA.y, w: unitA.w, d: unitA.d,
      sqft: unitASqft, bedrooms: estimateBedrooms(unitASqft, frontWindows.length),
      windowWalls: frontWindows, position: "front", type: "residential",
    },
    {
      id: "B", x: unitB.x, y: unitB.y, w: unitB.w, d: unitB.d,
      sqft: unitBSqft, bedrooms: estimateBedrooms(unitBSqft, backWindows.length),
      windowWalls: backWindows, position: "rear", type: "residential",
    },
  ];

  return {
    level: floorLevel,
    units,
    staircases,
    hallways: [],
    circulationSqft: stairPhysicalArea,
    livableSqft: units.reduce((s, u) => s + u.sqft, 0),
  };
}

// Double lot without hallway: 1 staircase centered, 4 full-width quadrant units
// Stair renders on top of units where it overlaps
function generateDoubleFloor(lot, floorLevel) {
  const bw = lot.buildableWidth;
  const bd = lot.buildableDepth;
  const halfD = bd / 2;
  const halfW = bw / 2;

  // Center staircase on width and depth
  const stairX = (bw - STAIR_W) / 2;
  const stairY = halfD - STAIR_D / 2;
  const staircases = [
    { x: stairX, y: stairY, w: STAIR_W, d: STAIR_D, type: "interior" },
  ];

  // 4 quadrant units split at bw/2; stair overlap deducted from sqft
  const quadrants = [
    { id: "A", x: 0, y: 0, w: halfW, d: halfD, pos: "front-left", windows: ["north", "west"] },
    { id: "B", x: halfW, y: 0, w: halfW, d: halfD, pos: "front-right", windows: ["north", "east"] },
    { id: "C", x: 0, y: halfD, w: halfW, d: halfD, pos: "rear-left", windows: ["south", "west"] },
    { id: "D", x: halfW, y: halfD, w: halfW, d: halfD, pos: "rear-right", windows: ["south", "east"] },
  ];

  const stairArea = STAIR_W * STAIR_D;

  const units = quadrants.map((q) => {
    const sqft = q.w * q.d - rectOverlapArea(q, staircases[0]);
    return {
      id: q.id, x: q.x, y: q.y, w: q.w, d: q.d,
      sqft, bedrooms: estimateBedrooms(sqft, q.windows.length),
      windowWalls: q.windows, position: q.pos, type: "residential",
    };
  });

  return {
    level: floorLevel,
    units,
    staircases,
    hallways: [],
    circulationSqft: stairArea,
    livableSqft: units.reduce((s, u) => s + u.sqft, 0),
  };
}

// Double lot with hallway: 2 stairs at ends of central corridor, 4 units in quadrants
function generateDoubleHallwayFloor(lot, floorLevel) {
  const bw = lot.buildableWidth;
  const bd = lot.buildableDepth;
  const halfD = bd / 2;

  const hallwayX = (bw - HALLWAY_W) / 2;

  // Stairs at front and back of hallway zone
  const staircases = [
    { x: hallwayX, y: 0, w: HALLWAY_W, d: STAIR_D, type: "interior" },
    { x: hallwayX, y: bd - STAIR_D, w: HALLWAY_W, d: STAIR_D, type: "interior" },
  ];

  // Hallway runs between the two stairs
  const hallways = [
    { x: hallwayX, y: STAIR_D, w: HALLWAY_W, d: bd - 2 * STAIR_D },
  ];

  const leftW = hallwayX;
  const rightW = bw - hallwayX - HALLWAY_W;

  const units = [
    { id: "A", x: 0, y: 0, w: leftW, d: halfD, pos: "front-left", windows: ["north", "west"] },
    { id: "B", x: hallwayX + HALLWAY_W, y: 0, w: rightW, d: halfD, pos: "front-right", windows: ["north", "east"] },
    { id: "C", x: 0, y: halfD, w: leftW, d: halfD, pos: "rear-left", windows: ["south", "west"] },
    { id: "D", x: hallwayX + HALLWAY_W, y: halfD, w: rightW, d: halfD, pos: "rear-right", windows: ["south", "east"] },
  ].map((u) => {
    const sqft = u.w * u.d;
    return {
      ...u,
      sqft,
      bedrooms: estimateBedrooms(sqft, u.windows.length),
      windowWalls: u.windows,
      position: u.pos,
      type: "residential",
    };
  });

  return {
    level: floorLevel,
    units,
    staircases,
    hallways,
    circulationSqft: staircases.reduce((s, st) => s + st.w * st.d, 0) +
      hallways.reduce((s, h) => s + h.w * h.d, 0),
    livableSqft: units.reduce((s, u) => s + u.sqft, 0),
  };
}

// Commercial ground floor: 1 full-width retail unit, stair overlaid
function generateCommercialFloor(lot, lotType, staircaseCount, needsHallway) {
  const bw = lot.buildableWidth;
  const bd = lot.buildableDepth;

  // Place stair in front-left corner for commercial
  const staircases = [
    { x: 0, y: 0, w: STAIR_W, d: STAIR_D, type: "interior" },
  ];
  const hallways = [];

  // Commercial unit spans full floor; sqft deducts stair overlap
  const stairArea = STAIR_W * STAIR_D;
  const sqft = bw * bd - stairArea;

  const units = [{
    id: "R1", x: 0, y: 0, w: bw, d: bd,
    sqft,
    bedrooms: 0,
    windowWalls: ["north", "south"],
    position: "full",
    type: "commercial",
  }];

  return {
    level: 1,
    units,
    staircases,
    hallways,
    circulationSqft: stairArea,
    livableSqft: sqft,
  };
}

// Single/corner lot with 3 staircases: wider circulation zone with hallways connecting stairs
function generateMultiStairFloor(lot, lotType, floorLevel) {
  const bw = lot.buildableWidth;
  const bd = lot.buildableDepth;
  const halfD = bd / 2;
  const isCorner = lotType === "corner";
  const circW = MULTI_STAIR_W;

  // 3 staircases distributed front/center/rear within circulation column
  const staircases = [
    { x: 0, y: 0, w: circW, d: STAIR_D, type: "interior" },
    { x: 0, y: STAIR_D + 25, w: circW, d: STAIR_D, type: "interior" },
    { x: 0, y: bd - STAIR_D, w: circW, d: STAIR_D, type: "gangway" },
  ];

  // Hallways fill the gaps between stairs in the circulation column
  const hallways = [
    { x: 0, y: STAIR_D, w: circW, d: 25 },
    { x: 0, y: STAIR_D + 25 + STAIR_D, w: circW, d: bd - (3 * STAIR_D) - 25 },
  ];

  // Units occupy the right portion
  const unitW = bw - circW;
  const unitA = { x: circW, y: 0, w: unitW, d: halfD };
  const unitB = { x: circW, y: halfD, w: unitW, d: halfD };

  const frontWindows = ["north"];
  const backWindows = ["south"];
  if (isCorner) {
    frontWindows.push("east");
    backWindows.push("east");
  }

  // Livable area = unit rects + dead zone in circulation column allocated to units
  const circArea = circW * bd;
  const stairPhysicalArea = staircases.reduce((s, st) => s + st.w * st.d, 0);
  const hallPhysicalArea = hallways.reduce((s, h) => s + h.w * h.d, 0);
  const deadZone = circArea - stairPhysicalArea - hallPhysicalArea;
  const deadPerUnit = deadZone / 2;

  const unitASqft = unitA.w * unitA.d + deadPerUnit;
  const unitBSqft = unitB.w * unitB.d + deadPerUnit;

  const units = [
    {
      id: "A", x: unitA.x, y: unitA.y, w: unitA.w, d: unitA.d,
      sqft: unitASqft, bedrooms: estimateBedrooms(unitASqft, frontWindows.length),
      windowWalls: frontWindows, position: "front", type: "residential",
    },
    {
      id: "B", x: unitB.x, y: unitB.y, w: unitB.w, d: unitB.d,
      sqft: unitBSqft, bedrooms: estimateBedrooms(unitBSqft, backWindows.length),
      windowWalls: backWindows, position: "rear", type: "residential",
    },
  ];

  return {
    level: floorLevel,
    units,
    staircases,
    hallways,
    circulationSqft: stairPhysicalArea + hallPhysicalArea,
    livableSqft: units.reduce((s, u) => s + u.sqft, 0),
  };
}

function estimateBedrooms(sqft, windowWallCount) {
  // Rule of thumb: 1 BR per ~150sf of non-kitchen/bath space, capped by window walls
  const nonKitchenBath = sqft - 150;
  const bySpace = Math.max(1, Math.floor(nonKitchenBath / 150));
  return Math.min(bySpace, Math.max(1, windowWallCount * 3));
}

// Make available globally (browser) and for Node require
if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateLayout };
}
