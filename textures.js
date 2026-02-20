// Single Stair Visualizer -- Procedural Canvas Texture System
// Generates PBR texture stacks via Canvas 2D. Zero external dependencies.
// Module-level caching: generate once, reuse. ~1.5 MB total texture memory.

import * as THREE from 'three';

// ── Module-level texture cache ──────────────────────────────────────────────
var _brickTextures = null;
var _limestoneTextures = null;
var _concreteTextures = null;
var _interiorGlowMap = null;

// ── Brick Textures ──────────────────────────────────────────────────────────

function drawBrickDiffuse(ctx, size) {
  var BRICK_W = size / 8;
  var BRICK_H = size / 16;
  var MORTAR = 2;

  // Base mortar color
  ctx.fillStyle = '#C4B8A8';
  ctx.fillRect(0, 0, size, size);

  // Chicago brick palette
  var palette = [
    [139, 69, 51],   // #8B4533 deep terracotta
    [160, 82, 45],   // #A0522D warm red-brown
    [107, 58, 42],   // #6B3A2A dark
    [176, 107, 80],  // #B06B50 light (10% chance)
    [74, 40, 32],    // #4A2820 blackened (5% chance)
  ];

  for (var row = 0; row < 16; row++) {
    var offset = (row % 2 === 0) ? 0 : BRICK_W / 2;
    for (var col = -1; col <= 8; col++) {
      var rand = Math.random();
      var base;
      if (rand < 0.05) base = palette[4];
      else if (rand < 0.15) base = palette[3];
      else if (rand < 0.40) base = palette[2];
      else if (rand < 0.70) base = palette[1];
      else base = palette[0];

      var r = base[0] + Math.random() * 16 - 8;
      var g = base[1] + Math.random() * 12 - 6;
      var b = base[2] + Math.random() * 10 - 5;

      ctx.fillStyle = 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
      ctx.fillRect(
        offset + col * BRICK_W + MORTAR,
        row * BRICK_H + MORTAR,
        BRICK_W - MORTAR * 2,
        BRICK_H - MORTAR * 2
      );

      // Subtle per-pixel noise (weathering)
      for (var px = 0; px < 3; px++) {
        var nx = offset + col * BRICK_W + MORTAR + Math.random() * (BRICK_W - MORTAR * 2);
        var ny = row * BRICK_H + MORTAR + Math.random() * (BRICK_H - MORTAR * 2);
        ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.08) + ')';
        ctx.fillRect(nx, ny, 2, 2);
      }
    }
  }
}

function drawBrickHeightMap(ctx, size) {
  var BRICK_W = size / 8;
  var BRICK_H = size / 16;
  var MORTAR = 2;

  // Mortar grooves are LOW (dark)
  ctx.fillStyle = 'rgb(0,0,0)';
  ctx.fillRect(0, 0, size, size);

  // Brick faces are HIGH (bright)
  for (var row = 0; row < 16; row++) {
    var offset = (row % 2 === 0) ? 0 : BRICK_W / 2;
    for (var col = -1; col <= 8; col++) {
      var h = 200 + Math.random() * 55;
      ctx.fillStyle = 'rgb(' + Math.round(h) + ',' + Math.round(h) + ',' + Math.round(h) + ')';
      ctx.fillRect(
        offset + col * BRICK_W + MORTAR,
        row * BRICK_H + MORTAR,
        BRICK_W - MORTAR * 2,
        BRICK_H - MORTAR * 2
      );
    }
  }
}

