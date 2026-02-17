// Single Stair Visualizer -- 3D Viewer
// Three.js scene management, building construction, materials, labels

// Module-level state (reused across re-renders to avoid WebGL context leaks)
var _renderer = null;
var _scene = null;
var _camera = null;
var _controls = null;
var _renderLoopActive = false;
var _idleTimeout = null;
var _resizeObserver = null;
var _animationFrameId = null;
var _tourState = null;

// ── Architectural color palette ─────────────────────────────────────────────
var MATERIAL_COLORS = {
  unit: 0xF0EBE1,        // Warm plaster / limestone
  staircase: 0xBF5B4B,   // Muted terracotta
  hallway: 0xC4B5A5,     // Warm taupe
  slab: 0xCCC7BF,        // Concrete
  commercial: 0x4FA393,   // Sage teal
  courtyard: 0x7AD4A0,   // Soft green
  windowEdge: 0xD4A843,  // Warm gold
  edge: 0x6E6A64,        // Architectural edge lines
};

var MATERIAL_OPACITY = {
  unit: 1.0,
  staircase: 1.0,
  hallway: 0.92,
  slab: 1.0,
  commercial: 1.0,
};

var MATERIAL_ROUGHNESS = {
  unit: 0.88,
  staircase: 0.72,
  hallway: 0.90,
  slab: 0.95,
  commercial: 0.68,
};

// Material cache to reduce draw calls
var _materialCache = {};
var _edgeMaterialCache = null;

function getMaterial(type) {
  if (_materialCache[type]) return _materialCache[type];

  var color = MATERIAL_COLORS[type] || 0xF0EBE1;
  var opacity = MATERIAL_OPACITY[type] || 1.0;
  var roughness = MATERIAL_ROUGHNESS[type] || 0.8;
  var transparent = opacity < 1.0;

  var mat = new THREE.MeshStandardMaterial({
    color: color,
    roughness: roughness,
    metalness: 0.02,
    transparent: transparent,
    opacity: opacity,
  });

  _materialCache[type] = mat;
  return mat;
}

function getEdgeMaterial() {
  if (_edgeMaterialCache) return _edgeMaterialCache;
  _edgeMaterialCache = new THREE.LineBasicMaterial({
    color: MATERIAL_COLORS.edge,
    transparent: true,
    opacity: 0.45,
  });
  return _edgeMaterialCache;
}

function addEdgeLines(group, geometry, position) {
  var edgesGeo = new THREE.EdgesGeometry(geometry);
  var edgeLines = new THREE.LineSegments(edgesGeo, getEdgeMaterial());
  edgeLines.position.copy(position);
  group.add(edgeLines);
}

function createTextSprite(text, color) {
  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d");
  canvas.width = 512;
  canvas.height = 64;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color || "#FFFFFF";
  ctx.font = "bold 36px 'Instrument Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 32);

  var texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  var material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  var sprite = new THREE.Sprite(material);
  sprite.scale.set(20, 2.5, 1);
  return sprite;
}

