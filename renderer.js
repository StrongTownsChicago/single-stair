// Single Stair Visualizer — SVG Renderer
// Renders layout engine output as SVG floor plans
// Coordinate swap: layout Y → SVG X, layout X → SVG Y (depth runs left-to-right)

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
  for (const unit of floor.units) {
    const unitFill = "#EDE8DF";
    svg += `<rect x="${unit.y}" y="${unit.x}" width="${unit.d}" height="${unit.w}" fill="${unitFill}" stroke="#4A4A55" stroke-width="0.4" data-type="unit" data-id="${unit.id}" rx="0.3"/>`;

    // Unit label — positioned near top edge as header (swapped coordinates)
    const cy = unit.y + unit.d / 2;
    const labelText = `Unit ${unit.id} · ${Math.round(unit.sqft)} sf · ${unit.bedrooms} BR`;
    const fontSize = Math.min(unit.d * 0.06, (unit.w * 0.9) / (labelText.length * 0.55)) * 0.85;
    const cx = unit.x + fontSize * 1.1;
    svg += `<text x="${cy}" y="${cx}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" fill="#5A574F" font-family="'Outfit', sans-serif" font-weight="600" data-type="unit-label">${labelText}</text>`;

    // Room subdivisions
    svg += renderRoomLayout(unit);
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
