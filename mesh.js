// Single Stair Visualizer — 3D Mesh Data
// Converts layout engine output to mesh descriptors for Three.js

var RESIDENTIAL_FLOOR_HEIGHT = 10;

function buildMeshData(layout) {
  var meshes = [];
  var numFloors = layout.floors.length;
  var totalBuildingHeight = numFloors * RESIDENTIAL_FLOOR_HEIGHT;

  for (var i = 0; i < numFloors; i++) {
    var floor = layout.floors[i];
    var yOffset = i * RESIDENTIAL_FLOOR_HEIGHT;
    var isTopFloor = i === numFloors - 1;

    // Units
    for (var u = 0; u < floor.units.length; u++) {
      var unit = floor.units[u];
      meshes.push({
        type: "unit",
        x: unit.x,
        y: yOffset,
        z: unit.y,
        width: unit.w,
        height: RESIDENTIAL_FLOOR_HEIGHT,
        depth: unit.d,
        floorLevel: i,
        isTopFloor: isTopFloor,
        unitId: unit.id,
        unitType: unit.type,
        windowWalls: unit.windowWalls,
      });
    }

    // Staircases (each spans full building height)
    for (var s = 0; s < floor.staircases.length; s++) {
      var stair = floor.staircases[s];
      meshes.push({
        type: "staircase",
        x: stair.x,
        y: 0,
        z: stair.y,
        width: stair.w,
        height: totalBuildingHeight,
        depth: stair.d,
        floorLevel: i,
        isTopFloor: false,
        stairType: stair.type,
      });
    }

    // Hallways
    for (var h = 0; h < floor.hallways.length; h++) {
      var hall = floor.hallways[h];
      meshes.push({
        type: "hallway",
        x: hall.x,
        y: yOffset,
        z: hall.y,
        width: hall.w,
        height: RESIDENTIAL_FLOOR_HEIGHT,
        depth: hall.d,
        floorLevel: i,
        isTopFloor: isTopFloor,
      });
    }

    // Floor slab (with overhang for shadow lines)
    var SLAB_OVERHANG = 0.3;
    meshes.push({
      type: "slab",
      x: 0 - SLAB_OVERHANG,
      y: yOffset,
      z: 0 - SLAB_OVERHANG,
      width: layout.lot.buildableWidth + SLAB_OVERHANG * 2,
      height: 0.5,
      depth: layout.lot.buildableDepth + SLAB_OVERHANG * 2,
      floorLevel: i,
      isTopFloor: isTopFloor,
    });
  }

  return meshes;
}

export { buildMeshData, RESIDENTIAL_FLOOR_HEIGHT };