function buildBuildingGroup(meshData, label) {
  var group = new THREE.Group();

  // Deduplicate staircase meshes: only render those from floorLevel 0
  var dedupedMeshes = meshData.filter(function (m) {
    return m.type !== "staircase" || m.floorLevel === 0;
  });

  // Calculate building center for proper positioning
  var minX = Infinity, maxX = -Infinity;
  var minZ = Infinity, maxZ = -Infinity;
  var maxY = 0;
  for (var i = 0; i < dedupedMeshes.length; i++) {
    var m = dedupedMeshes[i];
    if (m.x < minX) minX = m.x;
    if (m.x + m.width > maxX) maxX = m.x + m.width;
    if (m.z < minZ) minZ = m.z;
    if (m.z + m.depth > maxZ) maxZ = m.z + m.depth;
    if (m.y + m.height > maxY) maxY = m.y + m.height;
  }
  var centerX = (minX + maxX) / 2;
  var centerZ = (minZ + maxZ) / 2;

  for (var i = 0; i < dedupedMeshes.length; i++) {
    var meshDesc = dedupedMeshes[i];
    var materialType = meshDesc.type;
    if (meshDesc.type === "unit" && meshDesc.unitType === "commercial") {
      materialType = "commercial";
    }

    var geometry = new THREE.BoxGeometry(meshDesc.width, meshDesc.height, meshDesc.depth);
    var material = getMaterial(materialType);
    var mesh = new THREE.Mesh(geometry, material);

    // Position: center of the box in Three.js coordinates
    mesh.position.set(
      meshDesc.x + meshDesc.width / 2 - centerX,
      meshDesc.y + meshDesc.height / 2,
      meshDesc.z + meshDesc.depth / 2 - centerZ
    );

    // Enable shadows
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.userData = {
      type: meshDesc.type,
      unitType: meshDesc.unitType,
      floorLevel: meshDesc.floorLevel,
      unitId: meshDesc.unitId,
    };

    group.add(mesh);

    // Architectural edge lines (skip slabs — too thin, would be noisy)
    if (meshDesc.type !== "slab") {
      addEdgeLines(group, geometry, mesh.position);
    }

    // Add window wall edge highlights for unit meshes
    if (meshDesc.type === "unit" && meshDesc.windowWalls && meshDesc.windowWalls.length > 0) {
      addWindowEdges(group, meshDesc, centerX, centerZ);
    }
  }

  // Add label sprite above the building
  if (label && typeof createTextSprite === "function") {
    var labelColor = label === "Current Code" ? "#E07A5A" : "#5BBF82";
    var sprite = createTextSprite(label, labelColor);
    sprite.position.set(0, maxY + 5, 0);
    group.add(sprite);
  }

  return group;
}

function addWindowEdges(group, meshDesc, centerX, centerZ) {
  var edgeMaterial = new THREE.LineBasicMaterial({
    color: MATERIAL_COLORS.windowEdge,
    linewidth: 2,
  });

  for (var w = 0; w < meshDesc.windowWalls.length; w++) {
    var wall = meshDesc.windowWalls[w];
    var points = [];
    var x = meshDesc.x - centerX;
    var y = meshDesc.y;
    var z = meshDesc.z - centerZ;
    var width = meshDesc.width;
    var height = meshDesc.height;
    var depth = meshDesc.depth;

    switch (wall) {
      case "north":
        points.push(new THREE.Vector3(x, y, z));
        points.push(new THREE.Vector3(x + width, y, z));
        points.push(new THREE.Vector3(x + width, y + height, z));
        points.push(new THREE.Vector3(x, y + height, z));
        points.push(new THREE.Vector3(x, y, z));
        break;
      case "south":
        points.push(new THREE.Vector3(x, y, z + depth));
        points.push(new THREE.Vector3(x + width, y, z + depth));
        points.push(new THREE.Vector3(x + width, y + height, z + depth));
        points.push(new THREE.Vector3(x, y + height, z + depth));
        points.push(new THREE.Vector3(x, y, z + depth));
        break;
      case "east":
        points.push(new THREE.Vector3(x + width, y, z));
        points.push(new THREE.Vector3(x + width, y, z + depth));
        points.push(new THREE.Vector3(x + width, y + height, z + depth));
        points.push(new THREE.Vector3(x + width, y + height, z));
        points.push(new THREE.Vector3(x + width, y, z));
        break;
      case "west":
        points.push(new THREE.Vector3(x, y, z));
        points.push(new THREE.Vector3(x, y, z + depth));
        points.push(new THREE.Vector3(x, y + height, z + depth));
        points.push(new THREE.Vector3(x, y + height, z));
        points.push(new THREE.Vector3(x, y, z));
        break;
      default:
        continue;
    }

    if (points.length > 0) {
      var geometry = new THREE.BufferGeometry().setFromPoints(points);
      var line = new THREE.Line(geometry, edgeMaterial);
      group.add(line);
    }
  }
}

