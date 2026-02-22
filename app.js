// Single Stair Visualizer — App Controller
// Extracted from index.html inline <script> block
// ES module that imports 3D modules and references globals from plain <script> tags

import { renderBuildings, startTour, goToTourStep, endTour, getViewerState, stopRenderLoop } from './viewer3d.js';
import { advanceTour } from './tour.js';

// --- App State ---
var currentFloorIndex = 2; // Default to floor 3 (0-indexed) where reform impact is visible
var currentConfig = decodeHashToConfig(window.location.hash);

// --- DOM refs ---
var lotSelect = document.getElementById("lot-select");
var storiesGroup = document.getElementById("stories-group");
var floorSelector = document.getElementById("floor-selector");
var floorNote = document.getElementById("floor-note");
var narrativeHeadline = document.getElementById("narrative-headline");
var currentSvgEl = document.getElementById("current-svg");
var reformSvgEl = document.getElementById("reform-svg");
var deltaPanel = document.getElementById("delta-panel");
var perFloorBody = document.querySelector("#per-floor-table tbody");
var wholeBuildingBody = document.querySelector("#whole-building-table tbody");
var tooltip = document.getElementById("tooltip");
var contextPanel = document.getElementById("context-panel");

// --- Initialize controls from config ---
function syncControlsToConfig() {
  lotSelect.value = currentConfig.lot;
  var buttons = storiesGroup.querySelectorAll("button");
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    if (b.dataset.value === String(currentConfig.stories)) {
      b.classList.add("active");
    } else {
      b.classList.remove("active");
    }
  }
}

