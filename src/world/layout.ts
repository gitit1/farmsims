export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TILE_IDS = {
  grass: "tile.grass_a",
  grassA: "tile.grass_a",
  grassB: "tile.grass_b",
  grassC: "tile.grass_c",
  soil: "tile.soil",
  path: "tile.path",
  farmBase: "tile.soil",
  shopFloor: "tile.shop.floor",
  water: "tile.water",
  rock: "tile.rock",
  transGrassToPath: "tile.trans.grass_to_path_edge",
  transGrassToSoil: "tile.trans.grass_to_soil_edge",
  transSoilEdge: "tile.trans.soil_edge",
  transPathCorner: "tile.trans.path_corner"
} as const;

export const FARM_BASE_TILE_ID = TILE_IDS.farmBase;
export const SHOP_TILE_ID = TILE_IDS.shopFloor;

export const FARM_PATCH: Rect = {
  x: 10,
  y: 22,
  w: 6,
  h: 4
};

export const SHOP_AREA: Rect = {
  x: 20,
  y: 6,
  w: 6,
  h: 4
};

export const SHOPKEEPER_TILE = {
  x: 22,
  y: 7
};

export function isFarmTile(tx: number, ty: number): boolean {
  return isWithinRect(tx, ty, FARM_PATCH);
}

export function getFarmBounds(): Rect {
  return { ...FARM_PATCH };
}

export function isShopTile(tx: number, ty: number): boolean {
  return isWithinRect(tx, ty, SHOP_AREA);
}

export function isShopkeeperTile(tx: number, ty: number): boolean {
  return tx === SHOPKEEPER_TILE.x && ty === SHOPKEEPER_TILE.y;
}

export function getShopkeeperTile(): { x: number; y: number } {
  return { x: SHOPKEEPER_TILE.x, y: SHOPKEEPER_TILE.y };
}

function isWithinRect(tx: number, ty: number, rect: Rect): boolean {
  return tx >= rect.x && ty >= rect.y && tx < rect.x + rect.w && ty < rect.y + rect.h;
}