function addGroundPlane(scene, width, depth) {
  var planeSize = Math.max(width, depth) * 6;

  // Shadow-only ground — invisible except where shadows fall, blends perfectly
  var shadowGeo = new THREE.PlaneGeometry(planeSize, planeSize);
  var shadowMat = new THREE.ShadowMaterial({ opacity: 0.5 });
  var shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.1;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // Subtle grid — very faint architectural reference lines
  var gridSize = Math.max(width, depth) * 2;
  var gridDivisions = Math.round(gridSize / 10);
  var gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x2A2E38, 0x20242E);
  gridHelper.position.y = -0.05;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.25;
  scene.add(gridHelper);
}

function setupScene(container) {
  var width = container.clientWidth;
  var height = container.clientHeight;

  // Scene
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141820);

  // Atmospheric fog (matches background, fades distant elements)
  scene.fog = new THREE.FogExp2(0x141820, 0.005);

  // Camera
  var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

  // Renderer (reuse if exists to avoid WebGL context leaks)
  if (!_renderer) {
    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(_renderer.domElement);

    // Shadow configuration
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Tone mapping for cinematic color
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.0;
    _renderer.outputEncoding = THREE.sRGBEncoding;
  }
  _renderer.setSize(width, height);

  // ── Lighting ──────────────────────────────────────────────────────────────

  // Hemisphere light: warm sky, cool ground — natural ambient
  var hemiLight = new THREE.HemisphereLight(0xF5E6D0, 0x3A4050, 0.55);
  scene.add(hemiLight);

  // Key directional light (warm) with shadows
  var keyLight = new THREE.DirectionalLight(0xFFF4E6, 0.85);
  keyLight.position.set(50, 80, 60);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 300;
  keyLight.shadow.camera.left = -120;
  keyLight.shadow.camera.right = 120;
  keyLight.shadow.camera.top = 120;
  keyLight.shadow.camera.bottom = -120;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  // Fill light (cool) — softer, from opposite side
  var fillLight = new THREE.DirectionalLight(0xB0C4DE, 0.3);
  fillLight.position.set(-40, 50, -30);
  scene.add(fillLight);

  // Rim / back light — subtle edge definition
  var rimLight = new THREE.DirectionalLight(0xE8DCD0, 0.2);
  rimLight.position.set(-20, 30, 80);
  scene.add(rimLight);

  // OrbitControls
  var controls = new THREE.OrbitControls(camera, _renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.maxPolarAngle = Math.PI / 2.05; // Prevent going below ground
  controls.minDistance = 10;
  controls.maxDistance = 500;

  return { scene: scene, camera: camera, controls: controls };
}