// --- Render everything ---
function render() {
  var config = {
    lot: currentConfig.lot,
    stories: currentConfig.stories,
  };

  var current = generateLayout({ lot: config.lot, stories: config.stories, stair: "current" });
  var reform = generateLayout({ lot: config.lot, stories: config.stories, stair: "reform" });

  // Clamp floor index
  if (currentFloorIndex >= currentConfig.stories) {
    currentFloorIndex = currentConfig.stories - 1;
  }

  // Floor selector
  floorSelector.innerHTML = "";
  for (var i = 0; i < currentConfig.stories; i++) {
    var btn = document.createElement("button");
    btn.textContent = "Floor " + (i + 1);
    if (i === currentFloorIndex) btn.classList.add("active");
    btn.setAttribute("data-floor", i);
    btn.addEventListener("click", function () {
      currentFloorIndex = parseInt(this.getAttribute("data-floor"), 10);
      render();
    });
    floorSelector.appendChild(btn);
  }

  // Narrative headline
  if (currentConfig.stories > 2) {
    var currFloorTemp = current.floors[currentFloorIndex];
    var refFloorTemp = reform.floors[currentFloorIndex];
    var cLiv = 0;
    for (var u = 0; u < currFloorTemp.units.length; u++) cLiv += currFloorTemp.units[u].sqft;
    var rLiv = 0;
    for (var u = 0; u < refFloorTemp.units.length; u++) rLiv += refFloorTemp.units[u].sqft;
    var dArea = Math.round(rLiv - cLiv);
    var dPct = cLiv > 0 ? Math.round(((rLiv - cLiv) / cLiv) * 100) : 0;
    narrativeHeadline.innerHTML = "Two stairways consume <strong>" + dArea + " sf (+" + dPct + "%)</strong> of this floor, limiting bedrooms.";
  } else if (currentConfig.stories <= 2) {
    narrativeHeadline.innerHTML =
      "Chicago currently allows second-story units to access a single stairway. <strong>Choose 3 or 4 stories</strong> to see what changes above the second floor.";
  } else {
    narrativeHeadline.innerHTML = "";
  }

  // Context panel
  if (currentConfig.stories > 2) {
    contextPanel.style.display = "";
    contextPanel.innerHTML = '<ul>' +
      '<li>Buildings with sprinklers and smoke alarms reduce fire spread beyond the room of origin from about <strong>46% to 2%</strong> (<a href="https://aiaaustin.org/wp-content/uploads/2024/10/AIA-Austin-Single-Stair_240618_Fire-Safety-Diagrams.pdf" target="_blank" rel="noopener" style="color: var(--accent); text-decoration: underline; text-underline-offset: 2px;">AIA Austin fire safety analysis</a>)</li>' +
      '<li>A building with <strong>5-8 units needs two stairways</strong> under current code, consuming significant floor area on narrow lots</li>' +
      '<li><a href="https://www.pew.org/en/research-and-analysis/reports/2025/02/small-single-stairway-apartment-buildings-have-strong-safety-record" target="_blank" rel="noopener" style="color: var(--accent); text-decoration: underline; text-underline-offset: 2px;">Pew research</a> finds small single-stairway buildings have a strong safety record</li>' +
      '</ul>';
  } else {
    contextPanel.style.display = "none";
  }

  // Floor note
  if (currentConfig.stories > 2) {
    floorNote.textContent =
      "Above the second story, each unit must access two stairways, requiring two stairways on a standard lot";
  } else {
    floorNote.textContent = "";
  }

  // Reusable stat row helpers
  function addStatRow(table, label, curr, ref, diff, suffix) {
    var tr = document.createElement("tr");
    var diffClass =
      diff > 0
        ? "diff-positive"
        : diff < 0
          ? "diff-negative"
          : "diff-zero";
    var diffStr =
      diff > 0
        ? "+" + diff + (suffix || "")
        : diff === 0
          ? "\u2014"
          : "" + diff + (suffix || "");
    tr.innerHTML = "<td>" + label + "</td><td>" + curr + "</td><td>" + ref + "</td><td class=\"" + diffClass + "\">" + diffStr + "</td>";
    table.appendChild(tr);
  }
  function addWbRow(label, curr, ref) {
    var tr = document.createElement("tr");
    tr.innerHTML = "<td>" + label + "</td><td>" + curr + "</td><td>" + ref + "</td>";
    wholeBuildingBody.appendChild(tr);
  }

  // Reset table headers
  var pfHead = document.querySelector("#per-floor-table thead tr");
  pfHead.innerHTML =
    "<th></th><th>Current Code</th><th>Reform</th><th>Difference</th>";
  var wbHead = document.querySelector("#whole-building-table thead tr");
  wbHead.innerHTML = "<th></th><th>Current Code</th><th>Reform</th>";
  document.getElementById("per-floor-heading").innerHTML =
    'Per-Floor Comparison (Floor <span id="stats-floor-num">' + (currentFloorIndex + 1) + '</span>)';
  document.getElementById("whole-building-heading").textContent =
    "Whole-Building Summary";

  // SVG
  currentSvgEl.innerHTML = renderFloorPlanSVG(current, currentFloorIndex);
  reformSvgEl.innerHTML = renderFloorPlanSVG(reform, currentFloorIndex);

  // Deltas for this floor
  var currFloor = current.floors[currentFloorIndex];
  var refFloor = reform.floors[currentFloorIndex];
  var currLivable = 0;
  for (var u = 0; u < currFloor.units.length; u++) currLivable += currFloor.units[u].sqft;
  var refLivable = 0;
  for (var u = 0; u < refFloor.units.length; u++) refLivable += refFloor.units[u].sqft;
  var deltaArea = refLivable - currLivable;
  var deltaPct = currLivable > 0 ? ((deltaArea / currLivable) * 100).toFixed(0) : "0";
  var currBR = 0;
  for (var u = 0; u < currFloor.units.length; u++) currBR += currFloor.units[u].bedrooms;
  var refBR = 0;
  for (var u = 0; u < refFloor.units.length; u++) refBR += refFloor.units[u].bedrooms;

  deltaPanel.innerHTML = "";
  function addDelta(value, unit, label) {
    var sign = value > 0 ? "+" : "";
    var d = document.createElement("div");
    d.className = "delta-item";
    d.innerHTML = '<span class="value">' + sign + value + unit + '</span><span class="label">' + label + '</span>';
    deltaPanel.appendChild(d);
  }

  var fullStats = computeStats(current, reform);

  addDelta(Math.round(deltaArea), " sf", "Livable Area");
  addDelta(Number(deltaPct), "%", "More Space");
  addDelta(
    refFloor.staircases.length - currFloor.staircases.length,
    "",
    "Staircases"
  );
  addDelta(refBR - currBR, "", "Bedrooms");

  // Per-floor table
  var pf = fullStats.perFloor[currentFloorIndex];
  perFloorBody.innerHTML = "";
  addStatRow(
    perFloorBody,
    "Livable Area",
    Math.round(pf.current.livableArea) + " sf",
    Math.round(pf.reform.livableArea) + " sf",
    Math.round(pf.reform.livableArea - pf.current.livableArea),
    " sf"
  );
  addStatRow(
    perFloorBody,
    "Units",
    pf.current.units,
    pf.reform.units,
    pf.reform.units - pf.current.units
  );
  addStatRow(
    perFloorBody,
    "Avg Unit Size",
    Math.round(pf.current.avgUnitSize) + " sf",
    Math.round(pf.reform.avgUnitSize) + " sf",
    Math.round(pf.reform.avgUnitSize - pf.current.avgUnitSize),
    " sf"
  );
  addStatRow(
    perFloorBody,
    "Bedrooms (est.)",
    pf.current.bedrooms,
    pf.reform.bedrooms,
    pf.reform.bedrooms - pf.current.bedrooms
  );
  addStatRow(
    perFloorBody,
    "Staircases",
    pf.current.staircases,
    pf.reform.staircases,
    pf.reform.staircases - pf.current.staircases
  );
  addStatRow(
    perFloorBody,
    "Circulation",
    Math.round(pf.current.circulationArea) + " sf",
    Math.round(pf.reform.circulationArea) + " sf",
    Math.round(pf.reform.circulationArea - pf.current.circulationArea),
    " sf"
  );

  // Whole-building table
  wholeBuildingBody.innerHTML = "";
  var wb = fullStats.wholeBuilding;
  addWbRow("Total Units", wb.current.totalUnits, wb.reform.totalUnits);
  addWbRow(
    "Total Bedrooms",
    wb.current.totalBedrooms,
    wb.reform.totalBedrooms
  );
  addWbRow(
    "Avg Unit Size",
    Math.round(wb.current.avgUnitSize) + " sf",
    Math.round(wb.reform.avgUnitSize) + " sf"
  );
  addWbRow(
    "Total Livable Area",
    Math.round(wb.current.totalLivableArea) + " sf",
    Math.round(wb.reform.totalLivableArea) + " sf"
  );
  addWbRow(
    "Space Lost to Stairs/Halls",
    Math.round(wb.current.totalCirculation) + " sf",
    Math.round(wb.reform.totalCirculation) + " sf"
  );

  // Update hero stat cards
  var s1v = document.getElementById("hero-stat1-value");
  var s1l = document.getElementById("hero-stat1-label");
  var s2v = document.getElementById("hero-stat2-value");
  var s2l = document.getElementById("hero-stat2-label");
  var s3v = document.getElementById("hero-stat3-value");
  var s3l = document.getElementById("hero-stat3-label");

  var heroStats = computeStats(current, reform);
  var hs = heroStats.wholeBuilding;
  var livPct =
    hs.current.totalLivableArea > 0
      ? Math.round(
          ((hs.reform.totalLivableArea - hs.current.totalLivableArea) /
            hs.current.totalLivableArea) *
            100
        )
      : 0;
  var currBRPerUnit = 2;
  var refBRPerUnit = 3;
  if (currentConfig.stories >= 3) {
    var f3c = current.floors[2];
    var f3r = reform.floors[2];
    var cUnits = [];
    for (var u = 0; u < f3c.units.length; u++) {
      if (f3c.units[u].type === "residential") cUnits.push(f3c.units[u]);
    }
    var rUnits = [];
    for (var u = 0; u < f3r.units.length; u++) {
      if (f3r.units[u].type === "residential") rUnits.push(f3r.units[u]);
    }
    if (cUnits.length > 0) {
      var cBRSum = 0;
      for (var u = 0; u < cUnits.length; u++) cBRSum += cUnits[u].bedrooms;
      currBRPerUnit = Math.round(cBRSum / cUnits.length);
    }
    if (rUnits.length > 0) {
      var rBRSum = 0;
      for (var u = 0; u < rUnits.length; u++) rBRSum += rUnits[u].bedrooms;
      refBRPerUnit = Math.round(rBRSum / rUnits.length);
    }
  }
  var currStairsF3 =
    currentConfig.stories >= 3 ? current.floors[2].staircases.length : 1;
  s1v.innerHTML = currStairsF3 + ' <span class="arrow">&rarr;</span> 1';
  s1l.textContent = "Staircases per Building";
  s2v.textContent = "+" + livPct + "%";
  s2l.textContent = "Livable Space per Floor";
  s3v.innerHTML = currBRPerUnit + ' <span class="arrow">&rarr;</span> ' + refBRPerUnit + " BR";
  s3l.textContent = "Bedrooms per Unit";

  // Update URL hash
  window.history.replaceState(
    null,
    "",
    encodeConfigToHash(currentConfig)
  );

  // Set up hover interactions
  setupHoverInteractions();

  // Re-render 3D view if active
  if (document.getElementById("three-tab").style.display !== "none") {
    render3D();
  }
}

