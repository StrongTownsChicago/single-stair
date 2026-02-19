// Single Stair Visualizer -- 3D Viewer
// Three.js scene management, building construction, materials, labels
// Post-processing, physical materials, geometry detail, CSS2D labels

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildMeshData } from './mesh.js';
import { createTourSteps, createTourState, advanceTour, animateCamera } from './tour.js';

// Module-level state (reused across re-renders to avoid WebGL context leaks)
var _renderer = null;
var _composer = null;
var _labelRenderer = null;
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
  windowEdge: 0xD4A843,  // Warm gold
  edge: 0x6E6A64,        // Architectural edge lines
  window: 0x4A6B8A,      // Glass blue-grey
};

var MATERIAL_OPACITY = {
  unit: 1.0,
  staircase: 1.0,
  hallway: 0.92,
  slab: 1.0,
};

var MATERIAL_ROUGHNESS = {
  unit: 0.85,
  staircase: 0.72,
  hallway: 0.90,
  slab: 0.95,
};

// Material cache to reduce draw calls
var _materialCache = {};
var _edgeMaterialCache = null;
var _windowMaterialCache = null;

function getMaterial(type) {
  if (_materialCache[type]) return _materialCache[type];

  var color = MATERIAL_COLORS[type] || 0xF0EBE1;
  var opacity = MATERIAL_OPACITY[type] || 1.0;
  var roughness = MATERIAL_ROUGHNESS[type] || 0.8;
  var transparent = opacity < 1.0;

  // Physical materials with clearcoat for architectural sheen
  var matProps = {
    color: color,
    roughness: roughness,
    metalness: 0.02,
    transparent: transparent,
    opacity: opacity,
  };

  if (type === "unit") {
    matProps.clearcoat = 0.05;
    matProps.clearcoatRoughness = 0.4;
    matProps.envMapIntensity = 0.3;
  } else if (type === "staircase") {
    matProps.clearcoat = 0.1;
    matProps.clearcoatRoughness = 0.3;
    matProps.envMapIntensity = 0.3;
  } else if (type === "hallway") {
    matProps.envMapIntensity = 0.2;
  } else if (type === "slab") {
    matProps.clearcoat = 0.02;
    matProps.clearcoatRoughness = 0.8;
    matProps.envMapIntensity = 0.2;
  }

  var mat = new THREE.MeshPhysicalMaterial(matProps);

  // Prevent z-fighting where staircase overlaps unit geometry
  if (type === "staircase") {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -1;
  }

  _materialCache[type] = mat;
  return mat;
}

