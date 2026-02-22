// Single Stair Visualizer -- 3D Viewer
// Three.js scene management, building construction, materials, labels
// Post-processing, physical materials, geometry detail, CSS2D labels
// Photorealistic Chicago buildings: brick facades, limestone trim, physical glass,
// golden-hour sky, GTAO, film grain, InstancedMesh windows

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildMeshData } from './mesh.js';
import { createTourSteps, createTourState, advanceTour, animateCamera } from './tour.js';
import { generateBrickTextures, generateLimestoneTextures, generateConcreteTextures, generateInteriorGlowMap, disposeTextures } from './textures.js';

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
var _gtaoPass = null;

// ── Architectural color palette ─────────────────────────────────────────────
var MATERIAL_COLORS = {
  unit: 0x8B4533,        // Brick terracotta (base, overridden by texture)
  staircase: 0xBF5B4B,   // Muted terracotta
  hallway: 0xC4B5A5,     // Warm taupe
  slab: 0xA0A0A0,        // Concrete grey
  limestone: 0xE8DCC8,   // Cream limestone
  mullion: 0x3A3530,     // Dark window frame
  glass: 0x4A6B8A,       // Glass blue-grey
  door: 0x2A1F1A,        // Dark door
};

var MATERIAL_OPACITY = {
  unit: 1.0,
  staircase: 1.0,
  hallway: 0.92,
  slab: 1.0,
};

var MATERIAL_ROUGHNESS = {
  unit: 0.80,
  staircase: 0.72,
  hallway: 0.90,
  slab: 0.92,
};

// Material cache to reduce draw calls
var _materialCache = {};
var _brickMaterialCache = null;
var _glassMaterialCache = null;
var _limestoneMaterialCache = null;
var _concreteMaterialCache = null;
var _mullionMaterialCache = null;
var _doorMaterialCache = null;

// ── UV Scaling ──────────────────────────────────────────────────────────────

function setWorldSpaceUVs(geometry, width, height, depth, texelScale) {
  var uv = geometry.getAttribute('uv');
  var pos = geometry.getAttribute('position');
  var normal = geometry.getAttribute('normal');

  for (var i = 0; i < uv.count; i++) {
    var nx = Math.abs(normal.getX(i));
    var ny = Math.abs(normal.getY(i));

    if (nx > 0.5) {
      // East/West faces: map Z -> U, Y -> V
      uv.setXY(i,
        (pos.getZ(i) + depth * 0.5) * texelScale,
        (pos.getY(i) + height * 0.5) * texelScale
      );
    } else if (ny > 0.5) {
      // Top/Bottom faces: map X -> U, Z -> V
      uv.setXY(i,
        (pos.getX(i) + width * 0.5) * texelScale,
        (pos.getZ(i) + depth * 0.5) * texelScale
      );
    } else {
      // North/South faces: map X -> U, Y -> V
      uv.setXY(i,
        (pos.getX(i) + width * 0.5) * texelScale,
        (pos.getY(i) + height * 0.5) * texelScale
      );
    }
  }
  uv.needsUpdate = true;
}

// ── Material Getters ────────────────────────────────────────────────────────

function getMaterial(type) {
  if (_materialCache[type]) return _materialCache[type];

  var color = MATERIAL_COLORS[type] || 0xC4B5A5;
  var opacity = MATERIAL_OPACITY[type] || 1.0;
  var roughness = MATERIAL_ROUGHNESS[type] || 0.8;
  var transparent = opacity < 1.0;

  var matProps = {
    color: color,
    roughness: roughness,
    metalness: 0.02,
    transparent: transparent,
    opacity: opacity,
  };

  if (type === "staircase") {
    matProps.clearcoat = 0.1;
    matProps.clearcoatRoughness = 0.3;
    matProps.envMapIntensity = 0.3;
  } else if (type === "hallway") {
    matProps.envMapIntensity = 0.2;
  }

  var mat = new THREE.MeshPhysicalMaterial(matProps);

  if (type === "staircase") {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -1;
  }

  _materialCache[type] = mat;
  return mat;
}

function getBrickMaterial() {
  if (_brickMaterialCache) return _brickMaterialCache;

  var brickTex = generateBrickTextures();
  _brickMaterialCache = new THREE.MeshPhysicalMaterial({
    map: brickTex.map,
    normalMap: brickTex.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: brickTex.roughnessMap,
    roughness: 0.8,
    aoMap: brickTex.aoMap,
    aoMapIntensity: 0.6,
    metalness: 0.0,
    sheen: 0.15,
    sheenColor: new THREE.Color(0x8B4533),
    sheenRoughness: 0.8,
    specularIntensity: 0.3,
    specularColor: new THREE.Color(0xCCC0B0),
    envMapIntensity: 0.25,
  });
  // aoMap reads from uv channel 0
  _brickMaterialCache.aoMap.channel = 0;

  return _brickMaterialCache;
}