// --- Hover interactions ---
function setupHoverInteractions() {
  var unitEls = document.querySelectorAll('[data-type="unit"]');
  for (var i = 0; i < unitEls.length; i++) {
    (function (el) {
      el.addEventListener("mouseenter", function (e) {
        el.style.opacity = "0.7";
        var id = el.getAttribute("data-id");
        tooltip.style.display = "block";
        tooltip.textContent = "Unit " + id;
      });
      el.addEventListener("mousemove", function (e) {
        tooltip.style.left = e.clientX + 12 + "px";
        tooltip.style.top = e.clientY + 12 + "px";
      });
      el.addEventListener("mouseleave", function () {
        el.style.opacity = "1";
        tooltip.style.display = "none";
      });
    })(unitEls[i]);
  }

  var stairEls = document.querySelectorAll('[data-type="staircase"]');
  for (var i = 0; i < stairEls.length; i++) {
    (function (el) {
      el.addEventListener("mouseenter", function (e) {
        el.style.opacity = "1";
        var w = parseFloat(el.getAttribute("width"));
        var d = parseFloat(el.getAttribute("height"));
        tooltip.style.display = "block";
        tooltip.textContent = "Staircase: " + Math.round(w * d) + " sf consumed";
      });
      el.addEventListener("mousemove", function (e) {
        tooltip.style.left = e.clientX + 12 + "px";
        tooltip.style.top = e.clientY + 12 + "px";
      });
      el.addEventListener("mouseleave", function () {
        el.style.opacity = "0.8";
        tooltip.style.display = "none";
      });
    })(stairEls[i]);
  }
}

