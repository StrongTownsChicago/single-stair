// Single Stair Visualizer — SVG Renderer
// Renders layout engine output as SVG floor plans
// Coordinate swap: layout Y → SVG X, layout X → SVG Y (depth runs left-to-right)

const SCALE = 5; // pixels per foot

// Merge vertically-adjacent stair + corridor rects that share the same x/w into a single rect.
// Returns {x, y, w, d} covering the combined column, or null if no obstructions found.
function computeCombinedObstruction(hallways, staircases) {
  const rects = [...(hallways || []), ...(staircases || [])];
  if (rects.length === 0) return null;

  // Group rects that share the same x and w (same vertical column)
  const groups = {};
  for (const r of rects) {
    const key = `${r.x},${r.w}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  // Find the largest group (by total area) and merge into one bounding rect
  let bestKey = null, bestArea = 0;
  for (const key of Object.keys(groups)) {
    const area = groups[key].reduce((s, r) => s + r.w * r.d, 0);
    if (area > bestArea) { bestArea = area; bestKey = key; }
  }
  if (!bestKey) return null;

  const group = groups[bestKey];
  const minY = Math.min(...group.map(r => r.y));
  const maxY = Math.max(...group.map(r => r.y + r.d));
  return { x: group[0].x, y: minY, w: group[0].w, d: maxY - minY };
}

// Render dashed room partitions and labels inside a unit
// hallways (optional): used to constrain lines/labels to the largest unobstructed strip
function renderRoomLayout(unit, hallways, staircases) {
  const br = unit.bedrooms;
  if (br < 1) return "";

  let svg = "";
  let x = unit.x;
  const y = unit.y;
  let w = unit.w;
  let d = unit.d;
  const pad = 0.3;

  // For full-floor ground units with a corridor, render room layout that wraps
  // around the obstruction zone (stair + corridor column)
  if (unit.position === "full" && (hallways || staircases)) {
    const obstruction = computeCombinedObstruction(hallways, staircases);
    if (obstruction) {
      const overlapX = Math.min(x + w, obstruction.x + obstruction.w) - Math.max(x, obstruction.x);
      const overlapY = Math.min(y + d, obstruction.y + obstruction.d) - Math.max(y, obstruction.y);
      if (overlapX > 0 && overlapY > 0) {
        return renderFullFloorRoomLayout(unit, obstruction, br);
      }
    }
  }

  // If a hallway cuts through this unit, constrain the room layout to avoid it.
  // For regular units, narrow to the widest unobstructed strip.
  if (hallways) {
    for (const hall of hallways) {
      const hx0 = hall.x, hx1 = hall.x + hall.w;
      const hy0 = hall.y, hy1 = hall.y + hall.d;
      const overlapX = Math.min(x + w, hx1) - Math.max(x, hx0);
      const overlapY = Math.min(y + d, hy1) - Math.max(y, hy0);
      if (overlapX > 0 && overlapY > 0) {
        const leftW = Math.max(0, hx0 - x);
        const rightW = Math.max(0, (x + w) - hx1);
        if (leftW >= rightW && leftW > 0) {
          w = leftW;
        } else if (rightW > 0) {
          x = hx1;
          w = rightW;
        }
        break;
      }
    }
  }

  // Rear units are flipped so living faces the exterior window (south)
  // and bath/entry faces the stair landing (center of building)
  const isRear = unit.position && unit.position.startsWith("rear");

  // Room zones (each as fraction of depth):
  //   Front: Living/Kitchen (40%) → Bedrooms (40%) → Bath (20%)  [bath near stair]
  //   Rear:  Bath (20%) → Bedrooms (40%) → Living/Kitchen (40%)  [bath near stair, living near window]
  let livingStart, livingEnd, brStart, brEnd, bathStart, bathEnd;

  if (isRear) {
    bathStart = y;
    bathEnd = y + d * 0.20;
    brStart = bathEnd;
    brEnd = y + d * 0.60;
    livingStart = brEnd;
    livingEnd = y + d;
  } else {
    livingStart = y;
    livingEnd = y + d * 0.40;
    brStart = livingEnd;
    brEnd = y + d * 0.80;
    bathStart = brEnd;
    bathEnd = y + d;
  }

  // Dashed partition lines between zones (vertical after coordinate swap)
  const line1 = isRear ? bathEnd : livingEnd;
  const line2 = isRear ? brEnd : brEnd;
  svg += `<line x1="${line1}" y1="${x + pad}" x2="${line1}" y2="${x + w - pad}" stroke="#8B8680" stroke-width="0.2" stroke-dasharray="1,0.8" data-type="room-line"/>`;
  svg += `<line x1="${line2}" y1="${x + pad}" x2="${line2}" y2="${x + w - pad}" stroke="#8B8680" stroke-width="0.2" stroke-dasharray="1,0.8" data-type="room-line"/>`;

  // Partitions between bedrooms (horizontal after coordinate swap)
  if (br >= 2) {
    for (let i = 1; i < br; i++) {
      const bx = x + (w / br) * i;
      svg += `<line x1="${brStart + pad}" y1="${bx}" x2="${brEnd - pad}" y2="${bx}" stroke="#8B8680" stroke-width="0.2" stroke-dasharray="1,0.8" data-type="room-line"/>`;
    }
  }

  // Room labels — small, muted (coordinates swapped)
  const labelSize = Math.min(d * 0.045, w * 0.08, 2.2);
  const labelFill = "#7A756E";

  // Living/Kitchen label
  svg += `<text x="${(livingStart + livingEnd) / 2}" y="${x + w / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">Living / Kitchen</text>`;

  // Bedroom labels
  for (let i = 0; i < br; i++) {
    const bx = x + (w / br) * i + (w / br) / 2;
    const by = (brStart + brEnd) / 2;
    svg += `<text x="${by}" y="${bx}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">BR ${i + 1}</text>`;
  }

  // Bath label
  svg += `<text x="${(bathStart + bathEnd) / 2}" y="${x + w / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">Bath</text>`;

  return svg;
}

// Render room layout for a full-floor unit that wraps around a combined obstruction
// (stair + corridor column). The unit is C-shaped:
//   Front section (full width, above obstruction) → Living / Kitchen
//   Left strip (beside obstruction) → BR 1
//   Right strip upper → BR 2 (if 2+ BR)
//   Right strip lower → Bath
function renderFullFloorRoomLayout(unit, obstruction, br) {
  let svg = "";
  const pad = 0.3;
  const lineStroke = `stroke="#8B8680" stroke-width="0.2" stroke-dasharray="1,0.8"`;

  // Obstruction bounds in layout coordinates
  const obX0 = obstruction.x;                      // e.g. 8
  const obX1 = obstruction.x + obstruction.w;      // e.g. 12
  const obY0 = obstruction.y;                      // e.g. 35
  const obY1 = obstruction.y + obstruction.d;      // e.g. 80

  // Strip dimensions (in layout coords)
  const leftW = obX0 - unit.x;                     // 8
  const rightW = (unit.x + unit.w) - obX1;         // 8
  const stripD = obY1 - obY0;                      // 45

  // Layout coordinates for label centers
  const leftMidX = unit.x + leftW / 2;             // 4
  const rightMidX = obX1 + rightW / 2;             // 16

  // Bath split: bottom ~30% of right strip
  const bathFraction = 0.30;
  const bathSplitY = obY1 - stripD * bathFraction;  // 66.5

  const labelFill = "#7A756E";
  const labelSize = Math.min(unit.d * 0.04, leftW * 0.15, 2.2);

  // --- Partition lines (dashed) ---

  // 1. Horizontal line at obY0 across full unit width (living / bedrooms boundary)
  //    In SVG coords: vertical line at x=obY0, from y=unit.x to y=unit.x+unit.w
  svg += `<line x1="${obY0}" y1="${unit.x + pad}" x2="${obY0}" y2="${unit.x + unit.w - pad}" ${lineStroke} data-type="room-line"/>`;

  // 2. Horizontal line at bathSplitY in right strip only (BR 2 / Bath boundary)
  //    In SVG coords: vertical line at x=bathSplitY, from y=obX1 to y=unit.x+unit.w
  if (br >= 2) {
    svg += `<line x1="${bathSplitY}" y1="${obX1 + pad}" x2="${bathSplitY}" y2="${unit.x + unit.w - pad}" ${lineStroke} data-type="room-line"/>`;
  }

  // --- Labels (SVG coords: layout y→SVG x, layout x→SVG y) ---

  // Living / Kitchen: front section, full width
  const livingCenterY = (unit.y + obY0) / 2;
  const livingCenterX = unit.x + unit.w / 2;
  svg += `<text x="${livingCenterY}" y="${livingCenterX}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">Living / Kitchen</text>`;

  // BR 1: left strip
  if (br >= 1) {
    const br1CenterY = (obY0 + obY1) / 2;
    svg += `<text x="${br1CenterY}" y="${leftMidX}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">BR 1</text>`;
  }

  if (br >= 2) {
    // BR 2: right strip upper
    const br2CenterY = (obY0 + bathSplitY) / 2;
    svg += `<text x="${br2CenterY}" y="${rightMidX}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">BR 2</text>`;

    // Bath: right strip lower
    const bathCenterY = (bathSplitY + obY1) / 2;
    svg += `<text x="${bathCenterY}" y="${rightMidX}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">Bath</text>`;
  } else {
    // 1 BR: Bath takes entire right strip
    const bathCenterY = (obY0 + obY1) / 2;
    svg += `<text x="${bathCenterY}" y="${rightMidX}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">Bath</text>`;
  }

  return svg;
}

// Render label inside a staircase rect (coordinates swapped)
function renderStairLabel(stair) {
  const cx = stair.x + stair.w / 2;
  const cy = stair.y + stair.d / 2;
  const fontSize = Math.min(stair.w * 0.45, stair.d * 0.12, 2.5);
  return `<text x="${cy}" y="${cx}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" fill="rgba(255,255,255,0.85)" font-family="'Outfit', sans-serif" font-weight="700" letter-spacing="0.1" data-type="stair-label">STAIR</text>`;
}

// Render label inside a hallway rect (coordinates swapped)
function renderHallLabel(hall) {
  const cx = hall.x + hall.w / 2;
  const cy = hall.y + hall.d / 2;
  const fontSize = Math.min(hall.w * 0.35, hall.d * 0.04, 2);
  // Rotate when visually tall and narrow after coordinate swap (w > d*2)
  const rotate = hall.w > hall.d * 2 ? `transform="rotate(90 ${cy} ${cx})"` : "";
  return `<text x="${cy}" y="${cx}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" fill="rgba(255,255,255,0.75)" font-family="'Outfit', sans-serif" font-weight="600" letter-spacing="0.08" ${rotate} data-type="hall-label">HALL</text>`;
}

// Split a unit rect into sub-rects that don't overlap any hallway.
// Handles a vertical corridor splitting a unit into left/right halves.
function clipUnitAroundHallways(unit, hallways) {
  let rects = [{ x: unit.x, y: unit.y, w: unit.w, d: unit.d }];
  for (const hall of hallways) {
    const next = [];
    for (const r of rects) {
      // Check overlap
      const overlapX0 = Math.max(r.x, hall.x);
      const overlapX1 = Math.min(r.x + r.w, hall.x + hall.w);
      const overlapY0 = Math.max(r.y, hall.y);
      const overlapY1 = Math.min(r.y + r.d, hall.y + hall.d);
      if (overlapX0 >= overlapX1 || overlapY0 >= overlapY1) {
        // No overlap, keep rect as-is
        next.push(r);
        continue;
      }
      // Split into up to 4 rects around the hallway (left, right, top, bottom)
      // Left strip
      if (r.x < hall.x) {
        next.push({ x: r.x, y: r.y, w: hall.x - r.x, d: r.d });
      }
      // Right strip
      if (r.x + r.w > hall.x + hall.w) {
        next.push({ x: hall.x + hall.w, y: r.y, w: (r.x + r.w) - (hall.x + hall.w), d: r.d });
      }
      // Top strip (between left and right, above hallway)
      const midX0 = Math.max(r.x, hall.x);
      const midX1 = Math.min(r.x + r.w, hall.x + hall.w);
      if (r.y < hall.y && midX1 > midX0) {
        next.push({ x: midX0, y: r.y, w: midX1 - midX0, d: hall.y - r.y });
      }
      // Bottom strip (between left and right, below hallway)
      if (r.y + r.d > hall.y + hall.d && midX1 > midX0) {
        next.push({ x: midX0, y: hall.y + hall.d, w: midX1 - midX0, d: (r.y + r.d) - (hall.y + hall.d) });
      }
    }
    rects = next;
  }
  // If no hallway overlapped, return original
  return rects.length > 0 ? rects : [{ x: unit.x, y: unit.y, w: unit.w, d: unit.d }];
}

function renderFloorPlanSVG(layout, floorIndex) {
  const floor = layout.floors[floorIndex];
  const bw = layout.lot.buildableWidth;
  const bd = layout.lot.buildableDepth;
  // Swapped: depth runs horizontally
  const svgW = bd * SCALE;
  const svgH = bw * SCALE;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bd} ${bw}" width="${svgW}" height="${svgH}">`;

  // Lot boundary (swapped dimensions)
  svg += `<rect x="0" y="0" width="${bd}" height="${bw}" fill="none" stroke="#555" stroke-width="0.5" stroke-dasharray="2,2" data-type="lot-boundary" rx="0.5"/>`;

  // Units (x↔y, w↔d swapped)
  // Clip unit rects to exclude overlapping hallways (e.g. ground-floor entry corridors)
  for (const unit of floor.units) {
    const unitFill = "#EDE8DF";

    if (unit.position === "full") {
      // Full-floor unit: render as a single C-shaped SVG path to avoid internal seam lines
      const obstruction = computeCombinedObstruction(floor.hallways, floor.staircases);
      if (obstruction) {
        // SVG coords: layout y→SVG x, layout x→SVG y
        const ux = unit.y, uy = unit.x, uw = unit.d, uh = unit.w;
        const obSvgX = obstruction.y;           // layout y → SVG x
        const obSvgY = obstruction.x;           // layout x → SVG y
        const obSvgW = obstruction.d;           // layout d → SVG width
        const obSvgH = obstruction.w;           // layout w → SVG height
        // C-shape: outer rect with notch cut out for obstruction
        const path = `M ${ux},${uy} L ${ux + uw},${uy} L ${ux + uw},${obSvgY} L ${obSvgX + obSvgW},${obSvgY} L ${obSvgX + obSvgW},${obSvgY + obSvgH} L ${ux + uw},${obSvgY + obSvgH} L ${ux + uw},${uy + uh} L ${ux},${uy + uh} Z`;
        svg += `<path d="${path}" fill="${unitFill}" stroke="#4A4A55" stroke-width="0.4" data-type="unit" data-id="${unit.id}"/>`;
      } else {
        // Fallback: no obstruction, render as rect
        svg += `<rect x="${unit.y}" y="${unit.x}" width="${unit.d}" height="${unit.w}" fill="${unitFill}" stroke="#4A4A55" stroke-width="0.4" data-type="unit" data-id="${unit.id}" rx="0.3"/>`;
      }
    } else {
      const unitRects = clipUnitAroundHallways(unit, floor.hallways);
      for (const r of unitRects) {
        svg += `<rect x="${r.y}" y="${r.x}" width="${r.d}" height="${r.w}" fill="${unitFill}" stroke="#4A4A55" stroke-width="0.4" data-type="unit" data-id="${unit.id}" rx="0.3"/>`;
      }
    }

    // Unit label — positioned near top edge as header (swapped coordinates)
    const cy = unit.y + unit.d / 2;
    const labelText = `Unit ${unit.id} · ${Math.round(unit.sqft)} sf · ${unit.bedrooms} BR`;
    const fontSize = Math.min(unit.d * 0.06, (unit.w * 0.9) / (labelText.length * 0.55)) * 0.85;
    const cx = unit.x + fontSize * 1.1;
    svg += `<text x="${cy}" y="${cx}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" fill="#5A574F" font-family="'Outfit', sans-serif" font-weight="600" data-type="unit-label">${labelText}</text>`;

    // Room subdivisions
    svg += renderRoomLayout(unit, floor.hallways, floor.staircases);
  }

  // Staircases (swapped)
  for (const stair of floor.staircases) {
    svg += `<rect x="${stair.y}" y="${stair.x}" width="${stair.d}" height="${stair.w}" fill="#D64545" opacity="0.85" stroke="#A63333" stroke-width="0.3" data-type="staircase" class="staircase" rx="0.3"/>`;
    // Stair step lines (vertical after swap)
    const steps = 5;
    for (let s = 1; s < steps; s++) {
      const sx = stair.y + (stair.d / steps) * s;
      svg += `<line x1="${sx}" y1="${stair.x}" x2="${sx}" y2="${stair.x + stair.w}" stroke="#A63333" stroke-width="0.15"/>`;
    }
    svg += renderStairLabel(stair);
  }

  // Hallways (swapped)
  for (const hall of floor.hallways) {
    svg += `<rect x="${hall.y}" y="${hall.x}" width="${hall.d}" height="${hall.w}" fill="#D4903A" opacity="0.65" stroke="#A36D2A" stroke-width="0.3" data-type="hallway" rx="0.3"/>`;
    svg += renderHallLabel(hall);
  }

  svg += `</svg>`;
  return svg;
}

function renderComparator(config, floorIndex) {
  const current = generateLayout({ ...config, stair: "current" });
  const reform = generateLayout({ ...config, stair: "reform" });

  const currentSVG = renderFloorPlanSVG(current, floorIndex);
  const reformSVG = renderFloorPlanSVG(reform, floorIndex);

  const currentFloor = current.floors[floorIndex];
  const reformFloor = reform.floors[floorIndex];

  const currLivable = currentFloor.units.reduce((s, u) => s + u.sqft, 0);
  const refLivable = reformFloor.units.reduce((s, u) => s + u.sqft, 0);
  const deltaArea = refLivable - currLivable;
  const deltaPct = currLivable > 0 ? ((deltaArea / currLivable) * 100).toFixed(0) : 0;
  const deltaSign = deltaArea >= 0 ? "+" : "";

  let html = `<div class="comparator">`;
  html += `<div class="floor-plan">`;
  html += `<div class="plan-label-current">Current Code</div>`;
  html += currentSVG;
  html += `</div>`;

  html += `<div class="delta-callout">`;
  html += `<div class="delta-item">${deltaSign}${Math.round(deltaArea)} sf (${deltaSign}${deltaPct}%)</div>`;
  html += `</div>`;

  html += `<div class="floor-plan">`;
  html += `<div class="plan-label-reform">Single Stair Reform</div>`;
  html += reformSVG;
  html += `</div>`;

  html += `</div>`;
  return html;
}

// Make available globally (browser) and for Node require
if (typeof module !== "undefined" && module.exports) {
  module.exports = { renderFloorPlanSVG, renderComparator, computeCombinedObstruction };
}