function getGlassMaterial() {
  if (_glassMaterialCache) return _glassMaterialCache;

  var glowMap = generateInteriorGlowMap();
  _glassMaterialCache = new THREE.MeshPhysicalMaterial({
    transmission: 0.85,
    thickness: 0.5,
    ior: 1.5,
    roughness: 0.05,
    metalness: 0.0,
    attenuationColor: new THREE.Color(0xFFE8D0),
    attenuationDistance: 2.0,
    emissive: new THREE.Color(0xFFD080),
    emissiveIntensity: 0.15,
    emissiveMap: glowMap,
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xFFFFFF),
    envMapIntensity: 1.0,
    transparent: false,
    side: THREE.FrontSide,
  });

  return _glassMaterialCache;
}

function getLimestoneMaterial() {
  if (_limestoneMaterialCache) return _limestoneMaterialCache;

  var limeTex = generateLimestoneTextures();
  _limestoneMaterialCache = new THREE.MeshPhysicalMaterial({
    map: limeTex.map,
    normalMap: limeTex.normalMap,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughnessMap: limeTex.roughnessMap,
    roughness: 0.55,
    metalness: 0.0,
    specularIntensity: 0.5,
    specularColor: new THREE.Color(0xFFF8F0),
    envMapIntensity: 0.4,
    clearcoat: 0.05,
    clearcoatRoughness: 0.6,
    color: new THREE.Color(0xE8DCC8),
  });

  return _limestoneMaterialCache;
}

function getConcreteMaterial() {
  if (_concreteMaterialCache) return _concreteMaterialCache;

  var concTex = generateConcreteTextures();
  _concreteMaterialCache = new THREE.MeshPhysicalMaterial({
    map: concTex.map,
    normalMap: concTex.normalMap,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughnessMap: concTex.roughnessMap,
    roughness: 0.92,
    metalness: 0.0,
    envMapIntensity: 0.15,
    color: new THREE.Color(0xA0A0A0),
  });

  return _concreteMaterialCache;
}

function getMullionMaterial() {
  if (_mullionMaterialCache) return _mullionMaterialCache;

  _mullionMaterialCache = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x3A3530),
    roughness: 0.7,
    metalness: 0.1,
    envMapIntensity: 0.2,
  });

  return _mullionMaterialCache;
}

function getDoorMaterial() {
  if (_doorMaterialCache) return _doorMaterialCache;

  _doorMaterialCache = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x1A1412),
    roughness: 0.3,
    metalness: 0.1,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.4,
  });

  return _doorMaterialCache;
}

// ── Labels ──────────────────────────────────────────────────────────────────

function createLabel(text, color) {
  var div = document.createElement("div");
  div.textContent = text;
  div.style.cssText = "font-family:'Instrument Sans',sans-serif;font-weight:700;font-size:14px;color:" + (color || "#fff") + ";text-shadow:0 2px 8px rgba(0,0,0,0.7),0 0 20px rgba(0,0,0,0.5);pointer-events:none;white-space:nowrap;letter-spacing:0.04em;";
  var label = new CSS2DObject(div);
  return label;
}

// ── Window System (InstancedMesh) ───────────────────────────────────────────

function collectWindowPositions(windowDescs, meshDesc, centerX, centerZ, doorPositions) {
  if (!meshDesc.windowWalls || meshDesc.windowWalls.length === 0) return;

  var INSET = 0.2;
  var WIN_W = 2.5;
  var WIN_H = 4.0;
  var WIN_D = 0.3;
  var DOOR_SKIP_RADIUS = 2.5;
  var yBase = meshDesc.y + (meshDesc.height - WIN_H) / 2;

  for (var w = 0; w < meshDesc.windowWalls.length; w++) {
    var wall = meshDesc.windowWalls[w];
    var wallLen = (wall === "north" || wall === "south") ? meshDesc.width : meshDesc.depth;
    var numWindows = Math.max(1, Math.floor(wallLen / 8));
    var spacing = wallLen / (numWindows + 1);

    for (var n = 0; n < numWindows; n++) {
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

      // Skip ground-floor windows near any door position (proximity-based)
      var isDoorPosition = false;
      if (meshDesc.isGroundFloor && doorPositions) {
        var windowWorldX = meshDesc.x + offset;
        for (var di = 0; di < doorPositions.length; di++) {
          var dp = doorPositions[di];
          if (dp.face === wall && Math.abs(windowWorldX - dp.x) < DOOR_SKIP_RADIUS) {
            isDoorPosition = true;
            break;
          }
        }
      }

      if (!isDoorPosition) {
        windowDescs.push({
          px: px, py: py, pz: pz,
          winW: WIN_W, winH: WIN_H, winD: WIN_D,
          wall: wall
        });
      }
    }
  }
}

