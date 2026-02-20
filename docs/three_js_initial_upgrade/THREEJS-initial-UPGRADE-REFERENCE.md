# Three.js Upgrade - Detailed Implementation Reference

Companion to `THREEJS-UPGRADE-PLAN.md`. Contains exact code locations, API migration details, and implementation specifics.

## Current Codebase Map

### viewer3d.js (579 lines) - Complete Structure

| Lines | Function/Section | Purpose |
|-------|-----------------|---------|
| 1-13 | Module-level state | `_renderer`, `_scene`, `_camera`, `_controls`, `_renderLoopActive`, `_idleTimeout`, `_resizeObserver`, `_animationFrameId`, `_tourState` |
| 16-23 | `MATERIAL_COLORS` | Color constants: unit 0xF0EBE1, staircase 0xBF5B4B, hallway 0xC4B5A5, slab 0xCCC7BF, windowEdge 0xD4A843, edge 0x6E6A64 |
| 25-30 | `MATERIAL_OPACITY` | Opacity values: unit 1.0, staircase 1.0, hallway 0.92, slab 1.0 |
| 32-37 | `MATERIAL_ROUGHNESS` | Roughness values: unit 0.88, staircase 0.72, hallway 0.90, slab 0.95 |
| 39-41 | `_materialCache` | Object cache keyed by type string |
| 43-68 | `getMaterial(type)` | Creates/caches `MeshStandardMaterial` with colors, roughness, opacity, polygon offset for staircases |
| 70-85 | `getEdgeMaterial()` | `LineBasicMaterial` for architectural edges, color 0x6E6A64, opacity 0.5 |
| 87-105 | `createTextSprite(text, color)` | Canvas 512x64, 36px bold Instrument Sans → `SpriteMaterial` with `CanvasTexture`, sprite scale (20, 2.5, 1) |
| 107-173 | `buildBuildingGroup(meshes, label, labelColor, centerX, centerZ)` | Main mesh builder: creates Group, iterates meshes, creates BoxGeometry + getMaterial, adds EdgesGeometry (skips slabs), adds window edges, positions label sprite above building |
| 133 | BoxGeometry creation | `new THREE.BoxGeometry(m.width, m.height, m.depth)` |
| 144-146 | Shadow config | `castShadow = true`, `receiveShadow = true` on all meshes |
| 148-155 | Edge lines | `EdgesGeometry` → `LineSegments` with `getEdgeMaterial()`, skipped for type "slab" |
| 175-230 | `addWindowEdges(group, meshes, centerX, centerZ)` | Creates gold line segments on exterior unit walls. Uses `windowWalls` array from mesh descriptors. Already implemented but called from within buildBuildingGroup |
| 232-252 | `addGroundPlane(scene, width, depth)` | ShadowMaterial plane (opacity 0.5) at y=-0.1, GridHelper with 0.25 opacity |
| 254-327 | `setupScene(container)` | Creates Scene (bg 0x141820), FogExp2 (0.005), PerspectiveCamera (FOV 45), WebGLRenderer (antialias, PCFSoftShadowMap, ACES tone mapping, sRGB), 4-light setup, OrbitControls |
| 329-349 | `disposeScene(scene)` | Traverses scene disposing geometries, materials (handles arrays), textures |
| 351-380 | `startRenderLoop(scene, camera, controls)` / `stopRenderLoop()` | RAF loop with 2s idle timeout. `_renderLoopActive` flag prevents duplicates |
| 382-454 | `renderBuildings(container, config)` | Main entry point. Checks WebGL support, calls setupScene, builds mesh data for current+reform, creates building groups, positions side-by-side, sets camera position, starts render loop, sets up ResizeObserver |
| 384-399 | WebGL support check | `typeof THREE === 'undefined'` check + `WebGLRenderer` try/catch |
| 411-416 | Staircase filtering | Skips staircase meshes at floorLevel > 0 (rendered once spanning full height) |
| 456-530 | Tour integration | `startTour()`, `goToTourStep()`, `endTour()` functions wrapping tour.js |
| 533-554 | `getViewerState()` | Returns scene/camera/controls/renderer refs |
| 556-568 | Cleanup | `window.addEventListener('beforeunload', ...)` disposes everything |
| 570-578 | `module.exports` | Exports MATERIAL_COLORS, MATERIAL_OPACITY, buildBuildingGroup, disposeScene |

