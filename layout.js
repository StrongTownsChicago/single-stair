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

  const floors = [];
  for (let i = 0; i < stories; i++) {
    const floorLevel = i + 1;
    const isGroundFloor = i === 0;
    const isCommercialGround = isGroundFloor && ground === "commercial";

    // Determine staircase count for this floor
    // Current code: floors 1-2 get 1 staircase, floor 3+ gets more
    // Reform: always 1 staircase
    let staircaseCount, needsHallway;
    if (stair === "reform") {
      staircaseCount = 1;
      needsHallway = false;
    } else {
      if (floorLevel <= 2) {
        staircaseCount = 1;
        needsHallway = false;
      } else {
        if (lotType === "double") {
          staircaseCount = 2;
          needsHallway = true;
        } else {
          staircaseCount = 3;
          needsHallway = true;
        }
      }
    }

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

// Single/corner lot: stairs along left wall, 2 units to the right
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

  // Units occupy the right portion of the floor (to the right of staircase column)
  const unitW = bw - STAIR_W;
  const unitA = { x: STAIR_W, y: 0, w: unitW, d: halfD };
  const unitB = { x: STAIR_W, y: halfD, w: unitW, d: halfD };

  // Calculate dead zone beside stairs (left column not covered by stairs)
  const stairColumnArea = STAIR_W * bd;
  const stairPhysicalArea = staircases.reduce((s, st) => s + st.w * st.d, 0);
  const deadZone = stairColumnArea - stairPhysicalArea;
  const deadPerUnit = deadZone / 2;

  const frontWindows = ["north"];
  const backWindows = ["south"];
  if (isCorner) {
    frontWindows.push("east");
    backWindows.push("east");
  }

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
    hallways: [],
    circulationSqft: stairPhysicalArea,
    livableSqft: units.reduce((s, u) => s + u.sqft, 0),
  };
}

// Double lot without hallway: 1 staircase centered, 4 units in quadrants
function generateDoubleFloor(lot, floorLevel) {
  const bw = lot.buildableWidth;
  const bd = lot.buildableDepth;
  const halfD = bd / 2;

  // Center staircase on width and depth
  const stairX = (bw - STAIR_W) / 2;
  const stairY = halfD - STAIR_D / 2;
  const staircases = [
    { x: stairX, y: stairY, w: STAIR_W, d: STAIR_D, type: "interior" },
  ];

  const leftW = stairX;
  const rightW = bw - stairX - STAIR_W;
  const topD = stairY;
  const bottomD = bd - stairY - STAIR_D;

  // 4 quadrant units around the central staircase
  const quadrants = [
    { id: "A", x: 0, y: 0, w: leftW, d: topD, pos: "front-left", windows: ["north", "west"] },
    { id: "B", x: stairX + STAIR_W, y: 0, w: rightW, d: topD, pos: "front-right", windows: ["north", "east"] },
    { id: "C", x: 0, y: stairY + STAIR_D, w: leftW, d: bottomD, pos: "rear-left", windows: ["south", "west"] },
    { id: "D", x: stairX + STAIR_W, y: stairY + STAIR_D, w: rightW, d: bottomD, pos: "rear-right", windows: ["south", "east"] },
  ];

  // Dead zone: strips above/below stair between the quadrants
  const stairArea = STAIR_W * STAIR_D;
  const totalQuadArea = quadrants.reduce((s, q) => s + q.w * q.d, 0);
  const deadZone = bw * bd - totalQuadArea - stairArea;
  const deadPerUnit = deadZone / quadrants.length;

  const units = quadrants.map((q) => {
    const sqft = q.w * q.d + deadPerUnit;
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

// Commercial ground floor: 1 retail unit using full floor minus circulation
function generateCommercialFloor(lot, lotType, staircaseCount, needsHallway) {
  const bw = lot.buildableWidth;
  const bd = lot.buildableDepth;

  // Place stair in front-left corner for commercial
  const staircases = [
    { x: 0, y: 0, w: STAIR_W, d: STAIR_D, type: "interior" },
  ];
  const hallways = [];

  // Commercial unit fills rest of floor
  // Two non-overlapping rects: right of stair + below stair
  // But we model it as one unit with adjusted sqft
  const stairArea = STAIR_W * STAIR_D;
  const sqft = bw * bd - stairArea;

  const units = [{
    id: "R1", x: STAIR_W, y: 0, w: bw - STAIR_W, d: bd,
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
  return Math.min(bySpace, Math.max(1, windowWallCount * 2));
}

// Make available globally (browser) and for Node require
if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateLayout };
}