function addChicagoWindows(group, windowDescs, glassMat, limestoneMat, mullionMat) {
  var count = windowDescs.length;
  if (count === 0) return;

  var unitBox = new THREE.BoxGeometry(1, 1, 1);

  var glassIM = new THREE.InstancedMesh(unitBox, glassMat, count);
  var lintelIM = new THREE.InstancedMesh(unitBox.clone(), limestoneMat, count);
  var sillIM = new THREE.InstancedMesh(unitBox.clone(), limestoneMat, count);

  var dummy = new THREE.Object3D();

  for (var i = 0; i < count; i++) {
    var wd = windowDescs[i];
    var isEW = (wd.wall === "east" || wd.wall === "west");

    // Glass pane
    dummy.position.set(wd.px, wd.py, wd.pz);
    dummy.scale.set(
      isEW ? wd.winD : wd.winW,
      wd.winH,
      isEW ? wd.winW : wd.winD
    );
    dummy.updateMatrix();
    glassIM.setMatrixAt(i, dummy.matrix);

    // Lintel (above window)
    var LINTEL_H = 0.8;
    var LINTEL_EXTRA_W = 0.6;
    dummy.position.set(wd.px, wd.py + wd.winH / 2 + LINTEL_H / 2, wd.pz);
    dummy.scale.set(
      isEW ? wd.winD + 0.1 : wd.winW + LINTEL_EXTRA_W,
      LINTEL_H,
      isEW ? wd.winW + LINTEL_EXTRA_W : wd.winD + 0.1
    );
    dummy.updateMatrix();
    lintelIM.setMatrixAt(i, dummy.matrix);

    // Sill (below window, projecting outward)
    var SILL_H = 0.4;
    var SILL_EXTRA_W = 0.4;
    var SILL_PROJECT = 0.15;
    var sillPz = wd.pz, sillPx = wd.px;
    if (wd.wall === "north") sillPz -= SILL_PROJECT;
    else if (wd.wall === "south") sillPz += SILL_PROJECT;
    else if (wd.wall === "east") sillPx += SILL_PROJECT;
    else if (wd.wall === "west") sillPx -= SILL_PROJECT;

    dummy.position.set(sillPx, wd.py - wd.winH / 2 - SILL_H / 2, sillPz);
    dummy.scale.set(
      isEW ? wd.winD + 0.3 : wd.winW + SILL_EXTRA_W,
      SILL_H,
      isEW ? wd.winW + SILL_EXTRA_W : wd.winD + 0.3
    );
    dummy.updateMatrix();
    sillIM.setMatrixAt(i, dummy.matrix);
  }

  glassIM.instanceMatrix.needsUpdate = true;
  lintelIM.instanceMatrix.needsUpdate = true;
  sillIM.instanceMatrix.needsUpdate = true;

  glassIM.castShadow = false;
  glassIM.receiveShadow = false;
  lintelIM.castShadow = true;
  lintelIM.receiveShadow = true;
  sillIM.castShadow = true;
  sillIM.receiveShadow = true;

  group.add(glassIM);
  group.add(lintelIM);
  group.add(sillIM);
}

// ── Architectural Details ───────────────────────────────────────────────────

