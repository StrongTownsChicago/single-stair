// Single Stair Visualizer — 3D Mesh Data
// Converts layout engine output to mesh descriptors for Three.js

const RESIDENTIAL_FLOOR_HEIGHT = 10;
const COMMERCIAL_FLOOR_HEIGHT = 14;

function buildMeshData(layout) {
  const meshes = [];
  const numFloors = layout.floors.length;
  const totalStories = numFloors;

  // Calculate floor Y offsets (commercial ground floor is taller)
  const floorYOffsets = [];
  let currentY = 0;
  for (let i = 0; i < numFloors; i++) {
    floorYOffsets.push(currentY);
    const isCommercialGround = i === 0 && layout.floors[0].units.some(u => u.type === "commercial");
    currentY += isCommercialGround ? COMMERCIAL_FLOOR_HEIGHT : RESIDENTIAL_FLOOR_HEIGHT;
  }
  const totalBuildingHeight = currentY;

  for (let i = 0; i < numFloors; i++) {
    const floor = layout.floors[i];
    const yOffset = floorYOffsets[i];
    const isCommercialGround = i === 0 && floor.units.some(u => u.type === "commercial");
    const floorHeight = isCommercialGround ? COMMERCIAL_FLOOR_HEIGHT : RESIDENTIAL_FLOOR_HEIGHT;

    // Units
    for (const unit of floor.units) {
      meshes.push({
        type: "unit",
        x: unit.x,
        y: yOffset,
        z: unit.y,
        width: unit.w,
        height: floorHeight,
        depth: unit.d,
        floorLevel: i,
        unitId: unit.id,
        unitType: unit.type,
        windowWalls: unit.windowWalls,
      });
    }

    // Staircases (each spans full building height)
    for (const stair of floor.staircases) {
      meshes.push({
        type: "staircase",
        x: stair.x,
        y: 0,
        z: stair.y,
        width: stair.w,
        height: totalBuildingHeight,
        depth: stair.d,
        floorLevel: i,
        stairType: stair.type,
      });
    }

    // Hallways
    for (const hall of floor.hallways) {
      meshes.push({
        type: "hallway",
        x: hall.x,
        y: yOffset,
        z: hall.y,
        width: hall.w,
        height: floorHeight,
        depth: hall.d,
        floorLevel: i,
      });
    }

    // Floor slab
    meshes.push({
      type: "slab",
      x: 0,
      y: yOffset,
      z: 0,
      width: layout.lot.buildableWidth,
      height: 0.5,
      depth: layout.lot.buildableDepth,
      floorLevel: i,
    });
  }

  return meshes;
}

// Make available globally (browser) and for Node require
if (typeof module !== "undefined" && module.exports) {
  module.exports = { buildMeshData };
}
