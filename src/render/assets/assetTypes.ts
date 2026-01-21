export type AssetId = string;

export interface AssetManifest {
  [id: string]: string;
}

export interface AssetSize {
  w: number;
  h: number;
}

export interface AssetAnchor {
  x: number;
  y: number;
}

export type PlaceholderKind = "tile" | "entity" | "prop" | "crop";

export interface AssetDefinition {
  id: AssetId;
  size: AssetSize;
  anchor?: AssetAnchor;
  kind: PlaceholderKind;
}

export interface LoadedAsset {
  id: AssetId;
  image: CanvasImageSource;
  size: AssetSize;
  anchor: AssetAnchor;
  placeholder: boolean;
  ready: boolean;
}