function addBeltCourses(group, dedupedMeshes, centerX, centerZ, limestoneMat) {
  var BELT_H = 0.6;
  var BELT_PROJECT = 0.15;
  var geos = [];

  for (var i = 0; i < dedupedMeshes.length; i++) {
    var m = dedupedMeshes[i];
    if (m.type !== "unit") continue;

    var cx = m.x + m.width / 2 - centerX;
    var cz = m.z + m.depth / 2 - centerZ;
    var baseY = m.y + BELT_H / 2;

    // North face
    var nGeo = new THREE.BoxGeometry(m.width + BELT_PROJECT * 2, BELT_H, BELT_PROJECT);
    nGeo.translate(cx, baseY, m.z - BELT_PROJECT / 2 - centerZ);
    geos.push(nGeo);

    // South face
    var sGeo = new THREE.BoxGeometry(m.width + BELT_PROJECT * 2, BELT_H, BELT_PROJECT);
    sGeo.translate(cx, baseY, m.z + m.depth + BELT_PROJECT / 2 - centerZ);
    geos.push(sGeo);

    // East face
    var eGeo = new THREE.BoxGeometry(BELT_PROJECT, BELT_H, m.depth + BELT_PROJECT * 2);
    eGeo.translate(m.x + m.width + BELT_PROJECT / 2 - centerX, baseY, cz);
    geos.push(eGeo);

    // West face
    var wGeo = new THREE.BoxGeometry(BELT_PROJECT, BELT_H, m.depth + BELT_PROJECT * 2);
    wGeo.translate(m.x - BELT_PROJECT / 2 - centerX, baseY, cz);
    geos.push(wGeo);
  }

  if (geos.length > 0) {
    var merged = mergeGeometries(geos, false);
    var mesh = new THREE.Mesh(merged, limestoneMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    geos.forEach(function (g) { g.dispose(); });
  }
}

function addCornice(group, meshDesc, centerX, centerZ, limestoneMat) {
  var topY = meshDesc.y + meshDesc.height;
  var cx = meshDesc.x + meshDesc.width / 2 - centerX;
  var cz = meshDesc.z + meshDesc.depth / 2 - centerZ;
  var geos = [];

  // Layer 1: Main cornice band (projects 1.2ft, 0.8ft tall)
  var MAIN_H = 0.8;
  var MAIN_PROJECT = 1.2;
  var mainW = meshDesc.width + MAIN_PROJECT * 2;
  var mainD = meshDesc.depth + MAIN_PROJECT * 2;
  var mainGeo = new THREE.BoxGeometry(mainW, MAIN_H, mainD);
  mainGeo.translate(cx, topY + MAIN_H / 2, cz);
  geos.push(mainGeo);

  // Layer 2: Soffit step (projects 0.8ft, 0.4ft tall, below main)
  var SOFFIT_H = 0.4;
  var SOFFIT_PROJECT = 0.8;
  var soffitW = meshDesc.width + SOFFIT_PROJECT * 2;
  var soffitD = meshDesc.depth + SOFFIT_PROJECT * 2;
  var soffitGeo = new THREE.BoxGeometry(soffitW, SOFFIT_H, soffitD);
  soffitGeo.translate(cx, topY - SOFFIT_H / 2, cz);
  geos.push(soffitGeo);

  var merged = mergeGeometries(geos, false);
  var mesh = new THREE.Mesh(merged, limestoneMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  geos.forEach(function (g) { g.dispose(); });

  // Layer 3: Dentil course (small blocks between soffit and main)
  var DENTIL_W = 0.5;
  var DENTIL_H = 0.6;
  var DENTIL_D = 0.4;
  var DENTIL_SPACING = 1.0;

  var northCount = Math.floor(meshDesc.width / DENTIL_SPACING);
  var eastCount = Math.floor(meshDesc.depth / DENTIL_SPACING);
  var totalDentils = (northCount + eastCount) * 2;

  if (totalDentils > 0) {
    var dentilGeo = new THREE.BoxGeometry(DENTIL_W, DENTIL_H, DENTIL_D);
    var dentilIM = new THREE.InstancedMesh(dentilGeo, limestoneMat, totalDentils);
    var dummy = new THREE.Object3D();
    var idx = 0;
    var dentilY = topY - SOFFIT_H - DENTIL_H / 2;

    // North face dentils
    for (var d = 0; d < northCount; d++) {
      var dx = meshDesc.x + (d + 0.5) * DENTIL_SPACING - centerX;
      dummy.position.set(dx, dentilY, meshDesc.z - SOFFIT_PROJECT / 2 - centerZ);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      dentilIM.setMatrixAt(idx++, dummy.matrix);
    }
    // South face dentils
    for (var d = 0; d < northCount; d++) {
      var dx = meshDesc.x + (d + 0.5) * DENTIL_SPACING - centerX;
      dummy.position.set(dx, dentilY, meshDesc.z + meshDesc.depth + SOFFIT_PROJECT / 2 - centerZ);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      dentilIM.setMatrixAt(idx++, dummy.matrix);
    }
    // East face dentils
    for (var d = 0; d < eastCount; d++) {
      var dz = meshDesc.z + (d + 0.5) * DENTIL_SPACING - centerZ;
      dummy.position.set(meshDesc.x + meshDesc.width + SOFFIT_PROJECT / 2 - centerX, dentilY, dz);
      dummy.scale.set(DENTIL_D / DENTIL_W, 1, DENTIL_W / DENTIL_D);
      dummy.updateMatrix();
      dentilIM.setMatrixAt(idx++, dummy.matrix);
    }
    // West face dentils
    for (var d = 0; d < eastCount; d++) {
      var dz = meshDesc.z + (d + 0.5) * DENTIL_SPACING - centerZ;
      dummy.position.set(meshDesc.x - SOFFIT_PROJECT / 2 - centerX, dentilY, dz);
      dummy.scale.set(DENTIL_D / DENTIL_W, 1, DENTIL_W / DENTIL_D);
      dummy.updateMatrix();
      dentilIM.setMatrixAt(idx++, dummy.matrix);
    }

    dentilIM.instanceMatrix.needsUpdate = true;
    dentilIM.castShadow = true;
    group.add(dentilIM);
  }
}

function addRoofParapetsWithCoping(group, meshDesc, centerX, centerZ) {
  var PARAPET_H = 1.5;
  var PARAPET_T = 0.4;
  var slabMat = getConcreteMaterial();
  var limestoneMat = getLimestoneMaterial();
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
  var sMesh = new THREE.Mesh(nGeo.clone(), slabMat);
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
  var wMesh = new THREE.Mesh(eGeo.clone(), slabMat);
  wMesh.position.set(
    meshDesc.x - PARAPET_T / 2 - centerX,
    topY,
    meshDesc.z + meshDesc.depth / 2 - centerZ
  );
  wMesh.castShadow = true;
  group.add(wMesh);

  // Limestone coping caps on top of each parapet wall
  var COPING_H = 0.25;
  var COPING_OVERHANG = 0.2;
  var copingY = meshDesc.y + meshDesc.height + PARAPET_H + COPING_H / 2;

  // North coping
  var ncGeo = new THREE.BoxGeometry(meshDesc.width + COPING_OVERHANG * 2, COPING_H, PARAPET_T + COPING_OVERHANG * 2);
  var ncMesh = new THREE.Mesh(ncGeo, limestoneMat);
  ncMesh.position.set(
    meshDesc.x + meshDesc.width / 2 - centerX,
    copingY,
    meshDesc.z - PARAPET_T / 2 - centerZ
  );
  ncMesh.castShadow = true;
  group.add(ncMesh);

  // South coping
  var scMesh = new THREE.Mesh(ncGeo.clone(), limestoneMat);
  scMesh.position.set(
    meshDesc.x + meshDesc.width / 2 - centerX,
    copingY,
    meshDesc.z + meshDesc.depth + PARAPET_T / 2 - centerZ
  );
  scMesh.castShadow = true;
  group.add(scMesh);

  // East coping
  var ecGeo = new THREE.BoxGeometry(PARAPET_T + COPING_OVERHANG * 2, COPING_H, meshDesc.depth + PARAPET_T * 2 + COPING_OVERHANG * 2);
  var ecMesh = new THREE.Mesh(ecGeo, limestoneMat);
  ecMesh.position.set(
    meshDesc.x + meshDesc.width + PARAPET_T / 2 - centerX,
    copingY,
    meshDesc.z + meshDesc.depth / 2 - centerZ
  );
  ecMesh.castShadow = true;
  group.add(ecMesh);

  // West coping
  var wcMesh = new THREE.Mesh(ecGeo.clone(), limestoneMat);
  wcMesh.position.set(
    meshDesc.x - PARAPET_T / 2 - centerX,
    copingY,
    meshDesc.z + meshDesc.depth / 2 - centerZ
  );
  wcMesh.castShadow = true;
  group.add(wcMesh);
}

function addEntryDoors(group, doorPositions, centerX, centerZ) {
  var DOOR_W = 3.5;
  var DOOR_H = 8.0;
  var DOOR_D = 0.3;
  var FRAME_W = 0.5;     // jamb width
  var FRAME_D = 0.4;     // jamb depth
  var LINTEL_H = 0.5;    // lintel height
  var TRANSOM_H = 1.5;   // transom glass height
  var MULLION_H = 0.15;  // divider bar height
  var MULLION_D = 0.2;   // divider bar depth

  var doorMat = getDoorMaterial();
  var limestoneMat = getLimestoneMaterial();
  var glassMat = getGlassMaterial();
  var mullionMat = getMullionMaterial();

  for (var i = 0; i < doorPositions.length; i++) {
    var dp = doorPositions[i];
    var isNorth = dp.face === "north";
    var sign = isNorth ? -1 : 1;

    var doorX = dp.x - centerX;
    var doorZ = dp.z - centerZ;

    // Door panel: recessed slightly from wall face
    var panelGeo = new THREE.BoxGeometry(DOOR_W, DOOR_H, DOOR_D);
    var panelMesh = new THREE.Mesh(panelGeo, doorMat);
    panelMesh.position.set(
      doorX,
      DOOR_H / 2,
      doorZ + sign * (DOOR_D / 2 + 0.1)
    );
    panelMesh.castShadow = true;
    panelMesh.receiveShadow = true;
    group.add(panelMesh);

    // Door frame: limestone jambs + lintel (merged into one mesh)
    var frameGeos = [];

    // Left jamb
    var leftJambGeo = new THREE.BoxGeometry(FRAME_W, DOOR_H + LINTEL_H + TRANSOM_H + MULLION_H, FRAME_D);
    leftJambGeo.translate(
      doorX - DOOR_W / 2 - FRAME_W / 2,
      (DOOR_H + LINTEL_H + TRANSOM_H + MULLION_H) / 2,
      doorZ + sign * (FRAME_D / 2)
    );
    frameGeos.push(leftJambGeo);

    // Right jamb
    var rightJambGeo = new THREE.BoxGeometry(FRAME_W, DOOR_H + LINTEL_H + TRANSOM_H + MULLION_H, FRAME_D);
    rightJambGeo.translate(
      doorX + DOOR_W / 2 + FRAME_W / 2,
      (DOOR_H + LINTEL_H + TRANSOM_H + MULLION_H) / 2,
      doorZ + sign * (FRAME_D / 2)
    );
    frameGeos.push(rightJambGeo);

    // Head lintel (above transom)
    var lintelGeo = new THREE.BoxGeometry(DOOR_W + FRAME_W * 2, LINTEL_H, FRAME_D);
    lintelGeo.translate(
      doorX,
      DOOR_H + MULLION_H + TRANSOM_H + LINTEL_H / 2,
      doorZ + sign * (FRAME_D / 2)
    );
    frameGeos.push(lintelGeo);

    var mergedFrame = mergeGeometries(frameGeos, false);
    var frameMesh = new THREE.Mesh(mergedFrame, limestoneMat);
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = true;
    group.add(frameMesh);
    frameGeos.forEach(function (g) { g.dispose(); });

    // Mullion bar: between door top and transom bottom
    var mullionGeo = new THREE.BoxGeometry(DOOR_W, MULLION_H, MULLION_D);
    var mullionMesh = new THREE.Mesh(mullionGeo, mullionMat);
    mullionMesh.position.set(
      doorX,
      DOOR_H + MULLION_H / 2,
      doorZ + sign * (MULLION_D / 2 + 0.05)
    );
    mullionMesh.castShadow = true;
    group.add(mullionMesh);

    // Transom window: glass pane above mullion
    var transomGeo = new THREE.BoxGeometry(DOOR_W, TRANSOM_H, 0.15);
    var transomMesh = new THREE.Mesh(transomGeo, glassMat);
    transomMesh.position.set(
      doorX,
      DOOR_H + MULLION_H + TRANSOM_H / 2,
      doorZ + sign * (0.15 / 2 + 0.05)
    );
    transomMesh.castShadow = false;
    transomMesh.receiveShadow = false;
    group.add(transomMesh);
  }
}

// ── Door Position Computation (pure function, no Three.js dependency) ────────

function computeDoorPositions(dedupedMeshes) {
  // 1. Compute building extents from non-slab meshes
  var minX = Infinity, maxX = -Infinity;
  var minZ = Infinity, maxZ = -Infinity;
  for (var i = 0; i < dedupedMeshes.length; i++) {
    var m = dedupedMeshes[i];
    if (m.type === "slab") continue;
    if (m.x < minX) minX = m.x;
    if (m.x + m.width > maxX) maxX = m.x + m.width;
    if (m.z < minZ) minZ = m.z;
    if (m.z + m.depth > maxZ) maxZ = m.z + m.depth;
  }

  // 2. Find ground-floor staircases
  var groundStairs = [];
  for (var i = 0; i < dedupedMeshes.length; i++) {
    var m = dedupedMeshes[i];
    if (m.type === "staircase" && m.floorLevel === 0) {
      groundStairs.push(m);
    }
  }

  // 3. Check which staircases touch building faces
  // NOTE: The camera faces the south side (z=maxZ), so the "front" entry door
  // goes on the south face. For hallway configs with a stair touching north,
  // we add a secondary rear door on the north face.
  var TOLERANCE = 0.5;
  var southDoor = null;
  var northDoor = null;

  for (var i = 0; i < groundStairs.length; i++) {
    var stair = groundStairs[i];
    var stairCenterX = stair.x + stair.width / 2;

    // Does this staircase touch the south face (z + depth = maxZ)? → front door
    if (Math.abs((stair.z + stair.depth) - maxZ) < TOLERANCE && !southDoor) {
      southDoor = { face: "south", x: stairCenterX, z: maxZ };
    }

    // Does this staircase touch the north face (z = minZ)? → rear door
    if (Math.abs(stair.z - minZ) < TOLERANCE && !northDoor) {
      northDoor = { face: "north", x: stairCenterX, z: minZ };
    }
  }

  // 4. Default: if no staircase touches south face, place front door at building x-center on south
  if (!southDoor) {
    southDoor = { face: "south", x: (minX + maxX) / 2, z: maxZ };
  }

  // 5. Build result array: front (south) door always present, rear (north) door for hallway configs
  var doors = [southDoor];
  if (northDoor) {
    doors.push(northDoor);
  }

  return doors;
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

// ── Building Group Construction ─────────────────────────────────────────────

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

  // Compute door positions from mesh data (before window collection for skip logic)
  var doorPositions = computeDoorPositions(dedupedMeshes);

  // Phase 1: Collect window positions across all units
  var windowDescs = [];

  // Phase 2: Build main meshes
  for (var i = 0; i < dedupedMeshes.length; i++) {
    var meshDesc = dedupedMeshes[i];

    var geometry = new THREE.BoxGeometry(meshDesc.width, meshDesc.height, meshDesc.depth);

    // Apply world-space UVs for brick texture on units
    if (meshDesc.type === "unit") {
      setWorldSpaceUVs(geometry, meshDesc.width, meshDesc.height, meshDesc.depth, 0.15);
      // Copy uv to uv1 for AO map
      geometry.setAttribute('uv1', geometry.getAttribute('uv').clone());
    }

    var material;
    if (meshDesc.type === "unit") {
      material = getBrickMaterial();
    } else if (meshDesc.type === "slab") {
      material = getConcreteMaterial();
    } else {
      material = getMaterial(meshDesc.type);
    }

    var mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(
      meshDesc.x + meshDesc.width / 2 - centerX,
      meshDesc.y + meshDesc.height / 2,
      meshDesc.z + meshDesc.depth / 2 - centerZ
    );

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.userData = {
      type: meshDesc.type,
      unitType: meshDesc.unitType,
      floorLevel: meshDesc.floorLevel,
      unitId: meshDesc.unitId,
    };

    group.add(mesh);

    // No edge lines (removed - brick textures + normal maps + GTAO define edges)

    // Collect windows (instead of adding individually)
    if (meshDesc.type === "unit" && meshDesc.windowWalls) {
      collectWindowPositions(windowDescs, meshDesc, centerX, centerZ, doorPositions);
    }

    // Cornice on top floor
    if (meshDesc.type === "unit" && meshDesc.isTopFloor) {
      addCornice(group, meshDesc, centerX, centerZ, getLimestoneMaterial());
    }

    // Roof parapets with limestone coping on top floor
    if (meshDesc.type === "unit" && meshDesc.isTopFloor) {
      addRoofParapetsWithCoping(group, meshDesc, centerX, centerZ);
    }

    // Staircase diagonal indication
    if (meshDesc.type === "staircase") {
      addStairIndication(group, meshDesc, centerX, centerZ);
    }

  }

  // Phase 3: Add entry doors (data-driven positions)
  addEntryDoors(group, doorPositions, centerX, centerZ);

  // Phase 4: Add instanced windows (all at once)
  addChicagoWindows(group, windowDescs, getGlassMaterial(), getLimestoneMaterial(), getMullionMaterial());

  // Phase 5: Add merged belt courses
  addBeltCourses(group, dedupedMeshes, centerX, centerZ, getLimestoneMaterial());

  // CSS2D label
  if (label) {
    var labelColor = label === "Current Code" ? "#E07A5A" : "#5BBF82";
    var labelObj = createLabel(label, labelColor);
    labelObj.position.set(0, maxY + 5, 0);
    group.add(labelObj);
  }

  return group;
}

// ── Ground Plane ────────────────────────────────────────────────────────────

function addGroundPlane(scene, width, depth) {
  var planeSize = Math.max(width, depth) * 6;

  // Textured concrete sidewalk
  var concreteMat = getConcreteMaterial();
  var groundGeo = new THREE.PlaneGeometry(planeSize, planeSize);
  var groundPlane = new THREE.Mesh(groundGeo, concreteMat);
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

  // No grid helper (textured ground replaces it)
}

// ── Rendering ───────────────────────────────────────────────────────────────

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

// ── Scene Setup ─────────────────────────────────────────────────────────────

function setupScene(container) {
  var width = container.clientWidth;
  var height = container.clientHeight;

  // ── Scene ──
  var scene = new THREE.Scene();
  // No scene.background - Sky provides it
  // Fog matches golden-hour horizon
  scene.fog = new THREE.FogExp2(0x9EB0C8, 0.003);

  // Camera
  var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

  // Renderer (reuse if exists to avoid WebGL context leaks)
  if (!_renderer) {
    _renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(_renderer.domElement);

    // Shadow configuration
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type = THREE.PCFShadowMap;

    // Tone mapping for cinematic color
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 0.9;
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

  // ── Procedural Sky ──────────────────────────────────────────────────────
  var sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);

  var skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 4;
  skyUniforms['rayleigh'].value = 2;
  skyUniforms['mieCoefficient'].value = 0.005;
  skyUniforms['mieDirectionalG'].value = 0.8;

  // Sun position: 15 degrees elevation, 220 degrees azimuth (Chicago SW evening)
  var phi = THREE.MathUtils.degToRad(90 - 15);
  var theta = THREE.MathUtils.degToRad(220);
  var sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  skyUniforms['sunPosition'].value.copy(sunPosition);

  // ── Environment Map from Sky (replaces RoomEnvironment) ─────────────────
  var pmremGenerator = new THREE.PMREMGenerator(_renderer);
  pmremGenerator.compileEquirectangularShader();

  // Generate PMREM from a separate sky scene
  var skyRenderTarget = pmremGenerator.fromScene(
    (function () {
      var s = new THREE.Scene();
      var skyCopy = new Sky();
      skyCopy.scale.setScalar(10000);
      var u = skyCopy.material.uniforms;
      u['turbidity'].value = 4;
      u['rayleigh'].value = 2;
      u['mieCoefficient'].value = 0.005;
      u['mieDirectionalG'].value = 0.8;
      u['sunPosition'].value.copy(sunPosition);
      s.add(skyCopy);
      return s;
    })(),
    0, 0.1, 1000
  );
  scene.environment = skyRenderTarget.texture;
  scene.environmentIntensity = 0.5;

  // ── Grounded Skybox ─────────────────────────────────────────────────────
  var groundedSkybox = new GroundedSkybox(skyRenderTarget.texture, 30, 500);
  groundedSkybox.position.y = -0.1;
  scene.add(groundedSkybox);

  pmremGenerator.dispose();

  // ── Post-Processing Pipeline ────────────────────────────────────────────
  _composer = new EffectComposer(_renderer);

  // 1. RenderPass
  var renderPass = new RenderPass(scene, camera);
  _composer.addPass(renderPass);

  // 2. GTAOPass - screen-space ambient occlusion
  _gtaoPass = new GTAOPass(scene, camera, width, height);
  _gtaoPass.output = GTAOPass.OUTPUT.Default;
  _gtaoPass.updateGtaoMaterial({
    radius: 3.0,
    distanceExponent: 2.0,
    thickness: 5.0,
    scale: 1.0,
    samples: 16,
  });
  _gtaoPass.updatePdMaterial({
    lumaPhi: 10.0,
    depthPhi: 2.0,
    normalPhi: 3.0,
    radius: 4,
    rings: 4,
    samples: 16,
  });
  _composer.addPass(_gtaoPass);

  // 3. UnrealBloomPass - enhanced for window glow
  var bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.12,  // strength
    0.4,   // radius
    0.9    // threshold
  );
  _composer.addPass(bloomPass);

  // 4. SMAAPass - anti-aliasing
  var smaaPass = new SMAAPass(width * _renderer.getPixelRatio(), height * _renderer.getPixelRatio());
  _composer.addPass(smaaPass);

  // 5. FilmPass - photographic grain
  var filmPass = new FilmPass(0.15);
  _composer.addPass(filmPass);

  // 6. OutputPass - must be last
  var outputPass = new OutputPass();
  _composer.addPass(outputPass);

  // ── Lighting ────────────────────────────────────────────────────────────

  // Initialize RectAreaLight uniforms
  RectAreaLightUniformsLib.init();

  // Hemisphere light
  var hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x3A4050, 0.4);
  scene.add(hemiLight);

  // Key directional light - golden hour
  var keyLight = new THREE.DirectionalLight(0xFFD49B, 0.9);
  // Align with sky sun position
  keyLight.position.set(sunPosition.x * 80, sunPosition.y * 80, sunPosition.z * 80);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 4096;
  keyLight.shadow.mapSize.height = 4096;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 300;
  keyLight.shadow.camera.left = -120;
  keyLight.shadow.camera.right = 120;
  keyLight.shadow.camera.top = 120;
  keyLight.shadow.camera.bottom = -120;
  keyLight.shadow.bias = -0.0003;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  // Fill light (cool)
  var fillLight = new THREE.DirectionalLight(0xA0B8D0, 0.25);
  fillLight.position.set(-40, 50, -30);
  scene.add(fillLight);

  // Rim / back light
  var rimLight = new THREE.DirectionalLight(0xFFE0C0, 0.2);
  rimLight.position.set(-20, 30, 80);
  scene.add(rimLight);

  // RectAreaLight - reduced intensity (sky provides more ambient now)
  var rectLight = new THREE.RectAreaLight(0xFFF4E6, 0.35, 80, 80);
  rectLight.position.set(0, 60, 0);
  rectLight.lookAt(0, 0, 0);
  scene.add(rectLight);

  // OrbitControls
  var controls = new OrbitControls(camera, _renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 10;
  controls.maxDistance = 500;

  return { scene: scene, camera: camera, controls: controls };
}

// ── Disposal ────────────────────────────────────────────────────────────────

function disposeScene(scene) {
  if (!scene) return;

  // Dispose textures from the texture cache module
  disposeTextures();

  scene.traverse(function (obj) {
    if (obj instanceof CSS2DObject && obj.element && obj.element.parentNode) {
      obj.element.parentNode.removeChild(obj.element);
    }
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      var materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach(function (m) {
        var mapNames = [
          'map', 'normalMap', 'roughnessMap', 'aoMap', 'emissiveMap',
          'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
          'sheenColorMap', 'sheenRoughnessMap',
          'specularIntensityMap', 'specularColorMap',
          'transmissionMap', 'thicknessMap'
        ];
        mapNames.forEach(function (name) {
          if (m[name]) m[name].dispose();
        });
        m.dispose();
      });
    }
    // Dispose Sky shader material
    if (obj.isSky && obj.material) {
      obj.material.dispose();
    }
  });

  while (scene.children.length > 0) {
    scene.remove(scene.children[0]);
  }
}

// ── Render Loop ─────────────────────────────────────────────────────────────

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
    renderFrame();
    stopRenderLoop();
  }, 2000);
}

// ── Main Entry Point ────────────────────────────────────────────────────────

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

  // Clear material caches
  _materialCache = {};
  _brickMaterialCache = null;
  _glassMaterialCache = null;
  _limestoneMaterialCache = null;
  _concreteMaterialCache = null;
  _mullionMaterialCache = null;
  _doorMaterialCache = null;
  _gtaoPass = null;

  // Ensure container is visible and has dimensions
  container.style.display = "block";

  var result = setupScene(container);
  _scene = result.scene;
  _camera = result.camera;
  _controls = result.controls;

  renderStandardBuildings(_scene, _camera, config);

  // Ground plane
  var bw = 80;
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
      if (_gtaoPass) _gtaoPass.setSize(w, h);
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

  startRenderLoop(_scene, _camera, _controls);

  animateCamera(_camera, _controls, fromPos, step.cameraPosition, fromTarget, step.cameraTarget, 1500, function () {
    _tourState.animating = false;
    _controls.enabled = true;
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