function getWindowMaterial() {
  if (_windowMaterialCache) return _windowMaterialCache;
  _windowMaterialCache = new THREE.MeshPhysicalMaterial({
    color: MATERIAL_COLORS.window,
    roughness: 0.1,
    metalness: 0.3,
    envMapIntensity: 0.8,
    transparent: true,
    opacity: 0.7,
  });
  return _windowMaterialCache;
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

function createLabel(text, color) {
  var div = document.createElement("div");
  div.textContent = text;
  div.style.cssText = "font-family:'Instrument Sans',sans-serif;font-weight:700;font-size:14px;color:" + (color || "#fff") + ";text-shadow:0 2px 8px rgba(0,0,0,0.7),0 0 20px rgba(0,0,0,0.5);pointer-events:none;white-space:nowrap;letter-spacing:0.04em;";
  var label = new CSS2DObject(div);
  return label;
}

function addWindowInsets(group, meshDesc, centerX, centerZ) {
  if (!meshDesc.windowWalls || meshDesc.windowWalls.length === 0) return;

  var winMat = getWindowMaterial();
  var INSET = 0.15;
  var WIN_W = 2.5;
  var WIN_H = 4;
  var WIN_D = 0.3;
  var yBase = meshDesc.y + (meshDesc.height - WIN_H) / 2;

  for (var w = 0; w < meshDesc.windowWalls.length; w++) {
    var wall = meshDesc.windowWalls[w];
    var wallLen, numWindows;

    if (wall === "north" || wall === "south") {
      wallLen = meshDesc.width;
    } else {
      wallLen = meshDesc.depth;
    }

    numWindows = Math.max(1, Math.floor(wallLen / 8));
    var spacing = wallLen / (numWindows + 1);

    for (var n = 0; n < numWindows; n++) {
      var winGeo = new THREE.BoxGeometry(
        (wall === "east" || wall === "west") ? WIN_D : WIN_W,
        WIN_H,
        (wall === "north" || wall === "south") ? WIN_D : WIN_W
      );
      var winMesh = new THREE.Mesh(winGeo, winMat);

      var offset = spacing * (n + 1);
      var px, py, pz;
      py = yBase + WIN_H / 2;

      if (wall === "north") {
        px = meshDesc.x + offset - centerX;
        pz = meshDesc.z - INSET - centerZ;
      } else if (wall === "south") {
        px = meshDesc.x + offset - centerX;
        pz = meshDesc.z + meshDesc.depth + INSET - centerZ;
      } else if (wall === "east") {
        px = meshDesc.x + meshDesc.width + INSET - centerX;
        pz = meshDesc.z + offset - centerZ;
      } else if (wall === "west") {
        px = meshDesc.x - INSET - centerX;
        pz = meshDesc.z + offset - centerZ;
      } else {
        continue;
      }

      winMesh.position.set(px, py, pz);
      group.add(winMesh);
    }
  }
}

function addRoofParapets(group, meshDesc, centerX, centerZ) {
  var PARAPET_H = 1.5;
  var PARAPET_T = 0.4;
  var slabMat = getMaterial("slab");
  var topY = meshDesc.y + meshDesc.height + PARAPET_H / 2;

  // North wall
  var nGeo = new THREE.BoxGeometry(meshDesc.width, PARAPET_H, PARAPET_T);
  var nMesh = new THREE.Mesh(nGeo, slabMat);
  nMesh.position.set(
    meshDesc.x + meshDesc.width / 2 - centerX,
    topY,
    meshDesc.z - PARAPET_T / 2 - centerZ
  );
  nMesh.castShadow = true;
  group.add(nMesh);

  // South wall
  var sMesh = new THREE.Mesh(nGeo, slabMat);
  sMesh.position.set(
    meshDesc.x + meshDesc.width / 2 - centerX,
    topY,
    meshDesc.z + meshDesc.depth + PARAPET_T / 2 - centerZ
  );
  sMesh.castShadow = true;
  group.add(sMesh);

  // East wall
  var eGeo = new THREE.BoxGeometry(PARAPET_T, PARAPET_H, meshDesc.depth + PARAPET_T * 2);
  var eMesh = new THREE.Mesh(eGeo, slabMat);
  eMesh.position.set(
    meshDesc.x + meshDesc.width + PARAPET_T / 2 - centerX,
    topY,
    meshDesc.z + meshDesc.depth / 2 - centerZ
  );
  eMesh.castShadow = true;
  group.add(eMesh);

  // West wall
  var wMesh = new THREE.Mesh(eGeo, slabMat);
  wMesh.position.set(
    meshDesc.x - PARAPET_T / 2 - centerX,
    topY,
    meshDesc.z + meshDesc.depth / 2 - centerZ
  );
  wMesh.castShadow = true;
  group.add(wMesh);
}

function addStairIndication(group, meshDesc, centerX, centerZ) {
  var lineMat = new THREE.LineBasicMaterial({
    color: 0xFFFFFF,
    transparent: true,
    opacity: 0.3,
  });

  var numRuns = Math.floor(meshDesc.height / 10);
  var runHeight = meshDesc.height / numRuns;

  for (var r = 0; r < numRuns; r++) {
    var yStart = meshDesc.y + r * runHeight;
    var yEnd = yStart + runHeight;
    var numSteps = 5;

    var points = [];
    for (var s = 0; s <= numSteps; s++) {
      var t = s / numSteps;
      points.push(new THREE.Vector3(
        meshDesc.x + meshDesc.width * 0.2 - centerX,
        yStart + (yEnd - yStart) * t,
        meshDesc.z + meshDesc.depth * (0.15 + 0.7 * t) - centerZ
      ));
    }

    var geo = new THREE.BufferGeometry().setFromPoints(points);
    var line = new THREE.Line(geo, lineMat);
    group.add(line);
  }
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

    var geometry = new THREE.BoxGeometry(meshDesc.width, meshDesc.height, meshDesc.depth);
    var material = getMaterial(meshDesc.type);
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

    // Window insets on unit exterior walls
    if (meshDesc.type === "unit" && meshDesc.windowWalls) {
      addWindowInsets(group, meshDesc, centerX, centerZ);
    }

    // Roof parapets on top floor units
    if (meshDesc.type === "unit" && meshDesc.isTopFloor) {
      addRoofParapets(group, meshDesc, centerX, centerZ);
    }

    // Staircase diagonal indication
    if (meshDesc.type === "staircase") {
      addStairIndication(group, meshDesc, centerX, centerZ);
    }
  }

  // Add CSS2D label above the building
  if (label) {
    var labelColor = label === "Current Code" ? "#E07A5A" : "#5BBF82";
    var labelObj = createLabel(label, labelColor);
    labelObj.position.set(0, maxY + 5, 0);
    group.add(labelObj);
  }

  return group;
}