// --- Event listeners ---
lotSelect.addEventListener("change", function () {
  currentConfig.lot = lotSelect.value;
  render();
});

var storyButtons = storiesGroup.querySelectorAll("button");
for (var i = 0; i < storyButtons.length; i++) {
  (function (btn) {
    btn.addEventListener("click", function () {
      currentConfig.stories = parseInt(btn.dataset.value, 10);
      var allBtns = storiesGroup.querySelectorAll("button");
      for (var j = 0; j < allBtns.length; j++) allBtns[j].classList.remove("active");
      btn.classList.add("active");
      render();
    });
  })(storyButtons[i]);
}

// Tab switching
var tabButtons = document.querySelectorAll(".tab-bar button");
for (var i = 0; i < tabButtons.length; i++) {
  (function (btn) {
    btn.addEventListener("click", function () {
      var allTabs = document.querySelectorAll(".tab-bar button");
      for (var j = 0; j < allTabs.length; j++) allTabs[j].classList.remove("active");
      btn.classList.add("active");
      var tab = btn.dataset.tab;
      document.getElementById("floorplan-tab").style.display =
        tab === "floorplan" ? "" : "none";
      document.getElementById("three-tab").style.display =
        tab === "3d" ? "" : "none";
      if (tab === "3d") render3D();
    });
  })(tabButtons[i]);
}

