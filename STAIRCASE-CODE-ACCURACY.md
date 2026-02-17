# Staircase Code Accuracy — Research & Improvement Plan

## Summary

The visualizer has two factual inaccuracies in how it models Chicago's staircase requirements. This document captures research findings from the two reference PDFs in this repo, web research on the Chicago building code, and provides detailed implementation instructions for fixing the issues.

---

## Reference Diagrams in the PDFs

Both PDFs in this repository contain architectural diagrams that are critical to understanding the problem and informing the fix. Detailed descriptions follow, along with instructions for viewing them.

### How to View the Diagrams

The PDFs are in the repo root:
- `Brief on Approaching Single Stair Reform in Chicago.pdf` (8 pages, by Strong Towns Chicago for Alderman Matt Martin)
- `Single Stair One Pager.pdf` (1 page, policy one-pager by Strong Towns Chicago)

**To view with chrome-devtools MCP:** Navigate the browser to the file URLs:
```
file:///C:/Repositories/single-stair-visualizer/Brief%20on%20Approaching%20Single%20Stair%20Reform%20in%20Chicago.pdf
file:///C:/Repositories/single-stair-visualizer/Single%20Stair%20One%20Pager.pdf
```
Use `navigate_page` with type "url", then `take_screenshot` to see the current page. The Chrome PDF viewer has a sidebar with page thumbnails. Use `take_snapshot` to get the accessibility tree, which includes thumbnail tab elements (`uid` values like "Thumbnail for page 5"). Click a thumbnail's tab element to jump to that page, then `take_screenshot` again.

**To view with the Read tool:** Use `Read` with the PDF file path. Claude can read PDFs directly and will see the page images. For the 8-page brief, use the `pages` parameter (e.g., `pages: "5-8"`) to read the appendix exhibits.

---

### Diagram: Exhibit A — 8-Flat Floor Plan and 3D View (Brief, Page 5)

**What it shows:** A typical floor plan and isometric 3D view of an 8-flat apartment building on a single 25ft x 125ft Chicago lot, complying with current staircase requirements. Created by Aggregate Studio and Josh Mings.

