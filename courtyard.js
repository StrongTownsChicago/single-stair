// Single Stair Visualizer — Courtyard Layout Engine
// Generates L-shape and U-shape courtyard configurations

const CY_SEGMENT_WIDTH = 20; // Each segment is like a single lot buildable width
const CY_SEGMENT_DEPTH = 40; // Half the depth of a standard lot buildable depth
const CY_STAIR_W = 4;
const CY_STAIR_D = 10;

function generateCourtyardLayout(config) {
  const { shape, stories, ground } = config;

  if (shape === "L") {
    return generateLShape(stories, ground);
  } else if (shape === "U") {
    return generateUShape(stories, ground);
  }
  return generateLShape(stories, ground);
}

function generateLShape(stories, ground) {
  // L-shape: 2 segments at 90° angle
  // Segment A runs along the front (horizontal)
  // Segment B runs along the side (vertical)
  const segA = generateSegment({
    offsetX: 0,
    offsetY: 0,
    width: CY_SEGMENT_DEPTH,
    depth: CY_SEGMENT_WIDTH,
    stories,
    ground,
    courtyardSide: "south",
    label: "A",
  });

  const segB = generateSegment({
    offsetX: 0,
    offsetY: CY_SEGMENT_WIDTH,
    width: CY_SEGMENT_WIDTH,
    depth: CY_SEGMENT_DEPTH,
    stories,
    ground,
    courtyardSide: "east",
    label: "B",
  });

  // Courtyard occupies the interior corner
  const courtyard = {
    bounds: {
      x: CY_SEGMENT_WIDTH,
      y: CY_SEGMENT_WIDTH,
      w: CY_SEGMENT_DEPTH - CY_SEGMENT_WIDTH,
      d: CY_SEGMENT_DEPTH,
    },
    area: (CY_SEGMENT_DEPTH - CY_SEGMENT_WIDTH) * CY_SEGMENT_DEPTH,
  };

  return { segments: [segA, segB], courtyard };
}

function generateUShape(stories, ground) {
  // U-shape: 3 segments forming a U
  // Front segment across the top, two side segments going back
  const frontWidth = CY_SEGMENT_DEPTH + CY_SEGMENT_WIDTH; // full width
  const sideDepth = CY_SEGMENT_DEPTH;

  const segFront = generateSegment({
    offsetX: 0,
    offsetY: 0,
    width: frontWidth,
    depth: CY_SEGMENT_WIDTH,
    stories,
    ground,
    courtyardSide: "south",
    label: "A",
  });

  const segLeft = generateSegment({
    offsetX: 0,
    offsetY: CY_SEGMENT_WIDTH,
    width: CY_SEGMENT_WIDTH,
    depth: sideDepth,
    stories,
    ground,
    courtyardSide: "east",
    label: "B",
  });

  const segRight = generateSegment({
    offsetX: frontWidth - CY_SEGMENT_WIDTH,
    offsetY: CY_SEGMENT_WIDTH,
    width: CY_SEGMENT_WIDTH,
    depth: sideDepth,
    stories,
    ground,
    courtyardSide: "west",
    label: "C",
  });

  const courtyard = {
    bounds: {
      x: CY_SEGMENT_WIDTH,
      y: CY_SEGMENT_WIDTH,
      w: frontWidth - 2 * CY_SEGMENT_WIDTH,
      d: sideDepth,
    },
    area: (frontWidth - 2 * CY_SEGMENT_WIDTH) * sideDepth,
  };

  return { segments: [segFront, segLeft, segRight], courtyard };
}

function generateSegment(params) {
  const { offsetX, offsetY, width, depth, stories, ground, courtyardSide, label } = params;
  const floors = [];

  for (let i = 0; i < stories; i++) {
    const floorLevel = i + 1;
    const isCommercialGround = i === 0 && ground === "commercial";

    // 1 staircase per segment (single stair reform)
    const staircase = {
      x: offsetX,
      y: offsetY + depth / 2 - CY_STAIR_D / 2,
      w: CY_STAIR_W,
      d: CY_STAIR_D,
      type: "interior",
    };

    // 2 units per floor in each segment (split by depth)
    const unitW = width - CY_STAIR_W;
    const halfD = depth / 2;

    // Courtyard units get exterior wall + courtyard-facing + side windows
    // More exposed walls than a block building because segments are separated
    const unitAWindows = courtyardSide === "south" ? ["north", "east", "courtyard"] :
                         courtyardSide === "east" ? ["north", "west", "courtyard"] :
                         courtyardSide === "west" ? ["north", "east", "courtyard"] :
                         ["north", "courtyard"];
    const unitBWindows = courtyardSide === "south" ? ["south", "east", "courtyard"] :
                         courtyardSide === "east" ? ["south", "west", "courtyard"] :
                         courtyardSide === "west" ? ["south", "east", "courtyard"] :
                         ["south", "courtyard"];

    const unitASqft = unitW * halfD;
    const unitBSqft = unitW * halfD;

    const units = isCommercialGround ? [{
      id: `${label}R1`,
      x: offsetX + CY_STAIR_W,
      y: offsetY,
      w: unitW,
      d: depth,
      sqft: unitW * depth,
      bedrooms: 0,
      windowWalls: ["north", "south", "courtyard"],
      position: "full",
      type: "commercial",
    }] : [
      {
        id: `${label}1`,
        x: offsetX + CY_STAIR_W,
        y: offsetY,
        w: unitW,
        d: halfD,
        sqft: unitASqft,
        bedrooms: estimateBedrooms(unitASqft, unitAWindows.length),
        windowWalls: unitAWindows,
        position: "front",
        type: "residential",
      },
      {
        id: `${label}2`,
        x: offsetX + CY_STAIR_W,
        y: offsetY + halfD,
        w: unitW,
        d: halfD,
        sqft: unitBSqft,
        bedrooms: estimateBedrooms(unitBSqft, unitBWindows.length),
        windowWalls: unitBWindows,
        position: "rear",
        type: "residential",
      },
    ];

    floors.push({
      level: floorLevel,
      units,
      staircases: [staircase],
      hallways: [],
      circulationSqft: CY_STAIR_W * CY_STAIR_D,
      livableSqft: units.reduce((s, u) => s + u.sqft, 0),
    });
  }

  return { label, floors };
}

function estimateBedrooms(sqft, windowWallCount) {
  const nonKitchenBath = sqft - 150;
  const bySpace = Math.max(1, Math.floor(nonKitchenBath / 150));
  return Math.min(bySpace, Math.max(1, windowWallCount * 2));
}

// Make available globally (browser) and for Node require
if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateCourtyardLayout };
}
