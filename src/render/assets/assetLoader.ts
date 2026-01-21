import { SETTINGS } from "../../core/settings";
import { createPlaceholderCanvas } from "./placeholders";
import { DEFAULT_MANIFEST } from "./manifest";
import type { AssetAnchor, AssetDefinition, AssetManifest, AssetSize, LoadedAsset } from "./assetTypes";

const TILE_SIZE: AssetSize = { w: SETTINGS.TILE_W, h: SETTINGS.TILE_H };
const CHARACTER_SIZE: AssetSize = { w: 96, h: 128 };
const CROP_SIZE: AssetSize = { w: 64, h: 64 };

const ANCHOR_CENTER: AssetAnchor = { x: 0.5, y: 0.5 };
const ANCHOR_FEET: AssetAnchor = { x: 0.5, y: 1 };

const DEFAULT_DEFINITIONS: Record<string, AssetDefinition> = {
  "tile.grass": { id: "tile.grass", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "tile.grass_a": { id: "tile.grass_a", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "tile.grass_b": { id: "tile.grass_b", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "tile.grass_c": { id: "tile.grass_c", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "tile.soil": { id: "tile.soil", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "tile.path": { id: "tile.path", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "tile.farm.tilled": { id: "tile.farm.tilled", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "tile.farm.watered_overlay": { id: "tile.farm.watered_overlay", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "tile.shop.floor": { id: "tile.shop.floor", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "tile.water": { id: "tile.water", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "tile.rock": { id: "tile.rock", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "tile.trans.grass_to_path_edge": {
    id: "tile.trans.grass_to_path_edge",
    size: TILE_SIZE,
    anchor: ANCHOR_CENTER,
    kind: "tile"
  },
  "tile.trans.grass_to_soil_edge": {
    id: "tile.trans.grass_to_soil_edge",
    size: TILE_SIZE,
    anchor: ANCHOR_CENTER,
    kind: "tile"
  },
  "tile.trans.soil_edge": { id: "tile.trans.soil_edge", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "tile.trans.path_corner": { id: "tile.trans.path_corner", size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" },
  "char.player.idle": { id: "char.player.idle", size: CHARACTER_SIZE, anchor: ANCHOR_FEET, kind: "entity" },
  "prop.shopkeeper": { id: "prop.shopkeeper", size: CHARACTER_SIZE, anchor: ANCHOR_FEET, kind: "prop" },
  "crop.carrot.stage1": { id: "crop.carrot.stage1", size: CROP_SIZE, anchor: ANCHOR_FEET, kind: "crop" },
  "crop.potato.stage1": { id: "crop.potato.stage1", size: CROP_SIZE, anchor: ANCHOR_FEET, kind: "crop" },
  "crop.strawberry.stage1": { id: "crop.strawberry.stage1", size: CROP_SIZE, anchor: ANCHOR_FEET, kind: "crop" }
};

class AssetLoader {
  private manifest: AssetManifest = DEFAULT_MANIFEST;
  private assets = new Map<string, LoadedAsset>();
  private loadingIds = new Set<string>();
  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    void this.loadManifest();
  }

  getAsset(id: string): LoadedAsset {
    const existing = this.assets.get(id);
    if (existing) {
      return existing;
    }

    const definition = getDefinition(id);
    const placeholder = createPlaceholderCanvas(id, definition.size, definition.kind);
    const asset: LoadedAsset = {
      id,
      image: placeholder,
      size: definition.size,
      anchor: definition.anchor ?? ANCHOR_CENTER,
      placeholder: true,
      ready: false
    };
    this.assets.set(id, asset);

    const src = this.manifest[id];
    if (src) {
      this.enqueueLoad(id, src);
    }

    return asset;
  }

  private async loadManifest(): Promise<void> {
    const manifestPath = SETTINGS.ASSETS_MANIFEST;
    try {
      const response = await fetch(manifestPath, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const parsed = parseManifest(data);
      if (!parsed) {
        throw new Error("Invalid manifest JSON");
      }
      this.manifest = parsed;
    } catch (error) {
      console.warn(`[assets] Failed to load manifest at ${manifestPath}, using defaults.`, error);
      this.manifest = DEFAULT_MANIFEST;
    }

    for (const [id, src] of Object.entries(this.manifest)) {
      this.enqueueLoad(id, src);
    }
  }

  private enqueueLoad(id: string, src: string): void {
    if (this.loadingIds.has(id)) {
      return;
    }
    this.loadingIds.add(id);
    const asset = this.assets.get(id);
    if (asset && !asset.placeholder && asset.ready) {
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const record = this.assets.get(id);
      const target = record ?? this.getAsset(id);
      const width = image.naturalWidth || target.size.w;
      const height = image.naturalHeight || target.size.h;
      target.image = image;
      target.size = { w: width, h: height };
      target.ready = true;
      target.placeholder = false;
      this.assets.set(id, target);
    };
    image.onerror = () => {
      console.warn(`[assets] Failed to load asset ${id} from ${src}`);
    };
    image.src = src;
  }
}

function getDefinition(id: string): AssetDefinition {
  const fromDefaults = DEFAULT_DEFINITIONS[id];
  if (fromDefaults) {
    return fromDefaults;
  }

  if (id.startsWith("tile.")) {
    return { id, size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" };
  }
  if (id.startsWith("char.")) {
    return { id, size: CHARACTER_SIZE, anchor: ANCHOR_FEET, kind: "entity" };
  }
  if (id.startsWith("prop.")) {
    return { id, size: CHARACTER_SIZE, anchor: ANCHOR_FEET, kind: "prop" };
  }
  if (id.startsWith("crop.")) {
    return { id, size: CROP_SIZE, anchor: ANCHOR_FEET, kind: "crop" };
  }

  return { id, size: TILE_SIZE, anchor: ANCHOR_CENTER, kind: "tile" };
}

function parseManifest(data: unknown): AssetManifest | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const manifest: AssetManifest = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof key === "string" && typeof value === "string") {
      manifest[key] = value;
    }
  }
  return Object.keys(manifest).length > 0 ? manifest : null;
}

let sharedLoader: AssetLoader | null = null;

export function getAssetLoader(): AssetLoader {
  if (!sharedLoader) {
    sharedLoader = new AssetLoader();
    sharedLoader.start();
  }
  return sharedLoader;
}