### mesh.js (81 lines)

| Lines | Function/Section | Purpose |
|-------|-----------------|---------|
| 1-2 | `RESIDENTIAL_FLOOR_HEIGHT` | Constant: 10 (feet) |
| 4-75 | `buildMeshData(layout, numFloors)` | Iterates floors, creates mesh descriptors for units, staircases, hallways, slabs. Each descriptor: `{type, x, y, z, width, height, depth, floorLevel, unitId?, unitType?, windowWalls?}` |
| 77-80 | `module.exports` | Exports buildMeshData |

**Mesh descriptor fields** (what buildMeshData returns per element):
```javascript
{
  type: "unit" | "staircase" | "hallway" | "slab",
  x: number,      // left edge position
  y: number,      // floor height offset (floorLevel * RESIDENTIAL_FLOOR_HEIGHT)
  z: number,      // front edge position
  width: number,  // X dimension
  height: number, // Y dimension (RESIDENTIAL_FLOOR_HEIGHT for rooms, 0.5 for slabs)
  depth: number,  // Z dimension
  floorLevel: number,
  // Units only:
  unitId: string,        // e.g. "A", "B"
  unitType: string,      // e.g. "1BR", "2BR"
  windowWalls: string[], // e.g. ["north", "south", "east"]
}
```

### tour.js (151 lines)

| Lines | Function/Section | Purpose |
|-------|-----------------|---------|
| 1-52 | `createTourSteps(config)` | Generates camera position/target keyframes based on building config |
| 54-78 | `createTourState(steps)` | Returns state object with step index tracking |
| 80-98 | `advanceTour(state)` | Advances to next step, returns step data |
| 100-110 | `easeInOutCubic(t)` | Easing function for camera animation |
| 112-146 | `animateCamera(camera, controls, from, to, duration, onComplete)` | RAF-based camera position/target interpolation |
| 148-151 | `module.exports` | Exports createTourSteps, createTourState, advanceTour, easeInOutCubic |

### index.html inline script (lines 1291-1798)

This is the app controller that needs to become `app.js`. Key sections:

| Lines | Section | Purpose |
|-------|---------|---------|
| 1292-1293 | App state | `currentFloorIndex = 2`, `currentConfig = decodeHashToConfig(...)` |
| 1295-1314 | DOM refs | All `getElementById` calls for UI elements |
| 1316-1370 | `updateVisualization()` | Main render function: calls `generateLayout()`, `renderFloorPlanSVG()`, `computeStats()`, updates DOM |
| 1372-1440 | `update3DView()` | Calls `renderBuildings()` with current config |
| 1442-1510 | Event listeners | Lot select, stories buttons, floor buttons, tab switching, hash change |
| 1512-1560 | Tour button | Start/stop guided tour, step navigation |
| 1562-1620 | Keyboard nav | Arrow keys for floor/story navigation |
| 1622-1680 | URL hash sync | `encodeConfigToHash()` on config change, `decodeHashToConfig()` on load |
| 1682-1750 | Responsive | Tab visibility, resize handling |
| 1752-1798 | Init | Initial `updateVisualization()` call, initial tab setup |

**Globals consumed from plain scripts** (these will be available because plain `<script>` tags run before `<script type="module">`):
- `generateLayout` from layout.js
- `renderFloorPlanSVG` from renderer.js
- `computeStats` from stats.js
- `encodeConfigToHash`, `decodeHashToConfig` from state.js

**Functions imported from ES modules** (in the new app.js):
- `renderBuildings`, `startTour`, `goToTourStep`, `endTour`, `getViewerState`, `stopRenderLoop` from viewer3d.js
- `buildMeshData` from mesh.js (may not be needed directly in app.js since viewer3d.js calls it internally)
- `createTourSteps`, `createTourState`, `advanceTour` from tour.js (may not be needed directly since viewer3d.js wraps them)

## Three.js r128 → r183 API Migration Details

### Breaking Changes to Address