// Keyboard navigation
document.addEventListener("keydown", function (e) {
  // Tour mode: arrow keys navigate tour steps
  var tourState = getViewerState().tourState;
  if (tourState && tourState.active && !tourState.animating) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      advanceTour(tourState, -1);
      goToTourStep(tourState.currentStep);
      updateTourUI();
      return;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      advanceTour(tourState, 1);
      goToTourStep(tourState.currentStep);
      updateTourUI();
      return;
    } else if (e.key === "Escape") {
      e.preventDefault();
      endTour();
      updateTourUI();
      return;
    }
  }

  // Normal floor navigation
  if (e.key === "ArrowLeft" && currentFloorIndex > 0) {
    currentFloorIndex--;
    render();
  } else if (
    e.key === "ArrowRight" &&
    currentFloorIndex < currentConfig.stories - 1
  ) {
    currentFloorIndex++;
    render();
  }
});

// Hash change
window.addEventListener("hashchange", function () {
  currentConfig = decodeHashToConfig(window.location.hash);
  syncControlsToConfig();
  render();
});

// 3D rendering
var _render3DRaf = null;
var _isRendering3D = false;

function render3D() {
  if (_isRendering3D) return;
  cancelAnimationFrame(_render3DRaf);

  var container = document.getElementById("three-container");
  var loader = document.getElementById("three-loading");
  container.style.display = "block";
  loader.hidden = false;

  _render3DRaf = requestAnimationFrame(function () {
    // Double-rAF ensures the spinner paints before heavy work
    requestAnimationFrame(function () {
      _isRendering3D = true;
      try {
        renderBuildings(container, currentConfig);
        updateTourUI();
      } finally {
        _isRendering3D = false;
        loader.hidden = true;
      }
    });
  });
}

// Tour UI management
function updateTourUI() {
  var tourControls = document.getElementById("tour-controls");
  var tourAnnotation = document.getElementById("tour-annotation");
  var tourBtn = document.getElementById("tour-start-btn");
  var state = getViewerState().tourState;

  if (!state || !state.active) {
    tourControls.style.display = "none";
    tourAnnotation.style.display = "none";
    if (tourBtn) tourBtn.classList.remove("active");
    return;
  }

  tourControls.style.display = "flex";
  tourAnnotation.style.display = "";
  if (tourBtn) tourBtn.classList.add("active");

  var step = state.steps[state.currentStep];
  document.getElementById("tour-title").textContent = step.title;
  document.getElementById("tour-description").textContent = step.description;
  document.getElementById("tour-indicator").textContent =
    state.currentStep + 1 + " / " + state.steps.length;

  document.getElementById("tour-prev").disabled = state.currentStep === 0;
  document.getElementById("tour-next").disabled =
    state.currentStep === state.steps.length - 1;
}

// Tour button handlers
document
  .getElementById("tour-start-btn")
  .addEventListener("click", function () {
    var state = getViewerState().tourState;
    if (state && state.active) {
      endTour();
      updateTourUI();
    } else {
      startTour(currentConfig);
      updateTourUI();
    }
  });

document
  .getElementById("tour-prev")
  .addEventListener("click", function () {
    var state = getViewerState().tourState;
    if (state && state.active && !state.animating) {
      advanceTour(state, -1);
      goToTourStep(state.currentStep);
      updateTourUI();
    }
  });

document
  .getElementById("tour-next")
  .addEventListener("click", function () {
    var state = getViewerState().tourState;
    if (state && state.active && !state.animating) {
      advanceTour(state, 1);
      goToTourStep(state.currentStep);
      updateTourUI();
    }
  });

// --- Init ---
syncControlsToConfig();
render();
