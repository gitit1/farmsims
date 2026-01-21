import type { AssetManifest } from "./assetTypes";

export const REQUIRED_ASSET_IDS = [
  "tile.grass",
  "tile.grass_a",
  "tile.grass_b",
  "tile.grass_c",
  "tile.soil",
  "tile.path",
  "tile.water",
  "tile.farm.tilled",
  "tile.farm.watered_overlay",
  "tile.shop.floor",
  "tile.trans.grass_to_path_edge",
  "tile.trans.grass_to_soil_edge",
  "tile.trans.soil_edge",
  "tile.trans.path_corner",
  "prop.shopkeeper",
  "char.player.idle",
  "crop.carrot.stage1"
] as const;

export const DEFAULT_MANIFEST: AssetManifest = {
  "tile.grass": "/assets/tiles/grass.png",
  "tile.grass_a": "/assets/tiles/grass_a.png",
  "tile.grass_b": "/assets/tiles/grass_b.png",
  "tile.grass_c": "/assets/tiles/grass_c.png",
  "tile.soil": "/assets/tiles/soil.png",
  "tile.path": "/assets/tiles/path.png",
  "tile.water": "/assets/tiles/water.png",
  "tile.farm.tilled": "/assets/tiles/farm_tilled.png",
  "tile.farm.watered_overlay": "/assets/tiles/farm_watered_overlay.png",
  "tile.shop.floor": "/assets/tiles/shop_floor.png",
  "tile.trans.grass_to_path_edge": "/assets/tiles/trans_grass_to_path_edge.png",
  "tile.trans.grass_to_soil_edge": "/assets/tiles/trans_grass_to_soil_edge.png",
  "tile.trans.soil_edge": "/assets/tiles/trans_soil_edge.png",
  "tile.trans.path_corner": "/assets/tiles/trans_path_corner.png",
  "prop.shopkeeper": "/assets/characters/shopkeeper.png",
  "char.player.idle": "/assets/characters/player_idle.png",
  "crop.carrot.stage1": "/assets/crops/carrot_stage1.png"
};
