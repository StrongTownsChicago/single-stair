# Plan: Redesign Single Stair Visualizer for Compelling Advocacy

## Context

The Single Stair Visualizer has a working layout engine (253 passing tests) but fails at its core mission: persuading aldermen, CFD officials, and the public to support single stair reform. The two PDFs in the repo show detailed room layouts (studios vs 3-bedrooms), courtyard configurations, and a compelling narrative. The app shows blank colored rectangles with identical bedroom counts on both sides. An alderman opening this tool would see no reason to support reform.

**Key gaps vs the PDFs:**
1. No room detail inside units (PDFs show Kitchen, Living, Bath, Bedrooms)
2. Both sides show "2 BR" due to broken bedroom formula (should be "2 BR → 3 BR")
3. No storytelling/context for someone seeing this cold
4. No labels on staircases/hallways, no legend, no annotations

---

## Changes (4 files modified, 0 new files)

### 1. Fix Bedroom Estimation (`layout.js` line 361, `courtyard.js` line 201)

Change window wall cap from `windowWallCount * 2` to `windowWallCount * 3`.

**Why:** A 780sf apartment with 1 exterior wall can be a 3BR in Chicago (interior bedrooms with airshaft windows are common). The current cap of `*2` makes both sides show "2 BR", killing the advocacy message.

**Result:**
| | Current Code (Floor 3) | Reform (Floor 3) | Delta |
|---|---|---|---|
| Before fix | 2 BR + 2 BR = 4 | 2 BR + 2 BR = 4 | 0 |
| After fix | 2 BR + 2 BR = 4 | 3 BR + 3 BR = 6 | **+2** |

**Test safety:** Verified all 27 lot×stories×floor combinations. Reform bedrooms >= current always holds. No test asserts specific bedroom counts - only comparative `>=` checks.

### 2. Add Room Subdivisions Inside Units (`renderer.js`)

New function `renderRoomLayout(unit)` draws dashed interior partition lines and room labels (Living/Kitchen, BR 1, BR 2, BR 3, Bath) inside each unit rectangle based on bedroom count.

- Uses NEW `data-type` values (`"room-line"`, `"room-label"`) not counted by any existing test
- Existing `data-type="unit"` rects and `data-type="unit-label"` texts remain unchanged
- Added to both `renderFloorPlanSVG()` and `renderCourtyardSVG()`

**Visual impact:** Current-code units show "Living/Kitchen + BR1 + BR2 + Bath". Reform units show "Living/Kitchen + BR1 + BR2 + BR3 + Bath". The extra bedroom is immediately visible.

### 3. Add Circulation Labels (`renderer.js`)

- "STAIR" text inside each staircase rect (white text, `data-type="stair-label"`)
- "HALL" text inside each hallway rect (vertical, `data-type="hall-label"`)
- Circulation area annotation at bottom of each floor plan (red for high, green for low)

### 4. Redesign Page for Advocacy (`index.html`)

Using the `frontend-design-skill`, redesign the page with:

- **Hero section**: "What If Chicago Allowed Single Stair Buildings?" with the key stat (4 BR → 6 BR per floor)
- **At-a-glance cards**: "3 staircases required → 1 staircase with sprinklers"
- **Color legend**: Inline legend explaining staircase (red), hallway (orange), window wall (yellow), livable space (cream)
- **Improved narrative headline**: "Current code forces 3 staircases above floor 2, consuming 480 sf per floor. Reform reclaims that space: 4 bedrooms → 6 bedrooms per floor."
- **Improved delta panel**: Hero-sized treatment for the key numbers (+440 sf, +2 BR)
- **Better footer**: Call-to-action ("Support single stair reform in Chicago")
- **Improved 2-story messaging**: "2-story buildings already allow a single stair. Choose 3 or 4 stories to see reform impact."

---

## Files Modified

| File | Changes |
|------|---------|
| `layout.js` | Line 361: `windowWallCount * 2` → `windowWallCount * 3` |
| `courtyard.js` | Line 201: same formula change |
| `renderer.js` | Add `renderRoomLayout()`, stair/hallway labels, circulation annotation |
| `index.html` | Hero section, at-a-glance, legend, improved narrative, improved delta, footer CTA, CSS updates |

## Implementation Order

1. Fix bedroom formula in `layout.js` and `courtyard.js` → run tests (gate)
2. Add room subdivisions in `renderer.js` → run tests (gate)
3. Add circulation labels/annotations in `renderer.js` → run tests (gate)
4. Redesign `index.html` with frontend-design-skill (hero, legend, narrative, delta, footer)
5. Final test run + visual QA in Chrome DevTools

## Verification

1. Run tests: `./run-tests.sh` — must show 253 passed, 0 failed
2. Open app in Chrome DevTools MCP:
   - Default view (Floor 3, single lot): Reform shows 3 BR units vs current's 2 BR units
   - Room subdivisions visible inside each unit
   - Staircase/hallway labels visible
   - Hero section displays compelling headline and key stat
   - Color legend visible
   - Delta panel prominently shows +440 sf, +2 BR
   - Test all lot types × stories × ground floor combos
   - Test courtyard modes (L-shape, U-shape)