**The floor plan (top of page):**
- Labeled "TYPICAL FLOOR PLAN" — meaning this exact layout repeats on every floor of the building.
- The floor is split into two units side by side: "REAR UNIT 600 SF" on the left and "FRONT UNIT 600 SF" on the right.
- Each unit contains: 1 bedroom (roughly 9'3" x 12'0"), a bathroom, a kitchen/living area (roughly 20'8" x 12'4"), and a washer/dryer closet.
- Three stairways are visible: STAIR 1 at the far left (rear of building), STAIR 2 in the center between the two units, and STAIR 1 at the far right (front of building). The center stair runs along the side gangway wall.
- The stairways consume a significant chunk of the 20ft buildable width. Each unit is only about 600 sqft with 1 bedroom — barely enough for a single person, not a family.

**The 3D isometric view (bottom of page):**
- Shows the full building in perspective on its 25' x 125' lot.
- The building is 4 stories tall with orange/amber walls.
- Two units per floor are labeled "1 BR UNIT 600 SF" each.
- Gray/dark strips on the front face, middle, and rear represent the three stairway shafts running the full height of the building. This is the key visual evidence: the stair shafts are continuous vertical elements penetrating every floor from ground to roof.
- Side setbacks of 2' and 5' are marked.
- "Rear Open Space: 288 SF" is labeled at the back.
- Front setback of 15' is visible at the street side.

**Why this matters for the visualizer:** The "TYPICAL FLOOR PLAN" label and the 3D view both confirm that in a multi-story building under current code, the staircase layout is the **same on every floor**. The stair shafts cannot appear on only some floors — they run the full height. Our layout engine incorrectly generates 1 stair on floors 1-2 and 3 stairs on floor 3+, which is physically impossible. The fix must apply the 3-stair layout to ALL floors of a 3+ story building.

---

### Diagram: Exhibit F / One-Pager — Double-Stair vs Single-Stair Floor Plans (Brief Page 8 / One-Pager right side)

**What it shows:** A side-by-side floor plan comparison from the Los Angeles Times (by Gabrielle LaMarr LeMee, based on design by Simon Ha) showing the same building footprint under two different staircase rules. This same diagram appears both in the brief (Exhibit F, page 8) and on the right side of the one-pager.

**Top diagram — "Double-stair layout":**
- A rectangular floor plate with two staircases: "Stair #1" in the upper-right area and "Stair #2" along the left wall (shown in blue/teal fill).
- An elevator is positioned between the two stairs.
- A long corridor/hallway (shown in blue/teal) connects the two stairs horizontally through the center of the floor.
- **10 studio apartments** are arranged around the perimeter, all labeled "Studio". They line both sides of the corridor — a classic double-loaded corridor layout.
- Each studio is tiny — roughly the size of a hotel room. There are no 2-bedroom or 3-bedroom units.
- The corridor + stairs + elevator consume a massive share of the floor plate, forcing every unit to be small.

**Bottom diagram — "Single-stair layout":**
- The same building footprint, but with only "Stair #1" and an elevator in the upper-right corner.
- No corridor is needed because all units open directly to the single stair landing.
- **3 apartments**: Two large "3-Bedroom" units flanking the stair (left and right), and one large "2-Bedroom" unit filling the entire bottom portion of the floor.
- Each unit is dramatically larger than the studios above. They have multiple rooms, with bedrooms along the exterior walls where windows provide natural light.
- The space that was consumed by Stair #2 and the connecting hallway is now livable bedroom/living space.

**The caption reads:** "A single stair layout without a long hallway could mean more room for larger units"

**Why this matters for the visualizer:** This is the single most persuasive diagram for single-stair reform. It shows the core trade-off: double-stair = many tiny studios (not family-friendly), single-stair = fewer but much larger family-sized apartments with 2-3 bedrooms. Our visualizer models a similar comparison but on a narrower Chicago 25ft lot. The LA Times diagram is useful as a reference for what "good" looks like — our rendered floor plans should communicate the same contrast between cramped multi-stair layouts and spacious single-stair layouts.

---

### Diagram: One-Pager Bottom — 3D Building Width Comparison

**What it shows:** Two isometric 3D building renderings at the bottom of the one-pager, comparing building widths.

**Left building — "Double-loaded corridor six-story apartment building":**
- A wide rectangular building, labeled "55'-60' typical" width.
- The building has a central corridor visible as a horizontal band, with apartment windows on both the front and rear faces.
- This building requires a wide lot to accommodate the two stairs + corridor + units on both sides.
- Orange/brown coloring with window openings visible.

**Right building — "Single-stair six-story apartment building, currently allowed in Seattle":**
- A much narrower building, labeled "25'-30' typical" width.
- Narrow enough to fit on a **standard Chicago lot** (25ft wide).
- Windows on the front and rear faces only (no side windows needed since the building is the full lot width minus setbacks).
- Same height as the double-loaded building but dramatically less wide.

**Why this matters for the visualizer:** This 3D comparison shows that single-stair buildings can fit on Chicago's famously narrow 25ft lots, while double-stair buildings need 55-60' of width. Our visualizer already models the 25ft lot scenario correctly. This diagram validates that our lot dimensions and building proportions are realistic. It also suggests a potential 3D view feature could be very compelling if it showed this width contrast.

---

### Diagram: Exhibit D — Courtyard Apartment Types (Brief, Page 6)

**What it shows:** Four 3D isometric block diagrams by Larry Shure showing different courtyard apartment configurations. Each is a simplified colored block model (no windows or detail — just the massing).

**The four types shown (left to right):**
1. **"Side Court"** — An L-shaped building with the open courtyard space on one side. Two wings at 90 degrees. Green and orange colored blocks.
2. **"U-Court"** — A U-shaped building with three wings enclosing a courtyard on three sides, open on the fourth. Green and orange blocks.
3. **"S-Court"** — Two L-shapes mirrored and offset, creating an S-shaped plan with two courtyards. Green, orange, and teal blocks.
4. **"Multi-Court"** — A complex arrangement with multiple connected courtyards, resembling a grid of interlocking U-shapes. Multiple colors.

**Why this matters for the visualizer:** Our visualizer currently implements L-Shape (Side Court) and U-Shape (U-Court) — the first two types. The diagram confirms these are the canonical courtyard forms. The S-Court and Multi-Court are more complex and would require multi-lot configurations (beyond the current scope). The simplified block massing style in these diagrams is similar to how our courtyard SVG renders — colored rectangular segments with open courtyard space — validating our visual approach.

---

### Diagram: Exhibit B — Real Corner Lot 6-Flat Photo (Brief, Page 6)

**What it shows:** A photograph of a real 6-flat apartment building in Pilsen (Chicago) on a single corner lot, taken by Alex Montero.

**Details:** A 3-story brick building at a street corner. The front entrance faces one street, and a side entrance is visible on the cross street. In the back, exterior stairs/porches are visible on the left side of the building. The building demonstrates how corner lots provide extra window access on two street-facing walls, which partially mitigates the light-loss problem caused by multiple stairways. The brief notes this is why "older single lot six-flat buildings are commonly found at intersections."

**Why this matters for the visualizer:** Our "Corner" lot option (25x125 with smaller side setback) models this exact scenario. Corner lots get extra "east" window walls in the current code, which our layout engine already handles (`isCorner` flag adds east-facing windows). This photo validates that our corner lot model represents a real Chicago building type.

---

### Diagram: Exhibit E — Courtyard Apartment Photo in Lakeview (Brief, Page 7)

**What it shows:** A photograph of a real courtyard apartment building in Lakeview (Chicago). A 3-4 story brick building photographed from the back/side.

**Details:** Two features are highlighted with red circles:
1. **Rear porches** — indentations on the left side of the building where outdoor porches/balconies were attached, used as secondary means of egress in the building's original design.
2. **Emergency exit door** — a white door at ground level in the gangway between this building and the adjacent building, providing the second means of egress.

The building demonstrates how historic courtyard apartments satisfied the two-stairway requirement using outdoor fire escapes and porches rather than interior stairs. The brief explains that fire escapes have since been banned for new construction, making this approach impossible for new courtyard buildings.

**Why this matters for the visualizer:** This photo shows why the courtyard building type is "impossible under current code" — the old workarounds (fire escapes, exterior porches) are no longer allowed, and two interior stairways + connecting hallways make the courtyard wrap-around form infeasible. This validates our courtyard showcase framing: these buildings literally cannot be built without single-stair reform.

---

### Diagram: Exhibit G — Proposed Ordinance Text (Brief, Page 8)

**What it shows:** Not a diagram but the actual proposed ordinance language — 70 words that would enable single-stair reform in Chicago.

**The text:**
> Add Exception 10 to Section 14B-10-1006.3.3:
> *In Group R-2 buildings that do not contain more than four stories above grade plane equipped throughout with an automatic sprinkler system in accordance with Section 903.3.1.2, a single exit stairway shall be permitted for portions of the building with no more than four dwelling units per story, provided the stair discharges directly to the exterior or an open-air courtyard complying with Section 1028.*

**Key constraints:** 4 stories or less, fully sprinklered, max 4 dwelling units per floor, stair discharges to exterior or open courtyard.

**Why this matters for the visualizer:** Our visualizer models buildings up to 4 stories, which aligns perfectly with the proposed reform's scope. The 4-unit-per-floor limit also matches our courtyard model (2 units per wing segment, which is within the limit). The stair-to-courtyard discharge rule validates that courtyard buildings are explicitly contemplated by the reform.

---

## Finding 1: Floor-by-Floor Stair Count Is Physically Wrong

### The Problem

`layout.js` lines 36-55 currently assign stair counts per floor:

```js
// Determine staircase count for this floor
// Current code: floors 1-2 get 1 staircase, floor 3+ gets more
// Reform: always 1 staircase
let staircaseCount, needsHallway;
if (stair === "reform") {
  staircaseCount = 1;
  needsHallway = false;
} else {
  if (floorLevel <= 2) {
    staircaseCount = 1;
    needsHallway = false;
  } else {
    if (lotType === "double") {
      staircaseCount = 2;
      needsHallway = true;
    } else {
      staircaseCount = 3;
      needsHallway = true;
    }
  }
}
```

This is **physically impossible**. Stairway shafts are vertical structures that run from ground to roof. If a 3-story building needs 3 stairways on floor 3, those same shafts also exist on floors 1 and 2. You can't have stairs appear only on certain floors. Exhibit A in the brief (see diagram description above) labels its floor plan "TYPICAL FLOOR PLAN" and the 3D view shows stair shafts running continuously through every story, confirming this.

### The Fix

In `layout.js`, the stair count decision should be based on the **building height** (total stories), not the individual floor level. The stair count and hallway flag should be computed **once outside the floor loop** and applied uniformly to all floors.

**Current logic (wrong):**
```js
// Inside the floor loop — per-floor decision, physically impossible
if (stair === 'reform') {
  staircaseCount = 1;
} else {
  if (floorLevel <= 2) {
    staircaseCount = 1;
  } else {
    staircaseCount = lotType === 'double' ? 2 : 3;
  }
}
```

**Corrected logic:**
```js
// BEFORE the floor loop — building-level decision, stairs run full height
let staircaseCount, needsHallway;
if (stair === 'reform') {
  staircaseCount = 1;
  needsHallway = false;
} else {
  if (stories <= 2) {
    // 2-story buildings: single stair allowed under current Chicago code
    staircaseCount = 1;
    needsHallway = false;
  } else {
    // 3+ story buildings: ALL floors get multiple stairs
    if (lotType === 'double') {
      staircaseCount = 2;
      needsHallway = true;
    } else {
      staircaseCount = 3;
      needsHallway = true;
    }
  }
}

// Then inside the floor loop, use the same staircaseCount for every floor
for (let i = 0; i < stories; i++) {
  // ...use staircaseCount and needsHallway uniformly...
}
```

Note: `stories` (total building height) is already available in `generateLayout()` as `config.stories`. The change is simply to move the stair-count decision outside the loop and remove the `floorLevel <= 2` branch.

**Exception — commercial ground floor:** The commercial ground floor currently always gets 1 staircase regardless. This is a reasonable simplification (retail doesn't need the same egress as residential). Keep this behavior: commercial floor 1 gets 1 stair tucked in a corner, but the stair shaft still exists — it just doesn't consume floor area the same way because the retail space wraps around it differently. The current `generateCommercialFloor()` function can remain as-is since it already handles its own staircase placement.

### Impact on Tests

Many tests assert different stair counts on floor 1-2 vs floor 3+. These will need updating:
- Tests checking `staircases.length` on floor 1 of a 3-story building will change from 1 to 3 (single lot) or 2 (double lot)
- Delta/stats tests that assume floors 1-2 are "the same under both codes" will change — now ALL floors show the reform benefit
- The overall livable area deltas will increase because the reform benefit now applies to every floor

### Impact on Stats & Deltas

With this fix, a 3-story single-lot building under current code will show 3 staircases on every floor. This means:
- The reform benefit (3 stairs → 1 stair) applies to all floors, not just floor 3+
- Total livable area gained increases significantly
- The per-floor comparison is now impactful on every floor (no more "select floor 3 to see the difference")

---

## Finding 2: Narrative Messaging About "Floors 1-2"

### The Problem

Several narrative messages in `index.html` say things like:
- "Floors 1-2 already allow a single stair"
- "Floors 1-2: Same under both codes (single stair allowed below 3rd floor)"
- "Select Floor 3+ to see where reform makes the difference"

These are wrong for 3+ story buildings. In a 3-story building, floors 1 and 2 have 3 stairways just like floor 3 — the reform benefit is the same on every floor.

### The Fix

After fixing the layout engine (Finding 1), these messages become unnecessary because every floor shows the comparison. The narrative logic in `index.html` should be simplified:

**Remove or replace these conditionals:**

```js
// REMOVE: This entire block is wrong for 3+ story buildings
if (currentFloorIndex < 2 && currentConfig.stories > 2) {
  narrativeHeadline.innerHTML = 'Floors 1-2 already allow a single stair...';
}
```

```js
// REMOVE: Floor note that says floors 1-2 are the same
if (currentFloorIndex < 2 && currentConfig.stories > 2) {
  floorNote.textContent = 'Floors 1-2: Same under both codes...';
}
```

**Replace with a single narrative for all floors of 3+ story buildings:**

```js
if (currentConfig.stories > 2) {
  const currFloorTemp = current.floors[currentFloorIndex];
  const refFloorTemp = reform.floors[currentFloorIndex];
  const cLiv = currFloorTemp.units.reduce((s, u) => s + u.sqft, 0);
  const rLiv = refFloorTemp.units.reduce((s, u) => s + u.sqft, 0);
  const dArea = Math.round(rLiv - cLiv);
  const dPct = cLiv > 0 ? Math.round(((rLiv - cLiv) / cLiv) * 100) : 0;
  narrativeHeadline.innerHTML = `Current code forces 3 staircases into this floor plan, consuming <strong>${dArea} sf (+${dPct}%)</strong> of livable space that could be bedrooms.`;
}
```

The floor note can say something like:
```js
if (currentConfig.stories > 2) {
  floorNote.textContent = 'All floors: Current code requires 3 staircases for buildings above 2 stories';
}
```

The "2-story buildings already allow a single stair" message for `stories <= 2` is still correct and can remain.

---

## Chicago Code Details (Reference)

### Current Code

- **Source:** Strong Towns Chicago brief for Alderman Matt Martin, page 2
- **Rule:** "Chicago's building code currently allows second story units in **two story apartment buildings** to access a single stairway. Above the second story, each unit must have access to **two stairways**."
- **Effect on 25ft lot:** Two stairways needed per unit → 3 physical stairways total (front, middle/gangway, rear) because each unit (front and rear) must reach two separate stairs
- **Effect on 50ft lot:** Two stairways + connecting hallway (double-loaded corridor)
- The brief calls Chicago's current allowance "a very conservative version of Single Stair"

### IBC vs Chicago

- The **IBC** generally allows single stair up to 3 stories (the one-pager's "3-story" reference is about the IBC, not Chicago specifically — note the heading "Building Codes Limit Small Apartment Building Designs in **Much of the U.S.**")
- The IBC's 3-story exception (Section 1006.3.3(8)) only applies to buildings with **3 or fewer dwelling units** and floor areas under 800 sqft — not the 5-8 unit multi-flats our visualizer models
- **Chicago is more restrictive** than the IBC for multi-unit apartment buildings
- For single-family townhouses, Chicago does allow single stair up to 4 stories (per Niskanen Center)

### Proposed Reform (Exhibit G in the brief)

Add Exception 10 to Section 14B-10-1006.3.3:

> *In Group R-2 buildings that do not contain more than four stories above grade plane equipped throughout with an automatic sprinkler system in accordance with Section 903.3.1.2, a single exit stairway shall be permitted for portions of the building with no more than four dwelling units per story, provided the stair discharges directly to the exterior or an open-air courtyard complying with Section 1028.*

Key constraints:
- **4 stories or less**
- Fully sprinklered
- **Max 4 dwelling units per floor** (Seattle also has this limit)
- Stair discharges to exterior or open courtyard

### The "5-8 units need 3 stairs, 100+ units need 2 stairs" stat

From the brief (page 2): "Such an apartment building with 5-8 units total needs three stairways to comply with Chicago's building code, while an apartment tower with 100+ units on a large lot only needs two stairways." This is because the 25ft lot forces 3 stairs (each unit needs access to 2, and with front/back unit arrangement the geometry requires 3 physical stair shafts), while a wider lot can serve all units with 2 stairs + a connecting hallway.

---

## Implementation Checklist

1. **`layout.js`**: Move stair-count decision from per-floor to per-building (based on `stories` param, not `floorLevel`). Keep commercial ground floor exception.
2. **`index.html` narrative**: Remove "floors 1-2 same under both codes" messaging. All floors of a 3+ story building now show the reform benefit.
3. **`index.html` floor note**: Update to reflect that all floors are affected in 3+ story buildings.
4. **`index.html` hero stat**: "3 → 1 Staircases" is correct as-is (building-level stat).
5. **Tests**: Update stair-count assertions for floors 1-2 of 3+ story buildings. Update area/delta assertions.
6. **Context panel**: The "fire spread 46% → 2%" and "5-8 units need 3 stairs" content is correct — keep it.
7. **Footer**: "A 5-unit walk-up needs 3 staircases while a 100+ unit high-rise needs only 2" is correct — keep it.

---

## Sources

- [Strong Towns Chicago brief for Alderman Matt Martin](Brief%20on%20Approaching%20Single%20Stair%20Reform%20in%20Chicago.pdf) — primary source for Chicago-specific rules, Exhibits A-G
- [Single Stair One Pager](Single%20Stair%20One%20Pager.pdf) — LA Times floor plan comparison, 3D width comparison, IBC context
- [Niskanen Center — Single-Stair Reform Efforts](https://www.niskanencenter.org/understanding-single-stair-reform-efforts-across-the-united-states/)
- [Chicago Building Code Ch. 10 — Means of Egress (UpCodes)](https://up.codes/viewer/chicago/chi-building-code-2019/chapter/10/means-of-egress)
- [Chicago Building Code Clarifications — Exiting](https://www.chicago.gov/content/dam/city/depts/bldgs/general/Building%20Code/10Exiting_2311.pdf)
