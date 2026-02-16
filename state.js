// Single Stair Visualizer — URL State Management
// Encodes/decodes configuration to/from URL hash

const VALID_LOTS = ["single", "double", "corner"];
const VALID_STAIRS = ["current", "reform"];
const VALID_GROUNDS = ["residential", "commercial"];
const VALID_BUILDING_TYPES = ["standard", "L", "U"];
const MIN_STORIES = 2;
const MAX_STORIES = 4;

const DEFAULTS = {
  lot: "single",
  stories: 3,
  stair: "current",
  ground: "residential",
  buildingType: "standard",
};

function encodeConfigToHash(config) {
  const params = new URLSearchParams();
  if (config.lot) params.set("lot", config.lot);
  if (config.stories) params.set("stories", String(config.stories));
  if (config.stair) params.set("stair", config.stair);
  if (config.ground) params.set("ground", config.ground);
  if (config.buildingType) params.set("building", config.buildingType);
  return "#" + params.toString();
}

function decodeHashToConfig(hash) {
  const str = (hash || "").replace(/^#/, "");
  const params = new URLSearchParams(str);

  const lot = params.get("lot");
  const storiesRaw = parseInt(params.get("stories"), 10);
  const stair = params.get("stair");
  const ground = params.get("ground");
  const building = params.get("building");

  return {
    lot: VALID_LOTS.includes(lot) ? lot : DEFAULTS.lot,
    stories: isNaN(storiesRaw)
      ? DEFAULTS.stories
      : Math.max(MIN_STORIES, Math.min(MAX_STORIES, storiesRaw)),
    stair: VALID_STAIRS.includes(stair) ? stair : DEFAULTS.stair,
    ground: VALID_GROUNDS.includes(ground) ? ground : DEFAULTS.ground,
    buildingType: VALID_BUILDING_TYPES.includes(building) ? building : DEFAULTS.buildingType,
  };
}

// Make available globally (browser) and for Node require
if (typeof module !== "undefined" && module.exports) {
  module.exports = { encodeConfigToHash, decodeHashToConfig };
}
