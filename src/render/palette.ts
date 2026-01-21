export const PALETTE = {
  background: {
    top: "#dbe8f2",
    bottom: "#cfe2cf"
  },
  ui: {
    panel: "rgba(252, 248, 240, 0.94)",
    panelSoft: "rgba(248, 242, 232, 0.86)",
    panelEdge: "rgba(50, 44, 36, 0.2)",
    panelShadow: "rgba(18, 16, 12, 0.22)",
    text: "#2a2722",
    textMuted: "rgba(42, 39, 34, 0.65)",
    accent: "#e4b86b",
    accentDeep: "#b8843d",
    accentSoft: "rgba(228, 184, 107, 0.2)",
    disabled: "rgba(120, 120, 120, 0.38)"
  },
  materials: {
    grass: "#8ebc7d",
    soil: "#b48a5c",
    path: "#c6b08c",
    water: "#6ca7c8",
    rock: "#9a8f80",
    farmDry: "#b17b50",
    farmTilled: "#9b6b43",
    farmWatered: "#718291",
    shopFloor: "#c9ac7f"
  },
  entities: {
    playerCloth: "#5b6d84",
    playerAccent: "#f0d8c6",
    shopCloth: "#5b7a73",
    shopApron: "#d9c7a4",
    skin: "#f2d6c3",
    hair: "#4a3b32"
  },
  crops: {
    carrot: "#e57a3b",
    potato: "#c2a071",
    strawberry: "#d96282",
    leaf: "#6aa36e"
  },
  effects: {
    highlight: "rgba(255, 255, 255, 0.4)",
    tileHighlight: "rgba(255, 255, 255, 0.16)",
    tileHighlightFarm: "rgba(255, 240, 205, 0.22)",
    marker: "rgba(246, 196, 104, 0.6)",
    markerStroke: "rgba(245, 178, 92, 0.9)",
    shadow: "rgba(8, 9, 12, 0.26)"
  },
  uiFont: "'Manrope', 'Avenir Next', 'Trebuchet MS', sans-serif"
} as const;

export function shadeColor(color: string, amount: number): string {
  const rgb = parseColor(color);
  if (!rgb) {
    return color;
  }
  const target = amount < 0 ? 0 : 255;
  const mix = Math.min(1, Math.max(0, Math.abs(amount)));
  const r = Math.round((target - rgb.r) * mix + rgb.r);
  const g = Math.round((target - rgb.g) * mix + rgb.g);
  const b = Math.round((target - rgb.b) * mix + rgb.b);
  return `rgb(${r}, ${g}, ${b})`;
}

export function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color);
  if (!rgb) {
    return color;
  }
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (color.startsWith("#")) {
    return hexToRgb(color);
  }
  if (color.startsWith("rgb")) {
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) {
      return null;
    }
    const parts = match[1].split(",").map((value) => Number.parseFloat(value.trim()));
    if (parts.length < 3 || parts.some((value) => Number.isNaN(value))) {
      return null;
    }
    return {
      r: Math.round(parts[0]),
      g: Math.round(parts[1]),
      b: Math.round(parts[2])
    };
  }
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length !== 6) {
    return null;
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}
