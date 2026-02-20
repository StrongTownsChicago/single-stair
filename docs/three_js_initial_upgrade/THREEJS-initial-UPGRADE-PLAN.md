# Three.js Rendering Quality Upgrade Plan

## Context

The 3D view currently renders buildings as plain colored boxes (BoxGeometry + MeshStandardMaterial) on Three.js r128. While the lighting setup is decent (4-light system, ACES tone mapping, soft shadows), the overall look is rudimentary: no textures, no ambient occlusion, no post-processing, no environment reflections, no architectural detail. The goal is to massively upgrade visual quality by leveraging Three.js r183 features: post-processing pipeline (SSAO, bloom, SMAA), physical materials with environment maps, geometry enhancements, and crisp CSS2D labels.

## Files to Modify

| File | Changes |
|------|---------|
| `index.html` | Replace CDN script tags with import map, move inline app script to `app.js`, add CSS for CSS2D labels |
| `viewer3d.js` | ES module conversion, post-processing pipeline, upgraded materials/lighting, geometry detail, CSS2D labels |
| `mesh.js` | ES module conversion, extended mesh descriptors (isTopFloor flag, slab overhang) |
| `tour.js` | ES module conversion only |
| `app.js` **(new)** | App controller extracted from index.html inline `<script>` (lines 1291-1798) |
| `tests.js` | Update imports for module changes, adjust tolerances for geometry changes |
| `test-runner.html` | Update script loading for ES modules |

## Phase 1: Three.js r128 → r183 + ES Module Migration

**All other phases depend on this.**

### index.html changes

Remove lines 1282-1283 (old CDN scripts):
```html
<!-- REMOVE -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
```

Add import map before all scripts:
```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.183.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.183.0/examples/jsm/"
  }
}
</script>
```

Keep non-3D files as plain `<script>` tags (they have no Three.js dependency and need to stay CommonJS-compatible for `node tests.js`):
```html
<script src="layout.js"></script>
<script src="renderer.js"></script>
<script src="stats.js"></script>
<script src="state.js"></script>
```

Replace `<script src="mesh.js">`, `<script src="viewer3d.js">`, `<script src="tour.js">`, and the inline `<script>` block (lines 1288-1798) with:
```html
<script type="module" src="app.js"></script>
```

### viewer3d.js → ES module

- Add `import * as THREE from 'three'` and `import { OrbitControls } from 'three/addons/controls/OrbitControls.js'`
- `new THREE.OrbitControls(...)` → `new OrbitControls(...)`
- `_renderer.outputEncoding = THREE.sRGBEncoding` → `_renderer.outputColorSpace = THREE.SRGBColorSpace`
- Export public functions: `export { renderBuildings, startTour, goToTourStep, endTour, getViewerState, stopRenderLoop, MATERIAL_COLORS, MATERIAL_OPACITY }`
- Remove `module.exports` block at bottom

### mesh.js → ES module

- Add `export { buildMeshData, RESIDENTIAL_FLOOR_HEIGHT }`
- Remove `module.exports` block

### tour.js → ES module

- Add `export { createTourSteps, createTourState, advanceTour, easeInOutCubic }`
- Remove `module.exports` block

### app.js (new file)

- ES module that imports from `./viewer3d.js`, `./mesh.js`, `./tour.js`
- References globals from plain script tags: `generateLayout`, `renderFloorPlanSVG`, `computeStats`, `encodeConfigToHash`, `decodeHashToConfig`
- Contains all logic currently in the inline `<script>` block (lines 1291-1798 of index.html)

### tests.js updates

- Node `require('./viewer3d.js')` will fail since it's now an ES module
- Solution: Extract `MATERIAL_COLORS` and `MATERIAL_OPACITY` constants into the test file directly, or make viewer3d tests browser-only via `test-runner.html`
- Non-3D file tests (layout, renderer, stats, state) remain unchanged
- mesh.js and tour.js: create thin CommonJS wrapper files (`mesh.cjs.js`, `tour.cjs.js`) that duplicate the pure-data exports, OR skip Node testing for these and rely on browser test-runner

## Phase 2: Post-Processing Pipeline

Add to `viewer3d.js` imports:
```javascript
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
```

