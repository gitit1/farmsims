import { SETTINGS } from "../core/settings";

export interface Vec2 {
  x: number;
  y: number;
}

export function worldToScreen(
  world: Vec2,
  tileW: number = SETTINGS.TILE_W,
  tileH: number = SETTINGS.TILE_H
): Vec2 {
  return {
    x: (world.x - world.y) * (tileW / 2),
    y: (world.x + world.y) * (tileH / 2)
  };
}

export function screenToWorld(
  screen: Vec2,
  tileW: number = SETTINGS.TILE_W,
  tileH: number = SETTINGS.TILE_H
): Vec2 {
  const a = screen.x / (tileW / 2);
  const b = screen.y / (tileH / 2);
  return {
    x: (a + b) / 2,
    y: (b - a) / 2
  };
}

export function normalize(vec: Vec2): Vec2 {
  const length = Math.hypot(vec.x, vec.y);
  if (length <= 0.0001) {
    return { x: 0, y: 0 };
  }
  return { x: vec.x / length, y: vec.y / length };
}
