// Single Stair Visualizer — SVG Renderer
// Renders layout engine output as SVG floor plans

const SCALE = 5; // pixels per foot

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
    const fill = unit.type === "commercial" ? "#3DA89A" : "#EDE8DF";
    svg += `<rect x="${unit.x}" y="${unit.y}" width="${unit.w}" height="${unit.d}" fill="${fill}" stroke="#4A4A55" stroke-width="0.4" data-type="unit" data-id="${unit.id}" rx="0.3"/>`;

    // Unit label
    const cx = unit.x + unit.w / 2;
    const cy = unit.y + unit.d / 2;
    const labelText = unit.type === "commercial"
      ? `Retail · ${Math.round(unit.sqft)} sf`
      : `Unit ${unit.id} · ${Math.round(unit.sqft)} sf · ${unit.bedrooms} BR`;
    const fontSize = Math.min(unit.d * 0.08, (unit.w * 0.9) / (labelText.length * 0.55));
    svg += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" fill="#2C2C35" font-family="'Outfit', sans-serif" data-type="unit-label">${labelText}</text>`;
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
  }

  // Hallways
  for (const hall of floor.hallways) {
    svg += `<rect x="${hall.x}" y="${hall.y}" width="${hall.w}" height="${hall.d}" fill="#D4903A" opacity="0.65" stroke="#A36D2A" stroke-width="0.3" data-type="hallway" rx="0.3"/>`;
  }

  // Window walls (exterior walls with windows)
  for (const unit of floor.units) {
    for (const wall of unit.windowWalls) {
      let x1, y1, x2, y2;
      switch (wall) {
        case "north":
          x1 = unit.x; y1 = unit.y; x2 = unit.x + unit.w; y2 = unit.y;
          break;
        case "south":
          x1 = unit.x; y1 = unit.y + unit.d; x2 = unit.x + unit.w; y2 = unit.y + unit.d;
          break;
        case "east":
          x1 = unit.x + unit.w; y1 = unit.y; x2 = unit.x + unit.w; y2 = unit.y + unit.d;
          break;
        case "west":
          x1 = unit.x; y1 = unit.y; x2 = unit.x; y2 = unit.y + unit.d;
          break;
        default:
          continue;
      }
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#D9B84A" stroke-width="1.2" data-type="window-wall" data-wall="${wall}" stroke-linecap="round"/>`;
    }
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

function renderCourtyardSVG(courtyardLayout, floorIndex) {
  const { segments, courtyard } = courtyardLayout;

  // Calculate bounding box from all segments + courtyard
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const seg of segments) {
    const floor = seg.floors[floorIndex];
    for (const u of floor.units) {
      minX = Math.min(minX, u.x); minY = Math.min(minY, u.y);
      maxX = Math.max(maxX, u.x + u.w); maxY = Math.max(maxY, u.y + u.d);
    }
    for (const st of floor.staircases) {
      minX = Math.min(minX, st.x); minY = Math.min(minY, st.y);
      maxX = Math.max(maxX, st.x + st.w); maxY = Math.max(maxY, st.y + st.d);
    }
  }
  const cb = courtyard.bounds;
  minX = Math.min(minX, cb.x); minY = Math.min(minY, cb.y);
  maxX = Math.max(maxX, cb.x + cb.w); maxY = Math.max(maxY, cb.y + cb.d);

  const vw = maxX - minX;
  const vh = maxY - minY;
  const svgW = vw * SCALE;
  const svgH = vh * SCALE;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${vw} ${vh}" width="${svgW}" height="${svgH}">`;

  // Courtyard open space
  svg += `<rect x="${cb.x}" y="${cb.y}" width="${cb.w}" height="${cb.d}" fill="#86efac" opacity="0.4" stroke="#16a34a" stroke-width="0.3" data-type="courtyard"/>`;
  const cyCx = cb.x + cb.w / 2;
  const cyCy = cb.y + cb.d / 2;
  const cyLabelText = `Courtyard · ${Math.round(courtyard.area)} sf`;
  const cyFontSize = Math.min(cb.d * 0.08, (cb.w * 0.9) / (cyLabelText.length * 0.55));
  svg += `<text x="${cyCx}" y="${cyCy}" text-anchor="middle" dominant-baseline="middle" font-size="${cyFontSize.toFixed(2)}" fill="#166534" data-type="courtyard-label">${cyLabelText}</text>`;

  // Render each segment
  for (const seg of segments) {
    const floor = seg.floors[floorIndex];

    // Units
    for (const unit of floor.units) {
      const fill = unit.type === "commercial" ? "#3DA89A" : "#EDE8DF";
      svg += `<rect x="${unit.x}" y="${unit.y}" width="${unit.w}" height="${unit.d}" fill="${fill}" stroke="#4A4A55" stroke-width="0.4" data-type="unit" data-id="${unit.id}" rx="0.3"/>`;
      const cx = unit.x + unit.w / 2;
      const cy = unit.y + unit.d / 2;
      const labelText = unit.type === "commercial"
        ? `Retail · ${Math.round(unit.sqft)} sf`
        : `${unit.id} · ${Math.round(unit.sqft)} sf · ${unit.bedrooms} BR`;
      const fontSize = Math.min(unit.d * 0.08, (unit.w * 0.9) / (labelText.length * 0.55));
      svg += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" fill="#2C2C35" font-family="'Outfit', sans-serif" data-type="unit-label">${labelText}</text>`;
    }

    // Staircases
    for (const stair of floor.staircases) {
      svg += `<rect x="${stair.x}" y="${stair.y}" width="${stair.w}" height="${stair.d}" fill="#D64545" opacity="0.85" stroke="#A63333" stroke-width="0.3" data-type="staircase" class="staircase" rx="0.3"/>`;
      const steps = 5;
      for (let s = 1; s < steps; s++) {
        const sy = stair.y + (stair.d / steps) * s;
        svg += `<line x1="${stair.x}" y1="${sy}" x2="${stair.x + stair.w}" y2="${sy}" stroke="#A63333" stroke-width="0.15"/>`;
      }
    }

    // Window walls
    for (const unit of floor.units) {
      for (const wall of unit.windowWalls) {
        if (wall === "courtyard") continue;
        let x1, y1, x2, y2;
        switch (wall) {
          case "north": x1 = unit.x; y1 = unit.y; x2 = unit.x + unit.w; y2 = unit.y; break;
          case "south": x1 = unit.x; y1 = unit.y + unit.d; x2 = unit.x + unit.w; y2 = unit.y + unit.d; break;
          case "east": x1 = unit.x + unit.w; y1 = unit.y; x2 = unit.x + unit.w; y2 = unit.y + unit.d; break;
          case "west": x1 = unit.x; y1 = unit.y; x2 = unit.x; y2 = unit.y + unit.d; break;
          default: continue;
        }
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#D9B84A" stroke-width="1.2" data-type="window-wall" data-wall="${wall}" stroke-linecap="round"/>`;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

// Make available globally (browser) and for Node require
if (typeof module !== "undefined" && module.exports) {
  module.exports = { renderFloorPlanSVG, renderComparator, renderCourtyardSVG };
}
