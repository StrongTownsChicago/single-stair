// Single Stair Visualizer — Stats Dashboard
// Computes comparison statistics from layout data

function computeStats(current, reform) {
  const numFloors = current.floors.length;
  const perFloor = [];

  let currTotalUnits = 0, refTotalUnits = 0;
  let currTotalLivable = 0, refTotalLivable = 0;
  let currTotalBedrooms = 0, refTotalBedrooms = 0;
  let currTotalWindows = 0, refTotalWindows = 0;
  let currTotalStairs = 0, refTotalStairs = 0;
  let currTotalCirculation = 0, refTotalCirculation = 0;

  for (let i = 0; i < numFloors; i++) {
    const cf = current.floors[i];
    const rf = reform.floors[i];

    const currLivable = cf.units.reduce((s, u) => s + u.sqft, 0);
    const refLivable = rf.units.reduce((s, u) => s + u.sqft, 0);
    const currBedrooms = cf.units.reduce((s, u) => s + u.bedrooms, 0);
    const refBedrooms = rf.units.reduce((s, u) => s + u.bedrooms, 0);
    const currWindows = cf.units.reduce((s, u) => s + u.windowWalls.length, 0);
    const refWindows = rf.units.reduce((s, u) => s + u.windowWalls.length, 0);
    const currCirc = cf.circulationSqft;
    const refCirc = rf.circulationSqft;

    perFloor.push({
      current: {
        units: cf.units.length,
        livableArea: currLivable,
        avgUnitSize: cf.units.length > 0 ? currLivable / cf.units.length : 0,
        bedrooms: currBedrooms,
        windowWalls: currWindows,
        staircases: cf.staircases.length,
        circulationArea: currCirc,
      },
      reform: {
        units: rf.units.length,
        livableArea: refLivable,
        avgUnitSize: rf.units.length > 0 ? refLivable / rf.units.length : 0,
        bedrooms: refBedrooms,
        windowWalls: refWindows,
        staircases: rf.staircases.length,
        circulationArea: refCirc,
      },
    });

    currTotalUnits += cf.units.length;
    refTotalUnits += rf.units.length;
    currTotalLivable += currLivable;
    refTotalLivable += refLivable;
    currTotalBedrooms += currBedrooms;
    refTotalBedrooms += refBedrooms;
    currTotalWindows += currWindows;
    refTotalWindows += refWindows;
    currTotalStairs += cf.staircases.length;
    refTotalStairs += rf.staircases.length;
    currTotalCirculation += currCirc;
    refTotalCirculation += refCirc;
  }

  const wholeBuilding = {
    current: {
      totalUnits: currTotalUnits,
      totalLivableArea: currTotalLivable,
      avgUnitSize: currTotalUnits > 0 ? currTotalLivable / currTotalUnits : 0,
      totalBedrooms: currTotalBedrooms,
      totalWindowWalls: currTotalWindows,
      totalStaircases: currTotalStairs,
      totalCirculation: currTotalCirculation,
    },
    reform: {
      totalUnits: refTotalUnits,
      totalLivableArea: refTotalLivable,
      avgUnitSize: refTotalUnits > 0 ? refTotalLivable / refTotalUnits : 0,
      totalBedrooms: refTotalBedrooms,
      totalWindowWalls: refTotalWindows,
      totalStaircases: refTotalStairs,
      totalCirculation: refTotalCirculation,
    },
  };

  const deltas = {
    livableArea: refTotalLivable - currTotalLivable,
    livableAreaPct: currTotalLivable > 0
      ? ((refTotalLivable / currTotalLivable) - 1) * 100
      : 0,
    units: refTotalUnits - currTotalUnits,
    bedrooms: refTotalBedrooms - currTotalBedrooms,
    windowWalls: refTotalWindows - currTotalWindows,
    staircases: refTotalStairs - currTotalStairs,
    circulation: refTotalCirculation - currTotalCirculation,
  };

  return { perFloor, wholeBuilding, deltas };
}

// Make available globally (browser) and for Node require
if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeStats };
}
