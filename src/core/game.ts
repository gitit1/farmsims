import { SETTINGS } from "./settings";
import { Camera } from "./camera";
import { InputController } from "./input/inputController";
import type { Command } from "./input/commands";
import { WorldMap } from "../world/map";
import { Player } from "../entities/player";
import { HUD, type ActionButtonState } from "../ui/hud";
import { Renderer } from "../render/renderer";
import { screenToWorld, worldToScreen, type Vec2 } from "../render/isoMath";
import { isShopkeeperTile, SHOPKEEPER_TILE, isFarmTile } from "../world/layout";
import { createSimState, type SimState } from "../sim/state";
import { SimClock, formatSimTime } from "../sim/clock";
import { applyNeedsDecay, getSpeedMultiplier } from "../sim/needs";
import { buildActionIndex, getActionById, type Action } from "../sim/actions";
import { addItem, getItemCount, removeItem } from "../sim/inventory";
import { getMaxShopQuantity } from "../sim/shop";
import type { ShopItem } from "../sim/shop";
import {
  createCropCatalog,
  getCropDefinition,
  getPlot,
  isHarvestable,
  plantCrop,
  resetPlotToTilled,
  setPlotTilled,
  setPlotWatered,
  tickFarmGrowth,
  type FarmState,
  type CropType,
  type PlotState
} from "../sim/farm";
import { ShopUi, type ShopUiAction, type ShopUiState } from "../ui/shopUi";
import type { ContentConfig } from "../content/loader";

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private map: WorldMap;
  private player: Player;
  private camera: Camera;
  private input: InputController;
  private hud: HUD;
  private shopUi: ShopUi;
  private actions: Action[];
  private actionIndex: Record<string, Action>;
  private actionButtonIds: string[];
  private shopItems: ShopItem[];
  private movementMode: "Keyboard" | "Pointer" | "Idle" = "Idle";
  private fps = 0;
  private hoverTile: { x: number; y: number } | null = null;
  private tapHighlightTile: { x: number; y: number } | null = null;
  private simState: SimState;
  private simClock: SimClock;
  private viewWidth = 0;
  private viewHeight = 0;
  private pointerBlockMovement = false;
  private zoom = SETTINGS.ZOOM_START;
  private pendingFarmAction: { tile: { x: number; y: number }; type: FarmActionType; cropType: CropType | null } | null =
    null;

  constructor(canvas: HTMLCanvasElement, content: ContentConfig) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.map = new WorldMap(SETTINGS.MAP_W, SETTINGS.MAP_H);
    this.player = new Player({
      x: this.map.width / 2,
      y: this.map.height / 2
    });
    this.camera = new Camera({ x: this.player.position.x, y: this.player.position.y }, SETTINGS.CAMERA_SMOOTHING);
    this.actions = content.actions;
    this.actionIndex = buildActionIndex(content.actions);
    this.actionButtonIds = content.actionButtons;
    this.shopItems = content.shopItems;
    const cropCatalog = createCropCatalog(content.crops);
    this.input = new InputController(canvas, (screen) => this.toWorld(screen), content.actionHotkeys);
    this.hud = new HUD();
    this.shopUi = new ShopUi();
    this.simState = createSimState(cropCatalog);
    this.simClock = new SimClock(this.simState.time);
    this.renderer.setZoom(this.zoom);

    this.resize();
    window.addEventListener("resize", this.resize);
  }

  update(dt: number): void {
    const simMinutes = this.simClock.update(dt);
    applyNeedsDecay(this.simState.needs, SETTINGS.NEEDS_DECAY_PER_MIN, simMinutes);
    tickFarmGrowth(this.simState.farm, simMinutes);
    const commands = this.input.pollCommands();

    if (this.simState.shop.isOpen) {
      this.handleShopCommands(commands);
      this.simState.actionQueue.tick(simMinutes, this.simState.needs);
      this.processFarmActionCompletion();
      this.player.setSpeedMultiplier(getSpeedMultiplier(this.simState.needs));
      this.player.setMoveVector({ x: 0, y: 0 });
      this.player.setTargetTile(null);
      this.player.update(dt, this.map);
      this.camera.update(this.player.position, dt);
      this.movementMode = "Idle";
      this.updateFps(dt);
      return;
    }

    let moveVector: Vec2 | null = null;
    let moveToTile: { x: number; y: number } | null = null;
    let moveToTileSource: "mouse" | "touch" | "pen" | null = null;
    let keyboardActive = false;
    let tapTile: { x: number; y: number; pointerType: "mouse" | "touch" | "pen" } | null = null;
    let pointerDown: { x: number; y: number; pointerType: "mouse" | "touch" | "pen" } | null = null;
    let pointerUp: { pointerType: "mouse" | "touch" | "pen" } | null = null;
    let actionRequestedId: string | null = null;
    let ignorePointerMovement = false;
    let dragDelta: Vec2 | null = null;
    let zoomFactor = 1;
    let farmInteract = false;
    let shopOpened = false;

    for (const command of commands) {
      if (command.type === "MOVE_VECTOR") {
        moveVector = command.data;
        keyboardActive = moveVector.x !== 0 || moveVector.y !== 0;
      } else if (command.type === "MOVE_TO_TILE") {
        moveToTile = command.data;
        moveToTileSource = "mouse";
      } else if (command.type === "HOVER_TILE") {
        if (command.data.pointerType === "mouse") {
          if (this.map.get(command.data.x, command.data.y)) {
            this.hoverTile = { x: command.data.x, y: command.data.y };
          }
        }
      } else if (command.type === "TAP_TILE") {
        tapTile = command.data;
      } else if (command.type === "POINTER_DOWN") {
        pointerDown = command.data;
      } else if (command.type === "POINTER_UP") {
        pointerUp = command.data;
      } else if (command.type === "ACTION_TRIGGER") {
        actionRequestedId = command.data.id;
      } else if (command.type === "DRAG") {
        if (!dragDelta) {
          dragDelta = { x: command.data.dx, y: command.data.dy };
        } else {
          dragDelta.x += command.data.dx;
          dragDelta.y += command.data.dy;
        }
      } else if (command.type === "ZOOM") {
        zoomFactor *= command.data.factor;
      } else if (command.type === "FARM_INTERACT") {
        farmInteract = true;
      }
    }

    const actionButtons = this.getActionButtons();

    if (pointerDown) {
      this.pointerBlockMovement = false;
      const hitAction = this.hud.hitTestAction(
        pointerDown.x,
        pointerDown.y,
        this.viewWidth,
        this.viewHeight,
        actionButtons
      );
      if (hitAction) {
        actionRequestedId = hitAction;
        ignorePointerMovement = true;
        this.pointerBlockMovement = true;
      }
    }

    if (pointerUp) {
      this.pointerBlockMovement = false;
    }

    if (zoomFactor !== 1) {
      this.zoom = clamp(this.zoom * zoomFactor, SETTINGS.ZOOM_MIN, SETTINGS.ZOOM_MAX);
      this.renderer.setZoom(this.zoom);
    }

    if (dragDelta && !this.pointerBlockMovement) {
      const worldDelta = this.screenDeltaToWorld(dragDelta);
      this.camera.panByWorld(worldDelta);
    }

    if (actionRequestedId) {
      const action = getActionById(this.actionIndex, actionRequestedId);
      if (action && this.simState.actionQueue.startAction(action)) {
        this.player.setMoveVector({ x: 0, y: 0 });
        this.player.setTargetTile(null);
      }
    }

    this.processFarmActionCompletion();

    if (!this.simState.actionQueue.isActive()) {
      if (farmInteract) {
        if (this.isPlayerNearShopkeeper()) {
          this.openShop();
          shopOpened = true;
        } else {
          const tile = this.player.getTilePosition();
          this.tryStartFarmAction(tile);
        }
      }
    }

    this.simState.actionQueue.tick(simMinutes, this.simState.needs);
    this.player.setSpeedMultiplier(getSpeedMultiplier(this.simState.needs));

    if (ignorePointerMovement || this.pointerBlockMovement) {
      tapTile = null;
      moveToTile = null;
      moveToTileSource = null;
    }

    if (this.simState.actionQueue.isActive()) {
      moveVector = null;
      moveToTile = null;
      tapTile = null;
      keyboardActive = false;
      moveToTileSource = null;
      this.player.setMoveVector({ x: 0, y: 0 });
      this.player.setTargetTile(null);
    }

    if (shopOpened) {
      this.player.setMoveVector({ x: 0, y: 0 });
      this.player.setTargetTile(null);
      this.player.update(dt, this.map);
      this.camera.update(this.player.position, dt);
      this.movementMode = "Idle";
      this.updateFps(dt);
      return;
    }

    if (tapTile && (tapTile.pointerType === "touch" || tapTile.pointerType === "pen")) {
      const tap = { x: tapTile.x, y: tapTile.y };
      if (this.map.get(tap.x, tap.y) && !this.map.isBlocked(tap.x, tap.y)) {
        if (isShopkeeperTile(tap.x, tap.y)) {
          const distance = distanceToTile(this.player.position, tap);
          const wasSameTap = this.tapHighlightTile && tilesMatch(this.tapHighlightTile, tap);
          if (distance > 1.2) {
            this.tapHighlightTile = tap;
            moveToTile = tap;
            moveToTileSource = tapTile.pointerType;
          } else if (wasSameTap) {
            this.openShop();
            shopOpened = true;
          } else {
            this.tapHighlightTile = tap;
          }
        } else if (!this.simState.actionQueue.isActive() && isFarmTile(tap.x, tap.y)) {
          if (this.tryStartFarmAction(tap)) {
            this.tapHighlightTile = tap;
            moveToTile = null;
            moveToTileSource = null;
          }
        } else {
          const distance = distanceToTile(this.player.position, tap);
          const isMovementTap = !isShopkeeperTile(tap.x, tap.y) || distance > 1.2;
          if (isMovementTap) {
            this.tapHighlightTile = tap;
            moveToTile = tap;
            moveToTileSource = tapTile.pointerType;
          } else {
            this.tapHighlightTile = tap;
          }
        }
      }
    }

    if (moveToTile && moveToTileSource === "mouse" && isShopkeeperTile(moveToTile.x, moveToTile.y)) {
      this.openShop();
      shopOpened = true;
      moveToTile = null;
      moveToTileSource = null;
    }

    if (shopOpened) {
      this.player.setMoveVector({ x: 0, y: 0 });
      this.player.setTargetTile(null);
      this.player.update(dt, this.map);
      this.camera.update(this.player.position, dt);
      this.movementMode = "Idle";
      this.updateFps(dt);
      return;
    }

    if (keyboardActive && moveVector) {
      this.player.setMoveVector(moveVector);
      this.player.setTargetTile(null);
    } else {
      this.player.setMoveVector({ x: 0, y: 0 });
      if (moveToTile && this.map.get(moveToTile.x, moveToTile.y) && !this.map.isBlocked(moveToTile.x, moveToTile.y)) {
        if (!this.simState.actionQueue.isActive() && isFarmTile(moveToTile.x, moveToTile.y)) {
          if (this.tryStartFarmAction(moveToTile)) {
            moveToTile = null;
            moveToTileSource = null;
          }
        } else {
          this.player.setTargetTile(moveToTile);
        }
      }
    }

    this.player.update(dt, this.map);
    this.camera.update(this.player.position, dt);

    if (this.simState.actionQueue.isActive()) {
      this.movementMode = "Idle";
    } else if (keyboardActive) {
      this.movementMode = "Keyboard";
    } else if (this.player.getTargetTile()) {
      this.movementMode = "Pointer";
    } else {
      this.movementMode = "Idle";
    }

    this.updateFps(dt);
  }

  render(): void {
    const shopOpen = this.simState.shop.isOpen;
    const highlightTile = shopOpen ? null : this.hoverTile ?? this.tapHighlightTile;
    const hint = !shopOpen && this.isPlayerNearShopkeeper() ? "Interact" : null;
    const activeAction = this.simState.actionQueue.getActive();
    const actionStatus = activeAction
      ? { label: activeAction.action.label, remainingMinutes: activeAction.remainingMinutes }
      : null;
    const actionButtons = this.getActionButtons();
    const shopOverlay = shopOpen ? { ui: this.shopUi, state: this.buildShopUiState() } : undefined;
    this.renderer.render(
      {
        map: this.map,
        player: this.player,
        camera: this.camera,
        targetTile: this.player.getTargetTile(),
        highlightTile,
        farm: this.simState.farm,
        hud: {
          fps: this.fps,
          playerTile: this.player.getTilePosition(),
          mode: this.movementMode,
          hint,
          time: formatSimTime(this.simState.time),
          money: this.simState.money,
          needs: this.simState.needs,
          actionButtons,
          activeAction: actionStatus
        }
      },
      this.hud,
      shopOverlay
    );
  }

  private buildShopUiState(): ShopUiState {
    return {
      time: formatSimTime(this.simState.time),
      money: this.simState.money,
      mode: this.simState.shop.mode,
      items: this.shopItems,
      pageIndex: this.simState.shop.pageIndex,
      selectedIndex: this.simState.shop.selectedIndex,
      quantity: this.simState.shop.quantity,
      inventory: this.simState.inventory
    };
  }

  private getActionButtons(): ActionButtonState[] {
    const enabled = !this.simState.actionQueue.isActive();
    const buttons = this.actionButtonIds
      .map((id) => this.actionIndex[id])
      .filter((action): action is Action => !!action)
      .map((action) => ({
        id: action.id,
        label: action.label,
        enabled
      }));
    if (buttons.length > 0) {
      return buttons;
    }
    return this.actions.slice(0, 3).map((action) => ({
      id: action.id,
      label: action.label,
      enabled
    }));
  }

  private handleShopCommands(commands: Command[]): void {
    this.syncShopPageToSelection();
    for (const command of commands) {
      if (command.type === "UI_NAV") {
        const nextIndex = this.shopUi.moveSelection(
          this.simState.shop.selectedIndex,
          command.data.dx,
          command.data.dy,
          this.viewWidth,
          this.shopItems.length,
          this.simState.shop.pageIndex
        );
        if (
          nextIndex.index !== this.simState.shop.selectedIndex ||
          nextIndex.pageIndex !== this.simState.shop.pageIndex
        ) {
          this.simState.shop.selectedIndex = nextIndex.index;
          this.simState.shop.pageIndex = nextIndex.pageIndex;
          this.clampShopQuantity();
        }
      } else if (command.type === "UI_TAB") {
        this.simState.shop.mode = this.simState.shop.mode === "buy" ? "sell" : "buy";
        this.clampShopQuantity();
      } else if (command.type === "UI_CONFIRM") {
        this.confirmShopSelection();
      } else if (command.type === "OPEN_MENU") {
        this.closeShop();
      } else if (command.type === "POINTER_DOWN") {
        const action = this.shopUi.handlePointer(
          command.data.x,
          command.data.y,
          this.viewWidth,
          this.viewHeight,
          this.buildShopUiState()
        );
        if (action) {
          this.handleShopUiAction(action);
        }
      }
    }
  }

  private handleShopUiAction(action: ShopUiAction): void {
    if (action.type === "close") {
      this.closeShop();
      return;
    }
    if (action.type === "select") {
      this.simState.shop.selectedIndex = action.index;
      this.syncShopPageToSelection();
      this.clampShopQuantity();
      return;
    }
    if (action.type === "tab") {
      this.simState.shop.mode = action.mode;
      this.clampShopQuantity();
      return;
    }
    if (action.type === "page") {
      this.shiftShopPage(action.delta);
      return;
    }
    if (action.type === "quantity") {
      const item = this.getSelectedShopItem();
      const owned = item ? getItemCount(this.simState.inventory, item.id) : 0;
      const max = getMaxShopQuantity(this.simState.shop.mode, item, this.simState.money, owned);
      this.simState.shop.quantity = clamp(this.simState.shop.quantity + action.delta, 1, max);
      return;
    }
    if (action.type === "confirm") {
      this.confirmShopSelection();
    }
  }

  private confirmShopSelection(): void {
    const item = this.getSelectedShopItem();
    if (!item) {
      return;
    }
    const quantity = this.simState.shop.quantity;
    if (this.simState.shop.mode === "buy") {
      const total = item.priceBuy * quantity;
      if (item.priceBuy >= 0 && this.simState.money >= total) {
        this.simState.money -= total;
        addItem(this.simState.inventory, item.id, quantity);
      }
    } else {
      const owned = getItemCount(this.simState.inventory, item.id);
      if (item.priceSell >= 0 && owned >= quantity) {
        if (removeItem(this.simState.inventory, item.id, quantity)) {
          this.simState.money += item.priceSell * quantity;
        }
      }
    }
    this.clampShopQuantity();
  }

  private getSelectedShopItem(): ShopItem | null {
    return this.shopItems[this.simState.shop.selectedIndex] ?? null;
  }

  private clampShopQuantity(): void {
    const item = this.getSelectedShopItem();
    const owned = item ? getItemCount(this.simState.inventory, item.id) : 0;
    const max = getMaxShopQuantity(this.simState.shop.mode, item, this.simState.money, owned);
    this.simState.shop.quantity = clamp(this.simState.shop.quantity, 1, max);
  }

  private openShop(): void {
    this.simState.shop.isOpen = true;
    this.simState.shop.selectedIndex = clamp(
      this.simState.shop.selectedIndex,
      0,
      Math.max(0, this.shopItems.length - 1)
    );
    this.syncShopPageToSelection();
    this.simState.shop.quantity = 1;
    this.player.setMoveVector({ x: 0, y: 0 });
    this.player.setTargetTile(null);
  }

  private closeShop(): void {
    this.simState.shop.isOpen = false;
    this.simState.shop.quantity = 1;
  }

  private getShopCapacity(): number {
    return this.shopUi.getGridCapacity(this.viewWidth);
  }

  private getShopPageCount(): number {
    const capacity = this.getShopCapacity();
    if (capacity <= 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(this.shopItems.length / capacity));
  }

  private syncShopPageToSelection(): void {
    const capacity = this.getShopCapacity();
    const pageCount = this.getShopPageCount();
    const maxIndex = Math.max(0, this.shopItems.length - 1);
    this.simState.shop.selectedIndex = clamp(this.simState.shop.selectedIndex, 0, maxIndex);
    if (capacity <= 0) {
      this.simState.shop.pageIndex = 0;
      return;
    }
    const selectedPage = Math.floor(this.simState.shop.selectedIndex / capacity);
    this.simState.shop.pageIndex = clamp(selectedPage, 0, pageCount - 1);
  }

  private shiftShopPage(delta: number): void {
    const capacity = this.getShopCapacity();
    const pageCount = this.getShopPageCount();
    if (pageCount <= 1 || capacity <= 0) {
      return;
    }
    const nextPage = clamp(this.simState.shop.pageIndex + delta, 0, pageCount - 1);
    if (nextPage === this.simState.shop.pageIndex) {
      return;
    }
    this.simState.shop.pageIndex = nextPage;
    const start = nextPage * capacity;
    const end = Math.min(start + capacity - 1, Math.max(0, this.shopItems.length - 1));
    if (this.simState.shop.selectedIndex < start || this.simState.shop.selectedIndex > end) {
      this.simState.shop.selectedIndex = start;
    }
    this.clampShopQuantity();
  }

  private updateFps(dt: number): void {
    const instantFps = dt > 0 ? 1 / dt : 0;
    this.fps = this.fps ? this.fps * 0.9 + instantFps * 0.1 : instantFps;
  }

  private resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, SETTINGS.MAX_DPR);
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.viewWidth = width;
    this.viewHeight = height;
    this.renderer.setSize(width, height, dpr);
    if (this.simState.shop.isOpen) {
      this.syncShopPageToSelection();
    }
  };

  private toWorld(screen: Vec2): Vec2 {
    const center = this.renderer.getScreenCenter();
    const cameraScreen = worldToScreen(this.camera.position);
    const zoom = this.renderer.getZoom();
    const adjusted = {
      x: (screen.x - center.x) / zoom + cameraScreen.x,
      y: (screen.y - center.y) / zoom + cameraScreen.y
    };
    return screenToWorld(adjusted);
  }

  private isPlayerNearShopkeeper(): boolean {
    const distance = distanceToTile(this.player.position, SHOPKEEPER_TILE);
    return distance <= 1.1;
  }

  private screenDeltaToWorld(delta: Vec2): Vec2 {
    const zoom = this.renderer.getZoom();
    return screenToWorld({ x: delta.x / zoom, y: delta.y / zoom });
  }

  private tryStartFarmAction(tile: { x: number; y: number }): boolean {
    if (!isFarmTile(tile.x, tile.y)) {
      return false;
    }
    const plot = getPlot(this.simState.farm, tile.x, tile.y);
    if (!plot) {
      return false;
    }
    const action = getFarmContextAction(this.simState.farm, plot);
    if (!action) {
      return false;
    }
    const started = this.simState.actionQueue.startAction(action);
    if (started) {
      this.player.setMoveVector({ x: 0, y: 0 });
      this.player.setTargetTile(null);
      this.pendingFarmAction = {
        tile: { x: tile.x, y: tile.y },
        type: action.type,
        cropType: action.cropType
      };
    }
    return started;
  }

  private processFarmActionCompletion(): void {
    const active = this.simState.actionQueue.getActive();
    if (active || !this.pendingFarmAction) {
      return;
    }
    const { tile, type, cropType } = this.pendingFarmAction;
    const plot = getPlot(this.simState.farm, tile.x, tile.y);
    if (!plot) {
      this.pendingFarmAction = null;
      return;
    }

    if (type === "till") {
      setPlotTilled(plot);
    } else if (type === "water") {
      setPlotWatered(plot);
    } else if (type === "plant") {
      if (cropType) {
        plantCrop(plot, cropType);
      }
    } else if (type === "harvest") {
      if (plot.cropType) {
        addItem(this.simState.inventory, plot.cropType, 1);
      } else if (cropType) {
        addItem(this.simState.inventory, cropType, 1);
      }
      resetPlotToTilled(plot);
    }

    this.pendingFarmAction = null;
  }
}

