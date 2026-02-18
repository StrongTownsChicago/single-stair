// Single Stair Visualizer — 3D Mesh Data
// Converts layout engine output to mesh descriptors for Three.js

const RESIDENTIAL_FLOOR_HEIGHT = 10;

function buildMeshData(layout) {
  const meshes = [];
  const numFloors = layout.floors.length;
  const totalBuildingHeight = numFloors * RESIDENTIAL_FLOOR_HEIGHT;

  for (let i = 0; i < numFloors; i++) {
    const floor = layout.floors[i];
    const yOffset = i * RESIDENTIAL_FLOOR_HEIGHT;

    // Units
    for (const unit of floor.units) {
      meshes.push({
        type: "unit",
        x: unit.x,
        y: yOffset,
        z: unit.y,
        width: unit.w,
        height: RESIDENTIAL_FLOOR_HEIGHT,
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
        height: RESIDENTIAL_FLOOR_HEIGHT,
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
