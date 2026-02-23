// Single Stair Visualizer — SVG Renderer
// Renders layout engine output as SVG floor plans
// Coordinate swap: layout Y → SVG X, layout X → SVG Y (depth runs left-to-right)

const SCALE = 5; // pixels per foot

// Render dashed room partitions and labels inside a unit
// hallways (optional): used to constrain lines/labels to the largest unobstructed strip
function renderRoomLayout(unit, hallways) {
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
  if (unit.position === "full" && hallways) {
    for (const hall of hallways) {
      const overlapX = Math.min(x + w, hall.x + hall.w) - Math.max(x, hall.x);
      const overlapY = Math.min(y + d, hall.y + hall.d) - Math.max(y, hall.y);
      if (overlapX > 0 && overlapY > 0) {
        return renderFullFloorRoomLayout(unit, hall, br);
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

// Render room layout for a full-floor unit that wraps around a corridor.
// The corridor creates two strips (left/right of it in layout, top/bottom in SVG).
// Room zones and labels are placed in these strips, never crossing the corridor.
function renderFullFloorRoomLayout(unit, hall, br) {
  let svg = "";
  const pad = 0.3;
  const lineStroke = `stroke="#8B8680" stroke-width="0.2" stroke-dasharray="1,0.8"`;

  // Obstruction zone in layout x (stair + corridor column)
  const obX0 = hall.x;                 // e.g. 8
  const obX1 = hall.x + hall.w;        // e.g. 12

  // Two strips on either side of the corridor
  const topX = unit.x;                 // 0
  const topW = obX0 - unit.x;          // 8  (SVG: top strip)
  const botX = obX1;                   // 12
  const botW = (unit.x + unit.w) - obX1; // 8  (SVG: bottom strip)
  const topMid = topX + topW / 2;      // 4
  const botMid = botX + botW / 2;      // 16

  // Room zones along depth (same as standard front layout)
  const y = unit.y;
  const d = unit.d;
  const livingStart = y;
  const livingEnd = y + d * 0.40;
  const brStart = livingEnd;
  const brEnd = y + d * 0.80;
  const bathStart = brEnd;
  const bathEnd = y + d;

  const line1 = livingEnd;
  const line2 = brEnd;

  // Zone partition lines — two segments each, skipping corridor column
  svg += `<line x1="${line1}" y1="${topX + pad}" x2="${line1}" y2="${topX + topW - pad}" ${lineStroke} data-type="room-line"/>`;
  svg += `<line x1="${line1}" y1="${botX + pad}" x2="${line1}" y2="${botX + botW - pad}" ${lineStroke} data-type="room-line"/>`;
  svg += `<line x1="${line2}" y1="${topX + pad}" x2="${line2}" y2="${topX + topW - pad}" ${lineStroke} data-type="room-line"/>`;
  svg += `<line x1="${line2}" y1="${botX + pad}" x2="${line2}" y2="${botX + botW - pad}" ${lineStroke} data-type="room-line"/>`;

  // Bedroom partitions — one in each strip
  if (br >= 2) {
    // With 2 BRs split across strips: BR 1 in top strip, BR 2 in bottom strip
    // No partition lines needed — each strip IS one bedroom
  }

  // Labels
  const labelSize = Math.min(d * 0.045, topW * 0.15, 2.2);
  const labelFill = "#7A756E";

  // Living/Kitchen — centered in the living zone, label in each strip
  svg += `<text x="${(livingStart + livingEnd) / 2}" y="${topMid}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">Living / Kitchen</text>`;

  // Bedroom labels — one per strip
  if (br >= 1) {
    svg += `<text x="${(brStart + brEnd) / 2}" y="${topMid}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">BR 1</text>`;
  }
  if (br >= 2) {
    svg += `<text x="${(brStart + brEnd) / 2}" y="${botMid}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">BR 2</text>`;
  }

  // Bath — in bottom strip (near entry/corridor)
  svg += `<text x="${(bathStart + bathEnd) / 2}" y="${botMid}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">Bath</text>`;

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
    const unitRects = clipUnitAroundHallways(unit, floor.hallways);
    for (const r of unitRects) {
      svg += `<rect x="${r.y}" y="${r.x}" width="${r.d}" height="${r.w}" fill="${unitFill}" stroke="#4A4A55" stroke-width="0.4" data-type="unit" data-id="${unit.id}" rx="0.3"/>`;
    }

    // Unit label — positioned near top edge as header (swapped coordinates)
    const cy = unit.y + unit.d / 2;
    const labelText = `Unit ${unit.id} · ${Math.round(unit.sqft)} sf · ${unit.bedrooms} BR`;
    const fontSize = Math.min(unit.d * 0.06, (unit.w * 0.9) / (labelText.length * 0.55)) * 0.85;
    const cx = unit.x + fontSize * 1.1;
    svg += `<text x="${cy}" y="${cx}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" fill="#5A574F" font-family="'Outfit', sans-serif" font-weight="600" data-type="unit-label">${labelText}</text>`;

    // Room subdivisions
    svg += renderRoomLayout(unit, floor.hallways);
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
  module.exports = { renderFloorPlanSVG, renderComparator };
}