function disposeScene(scene) {
  if (!scene) return;
  scene.traverse(function (obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(function (m) {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      } else {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    }
  });
  // Clear children
  while (scene.children.length > 0) {
    scene.remove(scene.children[0]);
  }
}

function startRenderLoop(scene, camera, controls) {
  if (_renderLoopActive) return;
  _renderLoopActive = true;

  function animate() {
    if (!_renderLoopActive) return;
    _animationFrameId = requestAnimationFrame(animate);
    controls.update();
    _renderer.render(scene, camera);
  }
  animate();
}

function stopRenderLoop() {
  _renderLoopActive = false;
  if (_animationFrameId) {
    cancelAnimationFrame(_animationFrameId);
    _animationFrameId = null;
  }
}

function onControlsInteraction(scene, camera, controls) {
  clearTimeout(_idleTimeout);
  startRenderLoop(scene, camera, controls);
  _idleTimeout = setTimeout(function () {
    // Render one last frame then stop
    if (_renderer) _renderer.render(scene, camera);
    stopRenderLoop();
  }, 2000);
}

function renderBuildings(container, config) {
  // Check for WebGL support
  if (typeof THREE === "undefined") {
    container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-muted)">3D view requires Three.js. Please check your connection.</p>';
    return;
  }

  try {
    var testCanvas = document.createElement("canvas");
    var gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
    if (!gl) {
      container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-muted)">3D view requires WebGL. Please use a modern browser.</p>';
      return;
    }
  } catch (e) {
    container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-muted)">3D view requires WebGL. Please use a modern browser.</p>';
    return;
  }

  // Stop any existing render loop
  stopRenderLoop();

  // Dispose previous scene
  if (_scene) {
    disposeScene(_scene);
  }

  // Clear material cache (sprites have unique textures)
  _materialCache = {};
  _edgeMaterialCache = null;

  // Ensure container is visible and has dimensions
  container.style.display = "block";

  var buildingType = config.buildingType || "standard";
  var isCourtyardMode = buildingType === "L" || buildingType === "U";

  var result = setupScene(container);
  _scene = result.scene;
  _camera = result.camera;
  _controls = result.controls;

  if (isCourtyardMode) {
    renderCourtyardBuilding(_scene, _camera, config, buildingType);
  } else {
    renderStandardBuildings(_scene, _camera, config);
  }

  // Ground plane
  var bw = 80; // default
  var bd = 80;
  addGroundPlane(_scene, bw, bd);

  // Set up resize observer
  if (_resizeObserver) _resizeObserver.disconnect();
  _resizeObserver = new ResizeObserver(function () {
    var w = container.clientWidth;
    var h = container.clientHeight;
    if (w > 0 && h > 0) {
      _camera.aspect = w / h;
      _camera.updateProjectionMatrix();
      _renderer.setSize(w, h);
      _renderer.render(_scene, _camera);
    }
  });
  _resizeObserver.observe(container);

  // Hybrid render loop: active on interaction, idle after 2s
  _controls.addEventListener("change", function () {
    onControlsInteraction(_scene, _camera, _controls);
  });

  // Pause when tab is hidden
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopRenderLoop();
    }
  });

  // Initial render burst (for smooth first interaction)
  startRenderLoop(_scene, _camera, _controls);
  _idleTimeout = setTimeout(function () {
    if (_renderer) _renderer.render(_scene, _camera);
    stopRenderLoop();
  }, 2000);
}

function renderStandardBuildings(scene, camera, config) {
  var lotConfigs = {
    single: { buildableWidth: 20, buildableDepth: 80 },
    double: { buildableWidth: 45, buildableDepth: 80 },
    corner: { buildableWidth: 22.5, buildableDepth: 80 },
  };
  var dims = lotConfigs[config.lot] || lotConfigs.single;
  var bw = dims.buildableWidth;
  var bd = dims.buildableDepth;

  var currentLayout = generateLayout({ lot: config.lot, stories: config.stories, stair: "current", ground: config.ground });
  var reformLayout = generateLayout({ lot: config.lot, stories: config.stories, stair: "reform", ground: config.ground });

  var currentMeshData = buildMeshData(currentLayout);
  var reformMeshData = buildMeshData(reformLayout);

  var currentGroup = buildBuildingGroup(currentMeshData, "Current Code");
  var reformGroup = buildBuildingGroup(reformMeshData, "Reform");

  // Position side-by-side
  var gap = bw * 1.5;
  currentGroup.position.x = -(bw / 2 + gap / 2);
  reformGroup.position.x = bw / 2 + gap / 2;

  scene.add(currentGroup);
  scene.add(reformGroup);

  // Position camera for 3/4 aerial view
  var totalHeight = config.stories * 10;
  camera.position.set(bw * 2, totalHeight * 1.5, bd * 1.2);
  camera.lookAt(0, totalHeight / 3, 0);
  _controls.target.set(0, totalHeight / 3, 0);
  _controls.update();
}