function addGroundPlane(scene, width, depth) {
  var planeSize = Math.max(width, depth) * 6;

  // Visible dark ground surface
  var groundGeo = new THREE.PlaneGeometry(planeSize, planeSize);
  var groundMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a1e28,
    roughness: 0.95,
    metalness: 0.0,
  });
  var groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = -0.15;
  groundPlane.receiveShadow = true;
  scene.add(groundPlane);

  // Shadow-only plane slightly above ground for softer contact shadows
  var shadowGeo = new THREE.PlaneGeometry(planeSize, planeSize);
  var shadowMat = new THREE.ShadowMaterial({ opacity: 0.35 });
  var shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.02;
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

function renderFrame() {
  if (_composer) {
    _composer.render();
  } else if (_renderer && _scene && _camera) {
    _renderer.render(_scene, _camera);
  }
  if (_labelRenderer && _scene && _camera) {
    _labelRenderer.render(_scene, _camera);
  }
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
    // Disable built-in antialias since SMAA handles it via post-processing
    _renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(_renderer.domElement);

    // Shadow configuration
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type = THREE.PCFShadowMap;

    // Tone mapping for cinematic color
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.0;
    _renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  _renderer.setSize(width, height);

  // ── CSS2D Label Renderer ────────────────────────────────────────────────
  if (!_labelRenderer) {
    _labelRenderer = new CSS2DRenderer();
    _labelRenderer.domElement.style.position = "absolute";
    _labelRenderer.domElement.style.top = "0";
    _labelRenderer.domElement.style.left = "0";
    _labelRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(_labelRenderer.domElement);
  }
  _labelRenderer.setSize(width, height);

  // ── Environment Map ─────────────────────────────────────────────────────
  var pmremGenerator = new THREE.PMREMGenerator(_renderer);
  var envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envMap;
  scene.environmentIntensity = 0.3;
  pmremGenerator.dispose();

  // ── Post-Processing Pipeline ────────────────────────────────────────────
  _composer = new EffectComposer(_renderer);

  // 1. RenderPass — renders scene to framebuffer
  var renderPass = new RenderPass(scene, camera);
  _composer.addPass(renderPass);

  // 2. UnrealBloomPass — very subtle warm glow
  var bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.15,  // strength
    0.4,   // radius
    0.85   // threshold
  );
  _composer.addPass(bloomPass);

  // 3. SMAAPass — anti-aliasing (replaces built-in MSAA)
  var smaaPass = new SMAAPass(width * _renderer.getPixelRatio(), height * _renderer.getPixelRatio());
  _composer.addPass(smaaPass);

  // 4. OutputPass — required for correct tone mapping with post-processing (must be last)
  var outputPass = new OutputPass();
  _composer.addPass(outputPass);

  // ── Lighting ──────────────────────────────────────────────────────────────

  // Initialize RectAreaLight uniforms
  RectAreaLightUniformsLib.init();

  // Hemisphere light: warm sky, cool ground — natural ambient
  var hemiLight = new THREE.HemisphereLight(0xF5E6D0, 0x3A4050, 0.55);
  scene.add(hemiLight);

  // Key directional light (warm) with shadows — reduced since env map compensates
  var keyLight = new THREE.DirectionalLight(0xFFF4E6, 0.6);
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
  var fillLight = new THREE.DirectionalLight(0xB0C4DE, 0.2);
  fillLight.position.set(-40, 50, -30);
  scene.add(fillLight);

  // Rim / back light — subtle edge definition
  var rimLight = new THREE.DirectionalLight(0xE8DCD0, 0.15);
  rimLight.position.set(-20, 30, 80);
  scene.add(rimLight);

  // RectAreaLight — soft overhead architectural light
  var rectLight = new THREE.RectAreaLight(0xFFF4E6, 2.0, 80, 80);
  rectLight.position.set(0, 60, 0);
  rectLight.lookAt(0, 0, 0);
  scene.add(rectLight);

  // OrbitControls
  var controls = new OrbitControls(camera, _renderer.domElement);
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
    // Remove CSS2DObject DOM elements so labels don't accumulate
    if (obj instanceof CSS2DObject && obj.element && obj.element.parentNode) {
      obj.element.parentNode.removeChild(obj.element);
    }
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(function (m) {
          if (m.map) m.map.dispose();
          if (m.clearcoatMap) m.clearcoatMap.dispose();
          if (m.clearcoatRoughnessMap) m.clearcoatRoughnessMap.dispose();
          m.dispose();
        });
      } else {
        if (obj.material.map) obj.material.map.dispose();
        if (obj.material.clearcoatMap) obj.material.clearcoatMap.dispose();
        if (obj.material.clearcoatRoughnessMap) obj.material.clearcoatRoughnessMap.dispose();
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
    renderFrame();
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
    renderFrame();
    stopRenderLoop();
  }, 2000);
}

