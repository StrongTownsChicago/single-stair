// Single Stair Visualizer — URL State Management
// Encodes/decodes configuration to/from URL hash

const VALID_LOTS = ["single", "double"];
const VALID_STAIRS = ["current", "reform"];
const MIN_STORIES = 2;
const MAX_STORIES = 4;

const DEFAULTS = {
  lot: "single",
  stories: 3,
  stair: "current",
};

function encodeConfigToHash(config) {
  const params = new URLSearchParams();
  if (config.lot) params.set("lot", config.lot);
  if (config.stories) params.set("stories", String(config.stories));
  if (config.stair) params.set("stair", config.stair);
  return "#" + params.toString();
}

function decodeHashToConfig(hash) {
  const str = (hash || "").replace(/^#/, "");
  const params = new URLSearchParams(str);

  const lot = params.get("lot");
  const storiesRaw = parseInt(params.get("stories"), 10);
  const stair = params.get("stair");

  return {
    lot: VALID_LOTS.includes(lot) ? lot : DEFAULTS.lot,
    stories: isNaN(storiesRaw)
      ? DEFAULTS.stories
      : Math.max(MIN_STORIES, Math.min(MAX_STORIES, storiesRaw)),
    stair: VALID_STAIRS.includes(stair) ? stair : DEFAULTS.stair,
  };
}

// Make available globally (browser) and for Node require
if (typeof module !== "undefined" && module.exports) {
  module.exports = { encodeConfigToHash, decodeHashToConfig };
}