function renderCourtyardBuilding(scene, camera, config, buildingType) {
  var cyLayout = generateCourtyardLayout({ shape: buildingType, stories: config.stories, ground: config.ground });

  // Calculate bounding box for centering
  var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  var maxY = 0;

  for (var s = 0; s < cyLayout.segments.length; s++) {
    var seg = cyLayout.segments[s];
    for (var f = 0; f < seg.floors.length; f++) {
      var floor = seg.floors[f];
      for (var u = 0; u < floor.units.length; u++) {
        var unit = floor.units[u];
        if (unit.x < minX) minX = unit.x;
        if (unit.x + unit.w > maxX) maxX = unit.x + unit.w;
        if (unit.y < minZ) minZ = unit.y;
        if (unit.y + unit.d > maxZ) maxZ = unit.y + unit.d;
      }
      for (var st = 0; st < floor.staircases.length; st++) {
        var stair = floor.staircases[st];
        if (stair.x < minX) minX = stair.x;
        if (stair.x + stair.w > maxX) maxX = stair.x + stair.w;
        if (stair.y < minZ) minZ = stair.y;
        if (stair.y + stair.d > maxZ) maxZ = stair.y + stair.d;
      }
    }
  }

  var totalHeight = config.stories * 10;
  maxY = totalHeight;
  var centerX = (minX + maxX) / 2;
  var centerZ = (minZ + maxZ) / 2;
  var extentX = maxX - minX;
  var extentZ = maxZ - minZ;

  var courtyardGroup = new THREE.Group();

  // Build each segment
  for (var s = 0; s < cyLayout.segments.length; s++) {
    var seg = cyLayout.segments[s];
    var segMeshes = buildCourtyardSegmentMeshes(seg, config.stories, config.ground);

    for (var m = 0; m < segMeshes.length; m++) {
      var meshDesc = segMeshes[m];
      var materialType = meshDesc.type;
      if (meshDesc.type === "unit" && meshDesc.unitType === "commercial") {
        materialType = "commercial";
      }

      var geometry = new THREE.BoxGeometry(meshDesc.width, meshDesc.height, meshDesc.depth);
      var material = getMaterial(materialType);
      var mesh = new THREE.Mesh(geometry, material);

      mesh.position.set(
        meshDesc.x + meshDesc.width / 2 - centerX,
        meshDesc.y + meshDesc.height / 2,
        meshDesc.z + meshDesc.depth / 2 - centerZ
      );

      // Enable shadows
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      courtyardGroup.add(mesh);

      // Architectural edge lines (skip slabs)
      if (meshDesc.type !== "slab") {
        addEdgeLines(courtyardGroup, geometry, mesh.position);
      }
    }
  }

  // Courtyard ground plane (green)
  var cb = cyLayout.courtyard.bounds;
  var cyGeometry = new THREE.PlaneGeometry(cb.w, cb.d);
  var cyMaterial = new THREE.MeshStandardMaterial({
    color: MATERIAL_COLORS.courtyard,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 0.4,
  });
  var cyPlane = new THREE.Mesh(cyGeometry, cyMaterial);
  cyPlane.rotation.x = -Math.PI / 2;
  cyPlane.position.set(
    cb.x + cb.w / 2 - centerX,
    0.1,
    cb.y + cb.d / 2 - centerZ
  );
  cyPlane.receiveShadow = true;
  courtyardGroup.add(cyPlane);

  // Label
  var shapeLabel = buildingType === "L" ? "L-Shape Courtyard" : "U-Shape Courtyard";
  var sprite = createTextSprite(shapeLabel, "#5BBF82");
  sprite.position.set(0, maxY + 5, 0);
  courtyardGroup.add(sprite);

  scene.add(courtyardGroup);

  // Camera position
  var maxExtent = Math.max(extentX, extentZ);
  camera.position.set(maxExtent * 0.8, totalHeight * 2, maxExtent * 1.2);
  camera.lookAt(0, totalHeight / 3, 0);
  _controls.target.set(0, totalHeight / 3, 0);
  _controls.update();
}