Build pipeline in `setupScene()` after creating renderer:
1. **RenderPass** - renders scene to framebuffer
2. **SSAOPass** - ambient occlusion in crevices between floors/units (kernelRadius: 8, minDistance: 0.005, maxDistance: 0.1)
3. **UnrealBloomPass** - very subtle warm glow (strength: 0.15, radius: 0.4, threshold: 0.85)
4. **SMAAPass** - anti-aliasing (replaces renderer's built-in MSAA → set `antialias: false` on WebGLRenderer for performance)
5. **OutputPass** - required in r155+ for correct tone mapping with post-processing (must be last)

Add `_composer` module-level state. Replace all `_renderer.render(scene, camera)` calls with `_composer.render()` in:
- `startRenderLoop()` animate function
- `onControlsInteraction()`
- ResizeObserver callback (also call `_composer.setSize()` and `ssaoPass.setSize()`)

The idle-timeout render loop pattern is unchanged - just swap the render call.

## Phase 3: Material & Lighting Upgrades

### Environment map (no HDR file needed)

```javascript
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// In setupScene():
var pmremGenerator = new THREE.PMREMGenerator(_renderer);
var envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envMap;
scene.environmentIntensity = 0.3; // Subtle, keeps original palette
pmremGenerator.dispose();
```

### Upgrade materials: MeshStandardMaterial → MeshPhysicalMaterial

Reuse existing `getMaterial()` function (viewer3d.js:43-68), `MATERIAL_COLORS`, `MATERIAL_OPACITY` but switch to `MeshPhysicalMaterial` with:
- **Units**: clearcoat 0.05, clearcoatRoughness 0.4 (subtle painted plaster sheen)
- **Staircases**: clearcoat 0.1, clearcoatRoughness 0.3 (sealed/painted look)
- **Hallways**: keep transparency, envMapIntensity 0.2
- **Slabs**: clearcoat 0.02, clearcoatRoughness 0.8 (raw concrete)

### Lighting adjustments

- Reduce key directional light: 0.85 → 0.6 (env map compensates)
- Reduce fill light: 0.3 → 0.2
- Reduce rim light: 0.2 → 0.15
- Add `RectAreaLight` (0xFFF4E6, intensity 2.0, 80x80) overhead for soft architectural feel
  - Requires: `import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'` and `RectAreaLightUniformsLib.init()`

### Better ground plane

Replace invisible `ShadowMaterial` plane with visible dark surface (`MeshPhysicalMaterial`, color 0x1a1e28, roughness 0.95) + keep grid overlay on top.

## Phase 4: Geometry Enhancements

### Window insets on unit exterior walls

Use existing `windowWalls` data already in mesh descriptors. Create small recessed `BoxGeometry` panels with glass-like `MeshPhysicalMaterial` (color 0x4A6B8A, roughness 0.1, metalness 0.3, envMapIntensity 0.8, opacity 0.7). Place 2 windows per exposed wall.

### Roof parapets on top floor

Add `isTopFloor` flag to mesh descriptors in `buildMeshData()`. In `buildBuildingGroup()`, add thin box geometry parapet walls (1.5ft high, 0.4ft thick) around top-floor unit perimeters using slab material.

### Floor slab overhang

Extend slab dimensions by 0.3ft on each side so they visibly protrude past unit walls — creates shadow lines that SSAO will enhance.

### Staircase indication

Add diagonal line geometry (using `BufferGeometry` + `Line`) inside staircase boxes to suggest stair runs, rather than leaving them as plain colored boxes.

## Phase 5: Polish

### CSS2D labels (replace canvas sprites)

```javascript
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
```

Replace `createTextSprite()` (viewer3d.js:87-105) with `CSS2DObject` wrapping styled `<div>` elements. Add `_labelRenderer` module-level state, initialize in `setupScene()`, render in the loop after `_composer.render()`, resize in ResizeObserver callback.

CSS2DRenderer DOM element overlays the canvas with `pointer-events: none` so OrbitControls still work.

### Smooth config transitions

When `renderBuildings()` is called with new config, fade old buildings out and new buildings in over 500ms using material opacity animation. Keep render loop active during transition via `startRenderLoop()`.

### Contact shadows

Add a secondary `ShadowMaterial` plane at y=-0.02 (just above the visible ground) with lower opacity (0.35) for soft ground contact shadows.

## Implementation Order

```
Phase 1 (ES Module Migration) ← prerequisite for all others
  → Phase 2 (Post-Processing) ← biggest visual impact
    → Phase 3 (Materials/Lighting) ← SSAO enhances these
      → Phase 4 (Geometry) ← env map on glass windows
        → Phase 5 (Polish) ← final touches
```

Each phase builds on the previous and is independently verifiable.

## Verification

After each phase:
1. Open `index.html` in Chrome - both buildings render side-by-side in 3D view
2. Zero console errors
3. OrbitControls work (drag to rotate, scroll to zoom, middle-click to pan)
4. Idle timeout stops rendering after 2s of no interaction
5. "Guided Tour" button and camera animations work
6. Switching lot type / stories re-renders correctly
7. `node tests.js` passes for non-3D tests
8. `test-runner.html` passes all browser tests

Phase-specific checks:
- **Phase 2**: Visible AO darkening in crevices between floors, subtle glow on bright edges, smooth edges (no aliasing)
- **Phase 3**: Subtle reflections on surfaces, richer staircase material, visible dark ground plane
- **Phase 4**: Window panels visible on exterior walls, parapet edges on rooftop, slab edges protruding
- **Phase 5**: Crisp HTML text labels (not blurry sprites), smooth fade when changing config
