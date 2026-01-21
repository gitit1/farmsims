import { FARM_BASE_TILE_ID, SHOP_TILE_ID, TILE_IDS, isFarmTile, isShopTile } from "./layout";

export type TileType = "grass" | "soil" | "path" | "water" | "rock" | "farm" | "shop";

export interface Tile {
  type: TileType;
  variation: number;
  tileId: string;
  overlays: string[];
}

export class WorldMap {
  width: number;
  height: number;
  tiles: Tile[];
  blocked: boolean[];

  constructor(width: number, height: number, seed: number = 42) {
    this.width = width;
    this.height = height;
    this.tiles = [];
    this.blocked = [];
    this.generate(seed);
  }

  get(x: number, y: number): Tile | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null;
    }
    return this.tiles[y * this.width + x];
  }

  isBlocked(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return true;
    }
    return this.blocked[y * this.width + x];
  }

  private generate(seed: number): void {
    this.tiles = new Array(this.width * this.height);
    this.blocked = new Array(this.width * this.height).fill(false);
    const rand = mulberry32(seed);

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const centerPull = Math.abs(x - this.width / 2) + Math.abs(y - this.height / 2);
        const patchBias = Math.max(0, 1 - centerPull / (this.width * 0.6));
        const roll = rand();
        let type: TileType = "grass";
        if (roll + patchBias * 0.15 > 0.92) {
          type = "soil";
        } else if (roll > 0.85) {
          type = "path";
        }

        // Deterministic grass variant per tile position.
        const tileId = type === "grass" ? pickGrassVariant(x, y, WORLD_SEED) : baseTileIdForType(type);
        this.tiles[y * this.width + x] = {
          type,
          variation: 0.85 + rand() * 0.3,
          tileId,
          overlays: []
        };
      }
    }

    this.addPond({ x: Math.floor(this.width * 0.28), y: Math.floor(this.height * 0.32) }, 5, 3);
    this.addRockCluster({ x: Math.floor(this.width * 0.72), y: Math.floor(this.height * 0.64) }, 5, rand);
    this.addRockCluster({ x: Math.floor(this.width * 0.18), y: Math.floor(this.height * 0.72) }, 3, rand);

    this.applyLayout(rand);
    this.applyTransitions();
  }

  private applyLayout(rand: () => number): void {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (isFarmTile(x, y)) {
          this.setLayoutTile(x, y, "farm", FARM_BASE_TILE_ID, 0.9 + rand() * 0.15);
        } else if (isShopTile(x, y)) {
          this.setLayoutTile(x, y, "shop", SHOP_TILE_ID, 0.9 + rand() * 0.12);
        }
      }
    }
  }

  private addPond(center: { x: number; y: number }, radiusX: number, radiusY: number): void {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const dx = (x + 0.5 - center.x) / radiusX;
        const dy = (y + 0.5 - center.y) / radiusY;
        if (dx * dx + dy * dy <= 1) {
          this.setBlockedTile(x, y, "water", TILE_IDS.water, 0.9 + (Math.abs(dx) + Math.abs(dy)) * 0.05);
        }
      }
    }
  }

  private addRockCluster(
    center: { x: number; y: number },
    radius: number,
    rand: () => number
  ): void {
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        const dx = x + 0.5 - center.x;
        const dy = y + 0.5 - center.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= radius && rand() > 0.25 + distance / (radius * 2)) {
          this.setBlockedTile(x, y, "rock", TILE_IDS.rock, 0.85 + rand() * 0.2);
        }
      }
    }
  }

  private setBlockedTile(x: number, y: number, type: TileType, tileId: string, variation: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }
    const index = y * this.width + x;
    const tile = this.tiles[index];
    if (!tile) {
      return;
    }
    this.tiles[index] = {
      type,
      variation,
      tileId,
      overlays: []
    };
    this.blocked[index] = true;
  }

  private setLayoutTile(x: number, y: number, type: TileType, tileId: string, variation: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }
    const index = y * this.width + x;
    const tile = this.tiles[index];
    if (!tile) {
      return;
    }
    this.tiles[index] = {
      type,
      variation,
      tileId,
      overlays: []
    };
    this.blocked[index] = false;
  }

  private applyTransitions(): void {
    // Minimal neighbor-based overlays for softer edges.
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ];

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const tile = this.tiles[y * this.width + x];
        if (!tile) {
          continue;
        }
        tile.overlays = [];

        if (isPath(tile.type)) {
          let hasGrassNeighbor = false;
          for (const dir of directions) {
            const neighborType = getNeighborType(this.tiles, this.width, this.height, x + dir.dx, y + dir.dy);
            if (isGrass(neighborType)) {
              hasGrassNeighbor = true;
            }
          }
          if (hasGrassNeighbor) {
            tile.overlays.push(TILE_IDS.transGrassToPath);
          }

          const northGrass = isGrass(getNeighborType(this.tiles, this.width, this.height, x, y - 1));
          const eastGrass = isGrass(getNeighborType(this.tiles, this.width, this.height, x + 1, y));
          const southGrass = isGrass(getNeighborType(this.tiles, this.width, this.height, x, y + 1));
          const westGrass = isGrass(getNeighborType(this.tiles, this.width, this.height, x - 1, y));

          if (northGrass && eastGrass) {
            tile.overlays.push(TILE_IDS.transPathCorner);
          } else if (eastGrass && southGrass) {
            tile.overlays.push(TILE_IDS.transPathCorner);
          } else if (southGrass && westGrass) {
            tile.overlays.push(TILE_IDS.transPathCorner);
          } else if (westGrass && northGrass) {
            tile.overlays.push(TILE_IDS.transPathCorner);
          }
        }

        if (isSoilOrFarm(tile.type)) {
          let hasGrassNeighbor = false;
          let hasNonSoilNeighbor = false;
          for (const dir of directions) {
            const neighborType = getNeighborType(this.tiles, this.width, this.height, x + dir.dx, y + dir.dy);
            if (isGrass(neighborType)) {
              hasGrassNeighbor = true;
            } else if (neighborType && !isSoilOrFarm(neighborType)) {
              hasNonSoilNeighbor = true;
            }
          }
          if (hasGrassNeighbor) {
            tile.overlays.push(TILE_IDS.transGrassToSoil);
          } else if (hasNonSoilNeighbor) {
            tile.overlays.push(TILE_IDS.transSoilEdge);
          }
        }
      }
    }
  }
}

