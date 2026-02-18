// Single Stair Visualizer -- Guided Tour
// Step-based camera tour for presentations and advocacy

function createTourSteps(config) {
  var lot = config.lot || "single";
  var stories = config.stories || 3;

  // Determine building dimensions for camera scaling
  var lotConfigs = {
    single: { buildableWidth: 20, buildableDepth: 80 },
    double: { buildableWidth: 45, buildableDepth: 80 },
  };
  var dims = lotConfigs[lot] || lotConfigs.single;
  var bw = dims.buildableWidth;
  var bd = dims.buildableDepth;
  var totalHeight = stories * 10;
  var scale = bw / 20; // normalize to single lot

  var steps = [];

  // Step 1: Lot overview
  steps.push({
    id: "lot",
    title: "Here's a typical Chicago lot",
    description: bw + " feet wide, " + bd + " feet deep. After setbacks, " + bw + "x" + bd + " feet is buildable.",
    cameraPosition: { x: 0, y: 80 * scale, z: 100 * scale },
    cameraTarget: { x: 0, y: 0, z: 0 },
    highlights: ["ground"],
  });

  if (stories > 2) {
    // Step 2: Current code stairs
    steps.push({
      id: "current-stairs",
      title: "Current code requires 3 stairways",
      description: "Above the second story, each unit must access two stairways. On a standard lot, that means three shafts running the full height of the building.",
      cameraPosition: { x: -30 * scale, y: 40 * scale, z: 60 * scale },
      cameraTarget: { x: -(bw / 2 + bw * 0.75), y: totalHeight / 2, z: 0 },
      highlights: ["staircases-current"],
    });

    // Step 3: Current code units
    steps.push({
      id: "current-units",
      title: "What's left for apartments",
      description: "Two units per floor in the remaining space after three stairways and connecting hallways.",
      cameraPosition: { x: -40 * scale, y: 25 * scale, z: 50 * scale },
      cameraTarget: { x: -(bw / 2 + bw * 0.75), y: totalHeight / 2, z: 0 },
      highlights: ["units-current"],
    });

    // Step 4: Reform view
    steps.push({
      id: "reform",
      title: "With single stair reform",
      description: "One stairway plus sprinklers. Larger units with more bedrooms and natural light, the kind of family-friendly apartments Chicago needs.",
      cameraPosition: { x: 40 * scale, y: 25 * scale, z: 50 * scale },
      cameraTarget: { x: bw / 2 + bw * 0.75, y: totalHeight / 2, z: 0 },
      highlights: ["units-reform"],
    });

    // Step 5: Side-by-side comparison
    steps.push({
      id: "comparison",
      title: "Side by side",
      description: "Same lot, same safety with sprinklers, but significantly more livable space per unit.",
      cameraPosition: { x: 0, y: 50 * scale, z: 80 * scale },
      cameraTarget: { x: 0, y: totalHeight / 2, z: 0 },
      highlights: ["all"],
    });
  } else {
    // 2-story buildings: no reform difference
    steps.push({
      id: "current-stairs",
      title: "2-story buildings already qualify",
      description: "Chicago's code currently allows second-story units to access a single stairway.",
      cameraPosition: { x: -30 * scale, y: 30 * scale, z: 60 * scale },
      cameraTarget: { x: -(bw / 2 + bw * 0.75), y: totalHeight / 2, z: 0 },
      highlights: ["staircases-current"],
    });

    steps.push({
      id: "comparison",
      title: "Same layout at 2 stories",
      description: "The impact of reform shows up at 3+ stories, where current code requires three stairways on a standard lot.",
      cameraPosition: { x: 0, y: 50 * scale, z: 80 * scale },
      cameraTarget: { x: 0, y: totalHeight / 2, z: 0 },
      highlights: ["all"],
    });
  }

  return steps;
}

function createTourState() {
  return {
    active: false,
    currentStep: 0,
    steps: [],
    animating: false,
  };
}

function advanceTour(tourState, direction) {
  if (tourState.animating) return tourState;
  var newStep = tourState.currentStep + direction;
  if (newStep < 0 || newStep >= tourState.steps.length) return tourState;
  tourState.currentStep = newStep;
  return tourState;
}

// Ease-in-out cubic
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Camera animation helper (requires THREE in browser)
function animateCamera(camera, controls, fromPos, toPos, fromTarget, toTarget, duration, onComplete) {
  var startTime = null;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var elapsed = timestamp - startTime;
    var t = Math.min(elapsed / duration, 1);
    var eased = easeInOutCubic(t);

    camera.position.x = fromPos.x + (toPos.x - fromPos.x) * eased;
    camera.position.y = fromPos.y + (toPos.y - fromPos.y) * eased;
    camera.position.z = fromPos.z + (toPos.z - fromPos.z) * eased;

    if (controls && controls.target) {
      controls.target.x = fromTarget.x + (toTarget.x - fromTarget.x) * eased;
      controls.target.y = fromTarget.y + (toTarget.y - fromTarget.y) * eased;
      controls.target.z = fromTarget.z + (toTarget.z - fromTarget.z) * eased;
      controls.update();
    }

    if (t < 1) {
      requestAnimationFrame(step);
    } else if (onComplete) {
      onComplete();
    }
  }

  requestAnimationFrame(step);
}

// Make available globally (browser) and for Node require
if (typeof module !== "undefined" && module.exports) {
  module.exports = { createTourSteps, createTourState, advanceTour, easeInOutCubic };
}
