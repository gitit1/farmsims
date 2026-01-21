import { SETTINGS } from "../core/settings";
import type { WorldMap } from "../world/map";
import { normalize, type Vec2 } from "../render/isoMath";

export interface TileCoord {
  x: number;
  y: number;
}

export class Player {
  position: Vec2;
  private moveVector: Vec2 = { x: 0, y: 0 };
  private targetTile: TileCoord | null = null;
  private stepTile: TileCoord | null = null;
  private speed: number = SETTINGS.PLAYER_SPEED;
  private speedMultiplier = 1;

  constructor(start: Vec2) {
    this.position = { x: start.x, y: start.y };
  }

  setMoveVector(vec: Vec2): void {
    this.moveVector = { x: vec.x, y: vec.y };
  }

  setTargetTile(tile: TileCoord | null): void {
    this.targetTile = tile;
    this.stepTile = null;
  }

  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, multiplier);
  }

  getTargetTile(): TileCoord | null {
    return this.targetTile;
  }

  update(dt: number, map: WorldMap): void {
    const previous = { x: this.position.x, y: this.position.y };
    let velocity: Vec2 | null = null;

    if (this.moveVector.x !== 0 || this.moveVector.y !== 0) {
      this.stepTile = null;
      velocity = normalize(this.moveVector);
    } else if (this.targetTile) {
      const targetCenter = {
        x: this.targetTile.x + 0.5,
        y: this.targetTile.y + 0.5
      };

      if (distanceTo(this.position, targetCenter) <= SETTINGS.TARGET_EPSILON) {
        this.position.x = targetCenter.x;
        this.position.y = targetCenter.y;
        this.targetTile = null;
        this.stepTile = null;
      } else {
        if (!this.stepTile || this.isAtTileCenter(this.stepTile)) {
          const currentTile = this.getTilePosition();
          if (currentTile.x === this.targetTile.x && currentTile.y === this.targetTile.y) {
            this.stepTile = currentTile;
          } else {
            const next = getGreedyStep(currentTile, this.targetTile);
            if (next && !map.isBlocked(next.x, next.y)) {
              this.stepTile = next;
            } else {
              this.targetTile = null;
              this.stepTile = null;
            }
          }
        }

        if (this.stepTile) {
          const stepCenter = { x: this.stepTile.x + 0.5, y: this.stepTile.y + 0.5 };
          velocity = normalize({
            x: stepCenter.x - this.position.x,
            y: stepCenter.y - this.position.y
          });
        }
      }
    }

    if (velocity) {
      this.moveWithCollision(velocity, dt, map);
    }

    const maxX = map.width - 0.001;
    const maxY = map.height - 0.001;
    this.position.x = clamp(this.position.x, 0, maxX);
    this.position.y = clamp(this.position.y, 0, maxY);

    if (this.targetTile && previous.x === this.position.x && previous.y === this.position.y) {
      this.targetTile = null;
      this.stepTile = null;
    }
  }

  getTilePosition(): TileCoord {
    return {
      x: Math.floor(this.position.x),
      y: Math.floor(this.position.y)
    };
  }

  private moveWithCollision(direction: Vec2, dt: number, map: WorldMap): void {
    const effectiveSpeed = this.speed * this.speedMultiplier;
    const deltaX = direction.x * effectiveSpeed * dt;
    const deltaY = direction.y * effectiveSpeed * dt;

    if (deltaX !== 0) {
      const nextX = this.position.x + deltaX;
      const tileX = Math.floor(nextX);
      const tileY = Math.floor(this.position.y);
      if (!map.isBlocked(tileX, tileY)) {
        this.position.x = nextX;
      }
    }

    if (deltaY !== 0) {
      const nextY = this.position.y + deltaY;
      const tileX = Math.floor(this.position.x);
      const tileY = Math.floor(nextY);
      if (!map.isBlocked(tileX, tileY)) {
        this.position.y = nextY;
      }
    }
  }

  private isAtTileCenter(tile: TileCoord): boolean {
    const center = { x: tile.x + 0.5, y: tile.y + 0.5 };
    return distanceTo(this.position, center) <= SETTINGS.TARGET_EPSILON;
  }
}

function getGreedyStep(current: TileCoord, target: TileCoord): TileCoord | null {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  if (dx === 0 && dy === 0) {
    return null;
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: current.x + Math.sign(dx), y: current.y };
  }
  return { x: current.x, y: current.y + Math.sign(dy) };
}

function distanceTo(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
