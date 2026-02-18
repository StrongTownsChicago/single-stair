// Single Stair Visualizer — SVG Renderer
// Renders layout engine output as SVG floor plans

const SCALE = 5; // pixels per foot

// Render dashed room partitions and labels inside a unit
function renderRoomLayout(unit) {
  const br = unit.bedrooms;
  if (br < 1) return "";

  let svg = "";
  const x = unit.x;
  const y = unit.y;
  const w = unit.w;
  const d = unit.d;
  const pad = 0.3;

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

  // Dashed partition lines between zones
  const line1 = isRear ? bathEnd : livingEnd;
  const line2 = isRear ? brEnd : brEnd;
  svg += `<line x1="${x + pad}" y1="${line1}" x2="${x + w - pad}" y2="${line1}" stroke="#8B8680" stroke-width="0.2" stroke-dasharray="1,0.8" data-type="room-line"/>`;
  svg += `<line x1="${x + pad}" y1="${line2}" x2="${x + w - pad}" y2="${line2}" stroke="#8B8680" stroke-width="0.2" stroke-dasharray="1,0.8" data-type="room-line"/>`;

  // Vertical partitions between bedrooms
  if (br >= 2) {
    for (let i = 1; i < br; i++) {
      const bx = x + (w / br) * i;
      svg += `<line x1="${bx}" y1="${brStart + pad}" x2="${bx}" y2="${brEnd - pad}" stroke="#8B8680" stroke-width="0.2" stroke-dasharray="1,0.8" data-type="room-line"/>`;
    }
  }

  // Room labels — small, muted
  const labelSize = Math.min(d * 0.045, w * 0.08, 2.2);
  const labelFill = "#7A756E";

  // Living/Kitchen label
  svg += `<text x="${x + w / 2}" y="${(livingStart + livingEnd) / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">Living / Kitchen</text>`;

  // Bedroom labels
  for (let i = 0; i < br; i++) {
    const bx = x + (w / br) * i + (w / br) / 2;
    const by = (brStart + brEnd) / 2;
    svg += `<text x="${bx}" y="${by}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">BR ${i + 1}</text>`;
  }

  // Bath label
  svg += `<text x="${x + w / 2}" y="${(bathStart + bathEnd) / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize.toFixed(2)}" fill="${labelFill}" font-family="'Outfit', sans-serif" data-type="room-label">Bath</text>`;

  return svg;
}

// Render label inside a staircase rect
function renderStairLabel(stair) {
  const cx = stair.x + stair.w / 2;
  const cy = stair.y + stair.d / 2;
  const fontSize = Math.min(stair.w * 0.45, stair.d * 0.12, 2.5);
  return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" fill="rgba(255,255,255,0.85)" font-family="'Outfit', sans-serif" font-weight="700" letter-spacing="0.1" data-type="stair-label">STAIR</text>`;
}

// Render label inside a hallway rect
function renderHallLabel(hall) {
  const cx = hall.x + hall.w / 2;
  const cy = hall.y + hall.d / 2;
  const fontSize = Math.min(hall.w * 0.35, hall.d * 0.04, 2);
  // Vertical text for tall narrow hallways
  const rotate = hall.d > hall.w * 2 ? `transform="rotate(90 ${cx} ${cy})"` : "";
  return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" fill="rgba(255,255,255,0.75)" font-family="'Outfit', sans-serif" font-weight="600" letter-spacing="0.08" ${rotate} data-type="hall-label">HALL</text>`;
}

function renderFloorPlanSVG(layout, floorIndex) {
  const floor = layout.floors[floorIndex];
  const bw = layout.lot.buildableWidth;
  const bd = layout.lot.buildableDepth;
  const svgW = bw * SCALE;
  const svgH = bd * SCALE;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bw} ${bd}" width="${svgW}" height="${svgH}">`;

  // Lot boundary
  svg += `<rect x="0" y="0" width="${bw}" height="${bd}" fill="none" stroke="#555" stroke-width="0.5" stroke-dasharray="2,2" data-type="lot-boundary" rx="0.5"/>`;

  // Units
  for (const unit of floor.units) {
    const unitFill = "#EDE8DF";
    svg += `<rect x="${unit.x}" y="${unit.y}" width="${unit.w}" height="${unit.d}" fill="${unitFill}" stroke="#4A4A55" stroke-width="0.4" data-type="unit" data-id="${unit.id}" rx="0.3"/>`;

    // Unit label
    const cx = unit.x + unit.w / 2;
    const cy = unit.y + unit.d / 2;
    const labelText = `Unit ${unit.id} · ${Math.round(unit.sqft)} sf · ${unit.bedrooms} BR`;
    const fontSize = Math.min(unit.d * 0.08, (unit.w * 0.9) / (labelText.length * 0.55));
    svg += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" fill="#2C2C35" font-family="'Outfit', sans-serif" data-type="unit-label">${labelText}</text>`;

    // Room subdivisions
    svg += renderRoomLayout(unit);
  }

  // Staircases
  for (const stair of floor.staircases) {
    svg += `<rect x="${stair.x}" y="${stair.y}" width="${stair.w}" height="${stair.d}" fill="#D64545" opacity="0.85" stroke="#A63333" stroke-width="0.3" data-type="staircase" class="staircase" rx="0.3"/>`;
    // Stair step lines
    const steps = 5;
    for (let s = 1; s < steps; s++) {
      const sy = stair.y + (stair.d / steps) * s;
      svg += `<line x1="${stair.x}" y1="${sy}" x2="${stair.x + stair.w}" y2="${sy}" stroke="#A63333" stroke-width="0.15"/>`;
    }
    svg += renderStairLabel(stair);
  }

  // Hallways
  for (const hall of floor.hallways) {
    svg += `<rect x="${hall.x}" y="${hall.y}" width="${hall.w}" height="${hall.d}" fill="#D4903A" opacity="0.65" stroke="#A36D2A" stroke-width="0.3" data-type="hallway" rx="0.3"/>`;
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
