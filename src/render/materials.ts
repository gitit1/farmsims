import { PALETTE, shadeColor, withAlpha } from "./palette";

export interface Material {
  top: string;
  left: string;
  right: string;
  outline: string;
  highlight: string;
}

interface MaterialOptions {
  top: number;
  left: number;
  right: number;
  outline: number;
  highlight: number;
}

const DEFAULT_OPTIONS: MaterialOptions = {
  top: 0.08,
  left: -0.02,
  right: -0.12,
  outline: -0.35,
  highlight: 0.18
};

function makeMaterial(base: string, options?: Partial<MaterialOptions>): Material {
  const resolved: MaterialOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  return {
    top: shadeColor(base, resolved.top),
    left: shadeColor(base, resolved.left),
    right: shadeColor(base, resolved.right),
    outline: withAlpha(shadeColor(base, resolved.outline), 0.25),
    highlight: withAlpha(shadeColor(base, resolved.highlight), 0.35)
  };
}

export const MATERIALS = {
  grass: makeMaterial(PALETTE.materials.grass, { top: 0.1, left: -0.02, right: -0.14 }),
  soil: makeMaterial(PALETTE.materials.soil, { top: 0.08, left: -0.03, right: -0.15 }),
  path: makeMaterial(PALETTE.materials.path, { top: 0.06, left: -0.04, right: -0.16 }),
  water: makeMaterial(PALETTE.materials.water, { top: 0.02, left: -0.08, right: -0.18 }),
  rock: makeMaterial(PALETTE.materials.rock, { top: 0.05, left: -0.08, right: -0.2 }),
  farmDry: makeMaterial(PALETTE.materials.farmDry, { top: 0.05, left: -0.05, right: -0.18 }),
  farmTilled: makeMaterial(PALETTE.materials.farmTilled, { top: 0.04, left: -0.06, right: -0.2 }),
  farmWatered: makeMaterial(PALETTE.materials.farmWatered, { top: 0.03, left: -0.08, right: -0.22 }),
  shopFloor: makeMaterial(PALETTE.materials.shopFloor, { top: 0.06, left: -0.04, right: -0.14 })
} as const;

export function applyVariation(color: string, factor: number): string {
  const amount = factor - 1;
  if (Math.abs(amount) < 0.001) {
    return color;
  }
  return shadeColor(color, amount);
}

export function makeEntityMaterial(base: string): Material {
  return {
    top: shadeColor(base, 0.12),
    left: shadeColor(base, -0.04),
    right: shadeColor(base, -0.18),
    outline: withAlpha(shadeColor(base, -0.4), 0.35),
    highlight: withAlpha(shadeColor(base, 0.25), 0.45)
  };
}