function baseTileIdForType(type: TileType): string {
  if (type === "soil") {
    return TILE_IDS.soil;
  }
  if (type === "path") {
    return TILE_IDS.path;
  }
  if (type === "water") {
    return TILE_IDS.water;
  }
  if (type === "rock") {
    return TILE_IDS.rock;
  }
  if (type === "shop") {
    return SHOP_TILE_ID;
  }
  if (type === "farm") {
    return FARM_BASE_TILE_ID;
  }
  return TILE_IDS.grass;
}

const WORLD_SEED = 1337;

function pickGrassVariant(x: number, y: number, seed: number): string {
  const roll = hash01(x, y, seed);
  if (roll < 0.7) {
    return TILE_IDS.grassA;
  }
  if (roll < 0.9) {
    return TILE_IDS.grassB;
  }
  return TILE_IDS.grassC;
}

function isGrass(type: TileType | null): boolean {
  return type === "grass";
}

function isSoilOrFarm(type: TileType | null): boolean {
  return type === "soil" || type === "farm";
}

function isPath(type: TileType | null): boolean {
  return type === "path";
}

function getNeighborType(tiles: Tile[], width: number, height: number, x: number, y: number): TileType | null {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return null;
  }
  return tiles[y * width + x]?.type ?? null;
}

function hash01(x: number, y: number, seed: number): number {
  const hash = hash2d(x, y, seed);
  return hash / 4294967295;
}

function hash2d(x: number, y: number, seed: number): number {
  let n = x * 374761393 + y * 668265263 + seed * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  return (n ^ (n >> 16)) >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let n = t;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