function buildCourtyardSegmentMeshes(segment, stories, ground) {
  var meshes = [];
  var FLOOR_HEIGHT = 10;
  var COMMERCIAL_HEIGHT = 14;

  var currentY = 0;
  for (var i = 0; i < segment.floors.length; i++) {
    var floor = segment.floors[i];
    var isCommercialGround = i === 0 && floor.units.some(function (u) { return u.type === "commercial"; });
    var floorHeight = isCommercialGround ? COMMERCIAL_HEIGHT : FLOOR_HEIGHT;

    // Units
    for (var u = 0; u < floor.units.length; u++) {
      var unit = floor.units[u];
      meshes.push({
        type: "unit",
        x: unit.x,
        y: currentY,
        z: unit.y,
        width: unit.w,
        height: floorHeight,
        depth: unit.d,
        floorLevel: i,
        unitType: unit.type,
        windowWalls: unit.windowWalls,
      });
    }

    // Staircases (span full height, only emit once from floor 0)
    if (i === 0) {
      var totalHeight = 0;
      var tempY = 0;
      for (var fi = 0; fi < stories; fi++) {
        var fIsComm = fi === 0 && floor.units.some(function (u) { return u.type === "commercial"; });
        totalHeight += fIsComm ? COMMERCIAL_HEIGHT : FLOOR_HEIGHT;
      }

      for (var st = 0; st < floor.staircases.length; st++) {
        var stair = floor.staircases[st];
        meshes.push({
          type: "staircase",
          x: stair.x,
          y: 0,
          z: stair.y,
          width: stair.w,
          height: totalHeight,
          depth: stair.d,
          floorLevel: 0,
        });
      }
    }

    // Floor slab
    var allElements = floor.units.concat(floor.staircases);
    var slabMinX = Infinity, slabMaxX = -Infinity, slabMinZ = Infinity, slabMaxZ = -Infinity;
    for (var e = 0; e < allElements.length; e++) {
      var el = allElements[e];
      if (el.x < slabMinX) slabMinX = el.x;
      if ((el.x + el.w) > slabMaxX) slabMaxX = el.x + el.w;
      if (el.y < slabMinZ) slabMinZ = el.y;
      if ((el.y + el.d) > slabMaxZ) slabMaxZ = el.y + el.d;
    }

    meshes.push({
      type: "slab",
      x: slabMinX,
      y: currentY,
      z: slabMinZ,
      width: slabMaxX - slabMinX,
      height: 0.5,
      depth: slabMaxZ - slabMinZ,
      floorLevel: i,
    });

    currentY += floorHeight;
  }

  return meshes;
}

// Tour integration
function startTour(config) {
  if (typeof createTourSteps !== "function" || typeof createTourState !== "function") return null;

  _tourState = createTourState();
  _tourState.steps = createTourSteps(config);
  _tourState.active = true;
  _tourState.currentStep = 0;

  goToTourStep(0);
  return _tourState;
}

function goToTourStep(stepIndex) {
  if (!_tourState || !_tourState.steps[stepIndex]) return;
  if (!_camera || !_controls) return;

  var step = _tourState.steps[stepIndex];
  var fromPos = {
    x: _camera.position.x,
    y: _camera.position.y,
    z: _camera.position.z,
  };
  var fromTarget = {
    x: _controls.target.x,
    y: _controls.target.y,
    z: _controls.target.z,
  };

  _tourState.animating = true;
  _controls.enabled = false;

  // Keep render loop active during animation
  startRenderLoop(_scene, _camera, _controls);

  animateCamera(_camera, _controls, fromPos, step.cameraPosition, fromTarget, step.cameraTarget, 1500, function () {
    _tourState.animating = false;
    _controls.enabled = true;
    // Keep rendering for a bit after animation
    onControlsInteraction(_scene, _camera, _controls);
  });
}

function endTour() {
  if (_tourState) {
    _tourState.active = false;
    _tourState.currentStep = 0;
  }
  if (_controls) _controls.enabled = true;
}

function getViewerState() {
  return {
    scene: _scene,
    camera: _camera,
    controls: _controls,
    renderer: _renderer,
    tourState: _tourState,
  };
}

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", function () {
    stopRenderLoop();
    if (_resizeObserver) _resizeObserver.disconnect();
    if (_scene) disposeScene(_scene);
    if (_renderer) {
      _renderer.dispose();
      _renderer = null;
    }
  });
}

// Export for testing (node) and browser use
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MATERIAL_COLORS: MATERIAL_COLORS,
    MATERIAL_OPACITY: MATERIAL_OPACITY,
    buildBuildingGroup: buildBuildingGroup,
    buildCourtyardSegmentMeshes: buildCourtyardSegmentMeshes,
    disposeScene: disposeScene,
  };
}