function heightToNormalMap(heightCtx, size) {
  var normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  var nCtx = normalCanvas.getContext('2d');

  var heightData = heightCtx.getImageData(0, 0, size, size).data;
  var normalData = nCtx.createImageData(size, size);
  var nd = normalData.data;

  var strength = 2.0;

  for (var y = 0; y < size; y++) {
    for (var x = 0; x < size; x++) {
      var idx = (y * size + x) * 4;
      var left = heightData[((y * size + ((x - 1 + size) % size)) * 4)];
      var right = heightData[((y * size + ((x + 1) % size)) * 4)];
      var up = heightData[((((y - 1 + size) % size) * size + x) * 4)];
      var down = heightData[((((y + 1) % size) * size + x) * 4)];

      var dx = (left - right) / 255.0 * strength;
      var dy = (up - down) / 255.0 * strength;

      var len = Math.sqrt(dx * dx + dy * dy + 1.0);
      nd[idx + 0] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      nd[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      nd[idx + 2] = Math.round(((1.0 / len) * 0.5 + 0.5) * 255);
      nd[idx + 3] = 255;
    }
  }

  nCtx.putImageData(normalData, 0, 0);
  return normalCanvas;
}

function drawBrickRoughness(ctx, size) {
  var BRICK_W = size / 8;
  var BRICK_H = size / 16;
  var MORTAR = 2;

  // Mortar is rougher (brighter = rougher)
  var mortarRoughness = Math.round(0.92 * 255);
  ctx.fillStyle = 'rgb(' + mortarRoughness + ',' + mortarRoughness + ',' + mortarRoughness + ')';
  ctx.fillRect(0, 0, size, size);

  for (var row = 0; row < 16; row++) {
    var offset = (row % 2 === 0) ? 0 : BRICK_W / 2;
    for (var col = -1; col <= 8; col++) {
      var roughness = 0.75 + Math.random() * 0.10;
      var rv = Math.round(roughness * 255);
      ctx.fillStyle = 'rgb(' + rv + ',' + rv + ',' + rv + ')';
      ctx.fillRect(
        offset + col * BRICK_W + MORTAR,
        row * BRICK_H + MORTAR,
        BRICK_W - MORTAR * 2,
        BRICK_H - MORTAR * 2
      );
    }
  }
}

function drawBrickAO(ctx, size) {
  var BRICK_W = size / 8;
  var BRICK_H = size / 16;
  var MORTAR = 2;

  // Start with white (no occlusion)
  ctx.fillStyle = 'rgb(255,255,255)';
  ctx.fillRect(0, 0, size, size);

  // Darkened mortar joints
  ctx.fillStyle = 'rgb(180,180,180)';
  // Horizontal mortar lines
  for (var row = 0; row <= 16; row++) {
    ctx.fillRect(0, row * BRICK_H, size, MORTAR);
  }
  // Vertical mortar lines (staggered)
  for (var row = 0; row < 16; row++) {
    var offset = (row % 2 === 0) ? 0 : BRICK_W / 2;
    for (var col = -1; col <= 8; col++) {
      ctx.fillRect(offset + col * BRICK_W, row * BRICK_H, MORTAR, BRICK_H);
    }
  }

  // Darken brick edges near mortar
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (var row = 0; row < 16; row++) {
    var offset = (row % 2 === 0) ? 0 : BRICK_W / 2;
    for (var col = -1; col <= 8; col++) {
      var bx = offset + col * BRICK_W + MORTAR;
      var by = row * BRICK_H + MORTAR;
      var bw = BRICK_W - MORTAR * 2;
      var bh = BRICK_H - MORTAR * 2;
      // Top and bottom edge of each brick
      ctx.fillRect(bx, by, bw, 2);
      ctx.fillRect(bx, by + bh - 2, bw, 2);
      // Left and right edge
      ctx.fillRect(bx, by, 2, bh);
      ctx.fillRect(bx + bw - 2, by, 2, bh);
    }
  }
}

function generateBrickTextures() {
  if (_brickTextures) return _brickTextures;

  var size = 512;

  // Diffuse map
  var diffuseCanvas = document.createElement('canvas');
  diffuseCanvas.width = size;
  diffuseCanvas.height = size;
  var diffuseCtx = diffuseCanvas.getContext('2d');
  drawBrickDiffuse(diffuseCtx, size);

  var map = new THREE.CanvasTexture(diffuseCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  // Height map for normal map generation
  var heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  var heightCtx = heightCanvas.getContext('2d');
  drawBrickHeightMap(heightCtx, size);

  var normalCanvas = heightToNormalMap(heightCtx, size);
  var normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  // Roughness map
  var roughnessCanvas = document.createElement('canvas');
  roughnessCanvas.width = size;
  roughnessCanvas.height = size;
  var roughnessCtx = roughnessCanvas.getContext('2d');
  drawBrickRoughness(roughnessCtx, size);

  var roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  // AO map
  var aoCanvas = document.createElement('canvas');
  aoCanvas.width = size;
  aoCanvas.height = size;
  var aoCtx = aoCanvas.getContext('2d');
  drawBrickAO(aoCtx, size);

  var aoMap = new THREE.CanvasTexture(aoCanvas);
  aoMap.wrapS = THREE.RepeatWrapping;
  aoMap.wrapT = THREE.RepeatWrapping;

  _brickTextures = { map: map, normalMap: normalMap, roughnessMap: roughnessMap, aoMap: aoMap };
  return _brickTextures;
}

// ── Limestone Textures ──────────────────────────────────────────────────────

function generateLimestoneTextures() {
  if (_limestoneTextures) return _limestoneTextures;

  var size = 128;

  // Diffuse: cream/buff with speckle noise
  var diffuseCanvas = document.createElement('canvas');
  diffuseCanvas.width = size;
  diffuseCanvas.height = size;
  var ctx = diffuseCanvas.getContext('2d');

  // Base cream color
  ctx.fillStyle = '#E8DCC8';
  ctx.fillRect(0, 0, size, size);

  // Speckle noise
  for (var i = 0; i < 800; i++) {
    var x = Math.random() * size;
    var y = Math.random() * size;
    var brightness = 200 + Math.random() * 50;
    ctx.fillStyle = 'rgba(' + Math.round(brightness) + ',' + Math.round(brightness * 0.95) + ',' + Math.round(brightness * 0.85) + ',' + (Math.random() * 0.15) + ')';
    ctx.fillRect(x, y, 1, 1);
  }

  // Faint horizontal bedding lines
  ctx.strokeStyle = 'rgba(180,170,155,0.12)';
  ctx.lineWidth = 1;
  for (var ly = 0; ly < size; ly += 16 + Math.random() * 8) {
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(size, ly);
    ctx.stroke();
  }

  var map = new THREE.CanvasTexture(diffuseCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  // Normal map: minimal pitting
  var normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  var nCtx = normalCanvas.getContext('2d');

  // Flat normal (128,128,255)
  nCtx.fillStyle = 'rgb(128,128,255)';
  nCtx.fillRect(0, 0, size, size);

  // Small surface pits
  for (var p = 0; p < 200; p++) {
    var px = Math.random() * size;
    var py = Math.random() * size;
    nCtx.fillStyle = 'rgba(' + (118 + Math.random() * 20) + ',' + (118 + Math.random() * 20) + ',255,' + (Math.random() * 0.3) + ')';
    nCtx.fillRect(px, py, 2, 2);
  }

  var normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  // Roughness map
  var roughnessCanvas = document.createElement('canvas');
  roughnessCanvas.width = size;
  roughnessCanvas.height = size;
  var rCtx = roughnessCanvas.getContext('2d');

  var baseRoughness = Math.round(0.60 * 255);
  rCtx.fillStyle = 'rgb(' + baseRoughness + ',' + baseRoughness + ',' + baseRoughness + ')';
  rCtx.fillRect(0, 0, size, size);

  // Slight variation
  for (var rv = 0; rv < 300; rv++) {
    var rx = Math.random() * size;
    var ry = Math.random() * size;
    var variation = 0.55 + Math.random() * 0.10;
    var vv = Math.round(variation * 255);
    rCtx.fillStyle = 'rgba(' + vv + ',' + vv + ',' + vv + ',0.3)';
    rCtx.fillRect(rx, ry, 3, 3);
  }

  var roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  _limestoneTextures = { map: map, normalMap: normalMap, roughnessMap: roughnessMap };
  return _limestoneTextures;
}

// ── Concrete Textures ───────────────────────────────────────────────────────

function generateConcreteTextures() {
  if (_concreteTextures) return _concreteTextures;

  var size = 256;

  // Diffuse: neutral grey with faint board-formed lines
  var diffuseCanvas = document.createElement('canvas');
  diffuseCanvas.width = size;
  diffuseCanvas.height = size;
  var ctx = diffuseCanvas.getContext('2d');

  ctx.fillStyle = '#A0A0A0';
  ctx.fillRect(0, 0, size, size);

  // Board-formed texture lines
  ctx.strokeStyle = 'rgba(140,140,140,0.15)';
  ctx.lineWidth = 1;
  for (var bly = 0; bly < size; bly += 12 + Math.random() * 4) {
    ctx.beginPath();
    ctx.moveTo(0, bly);
    ctx.lineTo(size, bly);
    ctx.stroke();
  }

  // Surface noise
  for (var ci = 0; ci < 500; ci++) {
    var cx = Math.random() * size;
    var cy = Math.random() * size;
    var cv = 130 + Math.random() * 50;
    ctx.fillStyle = 'rgba(' + Math.round(cv) + ',' + Math.round(cv) + ',' + Math.round(cv) + ',' + (Math.random() * 0.1) + ')';
    ctx.fillRect(cx, cy, 2, 2);
  }

  // Scoring lines for sidewalk expansion joints
  ctx.strokeStyle = 'rgba(80,80,80,0.2)';
  ctx.lineWidth = 2;
  for (var sx = 0; sx < size; sx += 64) {
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, size);
    ctx.stroke();
  }
  for (var sy = 0; sy < size; sy += 64) {
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(size, sy);
    ctx.stroke();
  }

  var map = new THREE.CanvasTexture(diffuseCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  // Normal map
  var normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  var nCtx = normalCanvas.getContext('2d');

  nCtx.fillStyle = 'rgb(128,128,255)';
  nCtx.fillRect(0, 0, size, size);

  // Board-formed ridges
  for (var nly = 0; nly < size; nly += 12 + Math.random() * 4) {
    nCtx.fillStyle = 'rgba(128,' + (120 + Math.random() * 16) + ',255,0.3)';
    nCtx.fillRect(0, nly, size, 2);
  }

  var normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  // Roughness map
  var roughnessCanvas = document.createElement('canvas');
  roughnessCanvas.width = size;
  roughnessCanvas.height = size;
  var rCtx = roughnessCanvas.getContext('2d');

  var concreteRoughness = Math.round(0.92 * 255);
  rCtx.fillStyle = 'rgb(' + concreteRoughness + ',' + concreteRoughness + ',' + concreteRoughness + ')';
  rCtx.fillRect(0, 0, size, size);

  var roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  _concreteTextures = { map: map, normalMap: normalMap, roughnessMap: roughnessMap };
  return _concreteTextures;
}

// ── Interior Glow Map ───────────────────────────────────────────────────────

function generateInteriorGlowMap() {
  if (_interiorGlowMap) return _interiorGlowMap;

  var size = 128;
  var canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  var ctx = canvas.getContext('2d');

  // Warm gradient: bright center, darker edges
  var gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, '#FFE4B5');
  gradient.addColorStop(0.5, '#FFD090');
  gradient.addColorStop(1, '#8B6914');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  _interiorGlowMap = new THREE.CanvasTexture(canvas);
  _interiorGlowMap.wrapS = THREE.ClampToEdgeWrapping;
  _interiorGlowMap.wrapT = THREE.ClampToEdgeWrapping;

  return _interiorGlowMap;
}

// ── Disposal ────────────────────────────────────────────────────────────────

function disposeTextures() {
  if (_brickTextures) {
    _brickTextures.map.dispose();
    _brickTextures.normalMap.dispose();
    _brickTextures.roughnessMap.dispose();
    _brickTextures.aoMap.dispose();
    _brickTextures = null;
  }
  if (_limestoneTextures) {
    _limestoneTextures.map.dispose();
    _limestoneTextures.normalMap.dispose();
    _limestoneTextures.roughnessMap.dispose();
    _limestoneTextures = null;
  }
  if (_concreteTextures) {
    _concreteTextures.map.dispose();
    _concreteTextures.normalMap.dispose();
    _concreteTextures.roughnessMap.dispose();
    _concreteTextures = null;
  }
  if (_interiorGlowMap) {
    _interiorGlowMap.dispose();
    _interiorGlowMap = null;
  }
}

export {
  generateBrickTextures,
  generateLimestoneTextures,
  generateConcreteTextures,
  generateInteriorGlowMap,
  disposeTextures
};