function distanceToTile(position: Vec2, tile: { x: number; y: number }): number {
  const dx = tile.x + 0.5 - position.x;
  const dy = tile.y + 0.5 - position.y;
  return Math.hypot(dx, dy);
}

function tilesMatch(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return a.x === b.x && a.y === b.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getDefaultPlantCrop(farm: FarmState): CropType | null {
  if (farm.crops.byId["carrot"]) {
    return "carrot";
  }
  return farm.crops.list[0]?.id ?? null;
}

type FarmActionType = "till" | "water" | "plant" | "harvest";
function getFarmContextAction(
  farm: FarmState,
  plot: PlotState | null
): (Action & { type: FarmActionType; cropType: CropType | null }) | null {
  if (!plot) {
    return null;
  }
  if (plot.cropType && isHarvestable(farm, plot)) {
    return {
      type: "harvest",
      cropType: plot.cropType,
      id: "farm_harvest",
      label: "Harvest",
      durationMinutes: 10,
      needsDelta: {
        energy: -1,
        fun: 1
      }
    };
  }
  if (plot.soilState === "empty") {
    return {
      type: "till",
      cropType: null,
      id: "farm_till",
      label: "Till",
      durationMinutes: 15,
      needsDelta: {
        energy: -2,
        hunger: -1
      }
    };
  }
  if (plot.soilState === "tilled") {
    return {
      type: "water",
      cropType: null,
      id: "farm_water",
      label: "Water",
      durationMinutes: 10,
      needsDelta: {
        energy: -1
      }
    };
  }
  if (plot.soilState === "watered" && !plot.cropType) {
    const cropType = getDefaultPlantCrop(farm);
    if (!cropType) {
      return null;
    }
    const cropDef = getCropDefinition(farm, cropType);
    return {
      type: "plant",
      cropType,
      id: `farm_plant_${cropType}`,
      label: cropDef ? `Plant ${cropDef.name}` : "Plant",
      durationMinutes: 15,
      needsDelta: {
        energy: -2
      }
    };
  }
  return null;
}