| r128 API | r183 Replacement | Location |
|----------|-----------------|----------|
| `THREE.sRGBEncoding` | `THREE.SRGBColorSpace` | viewer3d.js:281 |
| `renderer.outputEncoding` | `renderer.outputColorSpace` | viewer3d.js:281 |
| `THREE.PCFSoftShadowMap` | Still exists but consider `THREE.VSMShadowMap` for better quality | viewer3d.js:276 |
| `THREE.OrbitControls` (global) | `import { OrbitControls }` from addons | viewer3d.js:318 |
| `THREE.MeshStandardMaterial` | Still works; upgrade to `MeshPhysicalMaterial` for clearcoat/envMap features | viewer3d.js:43-68 |
| `material.map.dispose()` | Same API, but also dispose `clearcoatMap`, `clearcoatRoughnessMap` if used | viewer3d.js:336 |
| `CanvasTexture` | Still works identically | viewer3d.js:97 |
| `SpriteMaterial` + `Sprite` | Replace with CSS2DObject in Phase 5 | viewer3d.js:87-105 |

### New APIs Used by Phase

**Phase 2 - Post-Processing:**
```javascript
// EffectComposer manages the render pipeline
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// SSAOPass constructor: new SSAOPass(scene, camera, width, height)
// SSAOPass properties: kernelRadius, minDistance, maxDistance, output
// SSAOPass.OUTPUT enum: Default, SSAO, Blur, Depth, Normal

// UnrealBloomPass constructor: new UnrealBloomPass(resolution: Vector2, strength, radius, threshold)

// SMAAPass constructor: new SMAAPass(width, height)
// Loads search/area textures automatically from the CDN path

// OutputPass: no constructor args, handles tone mapping + color space conversion
// MUST be last pass when using post-processing with tone mapping

// EffectComposer key methods:
// composer.addPass(pass)
// composer.render()         ← replaces renderer.render(scene, camera)
// composer.setSize(w, h)    ← call on resize
```

**Phase 3 - Materials & Environment:**
```javascript
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

// PMREMGenerator: pre-filtered mipmapped radiance environment map
var pmrem = new THREE.PMREMGenerator(renderer);
var envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envMap;        // All PBR materials use this automatically
scene.environmentIntensity = 0.3;  // Available since r163

// MeshPhysicalMaterial (extends MeshStandardMaterial):
new THREE.MeshPhysicalMaterial({
  color: 0xF0EBE1,
  roughness: 0.85,
  metalness: 0.0,
  clearcoat: 0.05,           // 0-1, adds a clear glossy layer
  clearcoatRoughness: 0.4,   // roughness of the clearcoat layer
  envMapIntensity: 0.3,      // how much env map affects this material
  // Also available but not needed: transmission, ior, thickness, sheen, iridescence
});

// RectAreaLight: soft area light source
RectAreaLightUniformsLib.init(); // MUST call once before creating any RectAreaLight
var light = new THREE.RectAreaLight(color, intensity, width, height);
light.position.set(x, y, z);
light.lookAt(targetX, targetY, targetZ);
// Note: RectAreaLight does NOT cast shadows. Use alongside DirectionalLight for shadows.
```

**Phase 5 - CSS2D:**
```javascript
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// CSS2DRenderer creates a DOM overlay that positions HTML elements in 3D space
var labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(width, height);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.left = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
container.appendChild(labelRenderer.domElement);

// CSS2DObject wraps any DOM element
var div = document.createElement('div');
div.textContent = 'Label';
var label = new CSS2DObject(div);
label.position.set(x, y, z); // world coordinates
scene.add(label);

// Must render in the loop:
labelRenderer.render(scene, camera);
// Must resize:
labelRenderer.setSize(w, h);
```

## Existing Code Patterns to Preserve

### Material Cache Pattern (viewer3d.js:39-68)
```javascript
var _materialCache = {};
function getMaterial(type) {
  if (_materialCache[type]) return _materialCache[type];
  // ... create material ...
  _materialCache[type] = mat;
  return mat;
}
```
Keep this pattern when upgrading to MeshPhysicalMaterial. Clear cache when scene is disposed.

### Idle Render Loop Pattern (viewer3d.js:351-380)
```javascript
function startRenderLoop(scene, camera, controls) {
  if (_renderLoopActive) return;
  _renderLoopActive = true;
  clearTimeout(_idleTimeout);

  function animate() {
    if (!_renderLoopActive) return;
    _animationFrameId = requestAnimationFrame(animate);
    controls.update();
    _renderer.render(scene, camera);  // ← change to _composer.render()
  }
  animate();

  _idleTimeout = setTimeout(function() {
    _renderLoopActive = false;
    // One final frame
    controls.update();
    _renderer.render(scene, camera);  // ← change to _composer.render()
  }, 2000);
}
```
The EffectComposer is a drop-in replacement for `renderer.render()`.