function renderBuildings(container, config) {
  // Check for WebGL support
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

  // Clear material cache
  _materialCache = {};
  _edgeMaterialCache = null;
  _windowMaterialCache = null;

  // Ensure container is visible and has dimensions
  container.style.display = "block";

  var result = setupScene(container);
  _scene = result.scene;
  _camera = result.camera;
  _controls = result.controls;

  renderStandardBuildings(_scene, _camera, config);

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
      if (_composer) _composer.setSize(w, h);
      if (_labelRenderer) _labelRenderer.setSize(w, h);
      renderFrame();
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
    renderFrame();
    stopRenderLoop();
  }, 2000);
}

function renderStandardBuildings(scene, camera, config) {
  var lotConfigs = {
    single: { buildableWidth: 20, buildableDepth: 80 },
    double: { buildableWidth: 45, buildableDepth: 80 },
  };
  var dims = lotConfigs[config.lot] || lotConfigs.single;
  var bw = dims.buildableWidth;
  var bd = dims.buildableDepth;

  var currentLayout = generateLayout({ lot: config.lot, stories: config.stories, stair: "current" });
  var reformLayout = generateLayout({ lot: config.lot, stories: config.stories, stair: "reform" });

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

// Tour integration
function startTour(config) {
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
    if (_composer) {
      _composer = null;
    }
    if (_renderer) {
      _renderer.dispose();
      _renderer = null;
    }
    if (_labelRenderer) {
      _labelRenderer = null;
    }
  });
}

export { renderBuildings, startTour, goToTourStep, endTour, getViewerState, stopRenderLoop, MATERIAL_COLORS, MATERIAL_OPACITY };
