export const SETTINGS = {
  TILE_W: 96,
  TILE_H: 48,
  MAP_W: 30,
  MAP_H: 30,
  PLAYER_SPEED: 3.5,
  CAMERA_SMOOTHING: 7,
  TARGET_EPSILON: 0.05,
  MAX_DPR: 2,
  ZOOM_MIN: 0.6,
  ZOOM_MAX: 1.8,
  ZOOM_START: 1,
  BACKGROUND: "#dbe8f2",
  ASSETS_MANIFEST: "/assets/manifest.json",
  RENDER: {
    TILE_DEPTH: 14,
    TILE_OUTLINE: 1,
    TILE_HIGHLIGHT_INSET: 0.96,
    SHADOW_ALPHA: 0.26,
    VIGNETTE_ALPHA: 0.18
  },
  NEEDS_DECAY_PER_MIN: {
    hunger: 0.18,
    energy: 0.14,
    hygiene: 0.12,
    fun: 0.1,
    social: 0.08
  },
  COLORS: {
    grass: "#93c18e",
    soil: "#b18a5a",
    path: "#c8b089",
    shadow: "rgba(0, 0, 0, 0.12)",
    player: "#5b6f85",
    playerHighlight: "#f1d6c9",
    markerStroke: "#f2b25c",
    markerFill: "rgba(242, 178, 92, 0.25)",
    hud: "#1f2f2a"
  }
};
