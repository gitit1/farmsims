import { SETTINGS } from "../core/settings";
import { worldToScreen, type Vec2 } from "./isoMath";
import type { Camera } from "../core/camera";
import type { Player, TileCoord } from "../entities/player";
import type { WorldMap, Tile } from "../world/map";
import { HUD, type HudState } from "../ui/hud";
import type { ShopUi, ShopUiState } from "../ui/shopUi";
import { SHOPKEEPER_TILE, isFarmTile } from "../world/layout";
import type { FarmState, PlotState } from "../sim/farm";
import { getPlot, getGrowthStage } from "../sim/farm";
import { drawEllipseShadow, drawIsoTop } from "./draw";
import { PALETTE, withAlpha } from "./palette";
import { getAssetLoader } from "./assets/assetLoader";
import type { LoadedAsset } from "./assets/assetTypes";

interface RenderState {
  map: WorldMap;
  player: Player;
  camera: Camera;
  targetTile: TileCoord | null;
  highlightTile: TileCoord | null;
  farm: FarmState;
  hud: HudState;
}

type RenderableType = "player" | "shopkeeper" | "crop";

interface Renderable {
  type: RenderableType;
  x: number;
  y: number;
  sortY: number;
  assetId: string;
  plot?: PlotState;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private zoom = SETTINGS.ZOOM_START;
  private backgroundGradient: CanvasGradient | null = null;
  private vignetteGradient: CanvasGradient | null = null;
  private renderables: Renderable[] = [];
  private renderableCount = 0;
  private debugEnabled = false;
  private assets = getAssetLoader();

  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context not available.");
    }
    this.ctx = context;

    window.addEventListener("keydown", (event) => {
      if (event.code === "F2") {
        this.debugEnabled = !this.debugEnabled;
      }
    });
  }

  setSize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.rebuildGradients();
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
  }

  getZoom(): number {
    return this.zoom;
  }

  getScreenCenter(): Vec2 {
    return { x: this.width / 2, y: this.height / 2 };
  }

  render(state: RenderState, hud: HUD, shopOverlay?: { ui: ShopUi; state: ShopUiState }): void {
    const { map, player, camera, targetTile, highlightTile, farm } = state;
    const center = this.getScreenCenter();
    const cameraScreen = worldToScreen(camera.position);
    const zoom = this.zoom;
    const tileW = SETTINGS.TILE_W * zoom;
    const tileH = SETTINGS.TILE_H * zoom;
    const highlightInset = SETTINGS.RENDER.TILE_HIGHLIGHT_INSET;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = this.backgroundGradient ?? SETTINGS.BACKGROUND;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const toScreen = (world: Vec2): Vec2 => {
      const screen = worldToScreen(world);
      return {
        x: (screen.x - cameraScreen.x) * zoom + center.x,
        y: (screen.y - cameraScreen.y) * zoom + center.y
      };
    };

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = map.get(x, y);
        if (!tile) {
          continue;
        }
        const world = { x: x + 0.5, y: y + 0.5 };
        const screen = toScreen(world);
        const farmPlot = isFarmTile(x, y) ? getPlot(farm, x, y) : null;
        const tileId = resolveTileId(tile, farmPlot);
        this.drawSprite(tileId, screen, zoom);

        // Draw transition overlays after base tile.
        if (tile.type !== "farm" || (farmPlot && farmPlot.soilState !== "empty")) {
          for (const overlayId of tile.overlays) {
            this.drawSprite(overlayId, screen, zoom);
          }
        }

        if (tile.type === "farm" && farmPlot?.soilState === "watered") {
          this.drawSprite("tile.farm.watered_overlay", screen, zoom);
        }

        if (this.debugEnabled) {
          this.drawTileDebug(screen, x, y, tileId, tileW, tileH);
        }
      }
    }

    if (highlightTile) {
      const farmHighlight = isFarmTile(highlightTile.x, highlightTile.y);
      const highlightWorld = { x: highlightTile.x + 0.5, y: highlightTile.y + 0.5 };
      const highlightScreen = toScreen(highlightWorld);
      const fill = farmHighlight ? PALETTE.effects.tileHighlightFarm : PALETTE.effects.tileHighlight;
      const stroke = farmHighlight ? withAlpha(PALETTE.ui.accent, 0.7) : withAlpha("#ffffff", 0.5);
      drawIsoTop(
        this.ctx,
        highlightScreen.x,
        highlightScreen.y,
        tileW * highlightInset,
        tileH * highlightInset,
        fill,
        stroke,
        Math.max(1, zoom)
      );
    }

    if (targetTile) {
      const markerWorld = { x: targetTile.x + 0.5, y: targetTile.y + 0.5 };
      const markerScreen = toScreen(markerWorld);
      this.drawTargetMarker(markerScreen, tileW, tileH);
    }

    this.renderableCount = 0;
    this.addRenderable({
      type: "shopkeeper",
      x: SHOPKEEPER_TILE.x + 0.5,
      y: SHOPKEEPER_TILE.y + 0.5,
      sortY: SHOPKEEPER_TILE.y + 0.5,
      assetId: "prop.shopkeeper"
    });

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!isFarmTile(x, y)) {
          continue;
        }
        const plot = getPlot(farm, x, y);
        if (!plot || !plot.cropType) {
          continue;
        }
        this.addRenderable({
          type: "crop",
          x: x + 0.5,
          y: y + 0.5,
          sortY: y + 0.5,
          assetId: getCropAssetId(plot, farm),
          plot
        });
      }
    }

    this.addRenderable({
      type: "player",
      x: player.position.x,
      y: player.position.y,
      sortY: player.position.y,
      assetId: "char.player.idle"
    });

    this.renderables.length = this.renderableCount;
    this.renderables.sort((a, b) => (a.sortY === b.sortY ? a.x - b.x : a.sortY - b.sortY));

    for (const renderable of this.renderables) {
      const screen = toScreen({ x: renderable.x, y: renderable.y });
      if (renderable.type === "player") {
        this.drawEntity(renderable.assetId, screen, zoom, tileW, tileH);
      } else if (renderable.type === "shopkeeper") {
        this.drawEntity(renderable.assetId, screen, zoom, tileW, tileH);
      } else if (renderable.type === "crop") {
        this.drawCrop(renderable, screen, zoom, tileW, tileH);
      }

      if (this.debugEnabled) {
        this.drawEntityDebug(screen, renderable.assetId);
      }
    }

    if (this.vignetteGradient) {
      this.ctx.fillStyle = this.vignetteGradient;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    if (!shopOverlay) {
      hud.render(this.ctx, state.hud, this.width, this.height);
    } else {
      shopOverlay.ui.render(this.ctx, shopOverlay.state, this.width, this.height);
    }
  }

  private rebuildGradients(): void {
    if (this.width <= 0 || this.height <= 0) {
      this.backgroundGradient = null;
      this.vignetteGradient = null;
      return;
    }

    const background = this.ctx.createLinearGradient(0, 0, 0, this.height);
    background.addColorStop(0, PALETTE.background.top);
    background.addColorStop(1, PALETTE.background.bottom);
    this.backgroundGradient = background;

    const radius = Math.max(this.width, this.height) * 0.75;
    const vignette = this.ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      radius * 0.2,
      this.width / 2,
      this.height / 2,
      radius
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, withAlpha("#000000", SETTINGS.RENDER.VIGNETTE_ALPHA));
    this.vignetteGradient = vignette;
  }

  private drawSprite(assetId: string, screen: Vec2, zoom: number): LoadedAsset {
    const asset = this.assets.getAsset(assetId);
    const drawW = asset.size.w * zoom;
    const drawH = asset.size.h * zoom;
    const drawX = screen.x - asset.anchor.x * drawW;
    const drawY = screen.y - asset.anchor.y * drawH;
    this.ctx.drawImage(asset.image, drawX, drawY, drawW, drawH);
    return asset;
  }

  private drawEntity(assetId: string, screen: Vec2, zoom: number, tileW: number, tileH: number): void {
    drawEllipseShadow(
      this.ctx,
      screen.x,
      screen.y + tileH * 0.12,
      tileW * 0.2,
      tileH * 0.1,
      PALETTE.effects.shadow
    );
    this.drawSprite(assetId, screen, zoom);
  }

  private drawCrop(renderable: Renderable, screen: Vec2, zoom: number, tileW: number, tileH: number): void {
    drawEllipseShadow(
      this.ctx,
      screen.x,
      screen.y + tileH * 0.1,
      tileW * 0.16,
      tileH * 0.08,
      PALETTE.effects.shadow
    );
    this.drawSprite(renderable.assetId, screen, zoom);
  }

  private drawTargetMarker(screen: Vec2, tileW: number, tileH: number): void {
    drawIsoTop(
      this.ctx,
      screen.x,
      screen.y,
      tileW * 0.5,
      tileH * 0.5,
      withAlpha(PALETTE.effects.marker, 0.22),
      PALETTE.effects.markerStroke,
      2
    );
  }

  private drawTileDebug(screen: Vec2, x: number, y: number, id: string, tileW: number, tileH: number): void {
    this.ctx.save();
    this.ctx.fillStyle = withAlpha("#101010", 0.7);
    this.ctx.font = `${Math.max(10, Math.round(tileH * 0.25))}px ${PALETTE.uiFont}`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(`${x},${y}`, screen.x, screen.y - tileH * 0.2);
    this.ctx.fillText(id, screen.x, screen.y + tileH * 0.15);
    this.ctx.restore();
  }

  private drawEntityDebug(screen: Vec2, id: string): void {
    this.ctx.save();
    this.ctx.fillStyle = withAlpha("#101010", 0.75);
    this.ctx.font = `12px ${PALETTE.uiFont}`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "bottom";
    this.ctx.fillText(id, screen.x, screen.y - 6);
    this.ctx.restore();
  }

  private addRenderable(item: Renderable): void {
    if (this.renderableCount < this.renderables.length) {
      const target = this.renderables[this.renderableCount];
      target.type = item.type;
      target.x = item.x;
      target.y = item.y;
      target.sortY = item.sortY;
      target.assetId = item.assetId;
      target.plot = item.plot;
    } else {
      this.renderables.push({ ...item });
    }
    this.renderableCount += 1;
  }
}

function resolveTileId(tile: Tile, plot: PlotState | null): string {
  if (tile.type === "farm") {
    if (plot?.soilState === "tilled" || plot?.soilState === "watered") {
      return "tile.farm.tilled";
    }
    return tile.tileId;
  }
  return tile.tileId;
}

function getCropAssetId(plot: PlotState, farm: FarmState): string {
  const stage = getGrowthStage(farm, plot);
  const stageId = clamp(stage + 1, 1, 3);
  const type = plot.cropType ?? "carrot";
  return `crop.${type}.stage${stageId}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