### Building Positioning Pattern (viewer3d.js:456-493)
```javascript
var gap = buildableWidth * 1.5;
// Current code building: x = -(bw / 2 + gap / 2)
// Reform building: x = +(bw / 2 + gap / 2)
// Both centered at z = 0
```

### Staircase Deduplication (viewer3d.js:411-416)
```javascript
// Skip staircase meshes above floor 0 (they render once spanning full height)
if (m.type === "staircase" && m.floorLevel > 0) continue;
// When rendering, staircase height = numFloors * RESIDENTIAL_FLOOR_HEIGHT
```

## Test File Structure (tests.js)

Currently tests these modules via `require()`:
- `TestLayout` - layout.js: generateLayout() output validation
- `TestRenderer` - renderer.js: SVG output validation (uses jsdom-like approach)
- `TestStats` - stats.js: computeStats() numerical validation
- `TestState` - state.js: hash encode/decode round-trip
- `TestTour` - tour.js: createTourSteps(), easeInOutCubic() validation

**Only TestTour needs updating** since tour.js becomes an ES module. The layout/renderer/stats/state tests use files that remain as plain scripts with `module.exports`.

**Recommended approach for test compatibility:**
1. Keep `layout.js`, `renderer.js`, `stats.js`, `state.js` as dual-format (global + CommonJS) - no changes needed
2. For `mesh.js` and `tour.js`: the `module.exports` block at the bottom will cause a syntax error in ES module mode. Solution: detect the environment:
   ```javascript
   // This won't work in ES modules. Instead, use separate files:
   // tour.js (ES module with export statements)
   // tour.node.js (CommonJS wrapper that re-implements or copies exports)
   ```
   OR simpler: just duplicate the pure-data constants/functions in tests.js since they're small.

## Performance Considerations

| Feature | GPU Cost | Mitigation |
|---------|----------|------------|
| SSAO | Medium-High | kernelRadius 8 is moderate. Can reduce to 4 on mobile. Consider `navigator.maxTouchPoints > 0` check to skip SSAO |
| Bloom | Low | strength 0.15 is minimal overhead |
| SMAA | Low | Two texture lookups per pixel |
| MeshPhysicalMaterial | Low (over Standard) | Clearcoat adds one extra layer but scene has few meshes |
| RectAreaLight | Medium | Pre-computed LUT (RectAreaLightUniformsLib), no shadow map cost |
| Environment map | Negligible | PMREMGenerator runs once at setup, envMap is just a texture lookup |
| CSS2DRenderer | Negligible | DOM manipulation only, no GPU cost |
| Window insets (Phase 4) | Low | ~40-60 extra small meshes per building. Consider merging geometry if needed |

Total estimated overhead: Scene has ~20-40 meshes currently. Post-processing adds 5 fullscreen passes. Should easily maintain 60fps on desktop. Mobile may need SSAO disabled.

## Container and CSS Context

The 3D viewer container in index.html:
```html
<div id="three-container" style="..."></div>
```
- Uses `display: none` when Floor Plan tab is active, `display: block` when 3D View tab is active
- ResizeObserver in viewer3d.js watches for size changes
- Container needs `position: relative` for CSS2DRenderer overlay positioning (check if already set)

## CDN URLs for Import Map

```json
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.183.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.183.0/examples/jsm/"
  }
}
```

All addon paths resolve relative to the `three/addons/` prefix:
- `three/addons/controls/OrbitControls.js`
- `three/addons/postprocessing/EffectComposer.js`
- `three/addons/postprocessing/RenderPass.js`
- `three/addons/postprocessing/SSAOPass.js`
- `three/addons/postprocessing/UnrealBloomPass.js`
- `three/addons/postprocessing/SMAAPass.js`
- `three/addons/postprocessing/OutputPass.js`
- `three/addons/environments/RoomEnvironment.js`
- `three/addons/lights/RectAreaLightUniformsLib.js`
- `three/addons/renderers/CSS2DRenderer.js`
