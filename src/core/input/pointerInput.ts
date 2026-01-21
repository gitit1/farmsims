import type { Vec2 } from "../../render/isoMath";
import type { Command, PointerType } from "./commands";

export type ScreenToWorld = (screen: Vec2) => Vec2;

export class PointerInput {
  private pendingPointerDown: { x: number; y: number; pointerType: PointerType } | null = null;
  private pendingPointerUp: { pointerType: PointerType } | null = null;
  private pendingMove: { x: number; y: number } | null = null;
  private pendingHover: { x: number; y: number; pointerType: PointerType } | null = null;
  private pendingTap: { x: number; y: number; pointerType: PointerType } | null = null;
  private pendingDrag: { dx: number; dy: number; pointerType: PointerType } | null = null;
  private pendingZoom: { factor: number; pointerType: PointerType } | null = null;

  private activePointers = new Map<number, { x: number; y: number; pointerType: PointerType }>();
  private dragPointerId: number | null = null;
  private dragStart: { x: number; y: number } | null = null;
  private lastDragPos: { x: number; y: number } | null = null;
  private dragging = false;
  private pinchDistance: number | null = null;
  private readonly dragThreshold = 8;

  private canvas: HTMLCanvasElement;
  private screenToWorld: ScreenToWorld;

  constructor(canvas: HTMLCanvasElement, screenToWorld: ScreenToWorld) {
    this.canvas = canvas;
    this.screenToWorld = screenToWorld;

    this.canvas.addEventListener("pointerdown", this.onPointerDown, { passive: false });
    this.canvas.addEventListener("pointermove", this.onPointerMove, { passive: false });
    this.canvas.addEventListener("pointerup", this.onPointerUp, { passive: false });
    this.canvas.addEventListener("pointercancel", this.onPointerUp, { passive: false });
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
  }

  consumePointerDown(): Command | null {
    if (!this.pendingPointerDown) {
      return null;
    }
    const data = this.pendingPointerDown;
    this.pendingPointerDown = null;
    return {
      type: "POINTER_DOWN",
      source: "pointer",
      data
    };
  }

  consumePointerUp(): Command | null {
    if (!this.pendingPointerUp) {
      return null;
    }
    const data = this.pendingPointerUp;
    this.pendingPointerUp = null;
    return {
      type: "POINTER_UP",
      source: "pointer",
      data
    };
  }

  consumeHoverCommand(): Command | null {
    if (!this.pendingHover) {
      return null;
    }
    const data = this.pendingHover;
    this.pendingHover = null;
    return {
      type: "HOVER_TILE",
      source: "pointer",
      data
    };
  }

  consumeMoveCommand(): Command | null {
    if (!this.pendingMove) {
      return null;
    }
    const data = this.pendingMove;
    this.pendingMove = null;
    return {
      type: "MOVE_TO_TILE",
      source: "pointer",
      data
    };
  }

  consumeTapCommand(): Command | null {
    if (!this.pendingTap) {
      return null;
    }
    const data = this.pendingTap;
    this.pendingTap = null;
    return {
      type: "TAP_TILE",
      source: "pointer",
      data
    };
  }

  consumeDragCommand(): Command | null {
    if (!this.pendingDrag) {
      return null;
    }
    const data = this.pendingDrag;
    this.pendingDrag = null;
    return {
      type: "DRAG",
      source: "pointer",
      data
    };
  }

  consumeZoomCommand(): Command | null {
    if (!this.pendingZoom) {
      return null;
    }
    const data = this.pendingZoom;
    this.pendingZoom = null;
    return {
      type: "ZOOM",
      source: "pointer",
      data
    };
  }

  private onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const screen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    const pointerType = this.getPointerType(event);

    this.activePointers.set(event.pointerId, { x: screen.x, y: screen.y, pointerType });
    this.pendingPointerDown = { x: screen.x, y: screen.y, pointerType };

    if (this.activePointers.size === 1) {
      this.dragPointerId = event.pointerId;
      this.dragStart = { ...screen };
      this.lastDragPos = { ...screen };
      this.dragging = false;
    } else if (this.activePointers.size === 2) {
      this.pinchDistance = getPinchDistance(this.activePointers);
      this.dragging = false;
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const screen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    const pointerType = this.getPointerType(event);

    if (pointerType === "mouse" && !this.dragging) {
      const world = this.screenToWorld(screen);
      this.pendingHover = {
        x: Math.floor(world.x),
        y: Math.floor(world.y),
        pointerType: "mouse"
      };
    }

    const entry = this.activePointers.get(event.pointerId);
    if (!entry) {
      return;
    }

    entry.x = screen.x;
    entry.y = screen.y;

    if (this.activePointers.size >= 2) {
      const distance = getPinchDistance(this.activePointers);
      if (this.pinchDistance && distance > 0) {
        const factor = distance / this.pinchDistance;
        if (Math.abs(factor - 1) > 0.002) {
          this.queueZoom(factor, pointerType);
        }
      }
      this.pinchDistance = distance;
      return;
    }

    if (this.dragPointerId === event.pointerId && this.lastDragPos && this.dragStart) {
      const dx = screen.x - this.lastDragPos.x;
      const dy = screen.y - this.lastDragPos.y;
      const totalDx = screen.x - this.dragStart.x;
      const totalDy = screen.y - this.dragStart.y;
      const distance = Math.hypot(totalDx, totalDy);

      if (distance >= this.dragThreshold) {
        this.dragging = true;
      }

      if (this.dragging && (dx !== 0 || dy !== 0)) {
        this.queueDrag(dx, dy, pointerType);
      }

      this.lastDragPos = { ...screen };
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const screen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    const pointerType = this.getPointerType(event);

    if (this.dragPointerId === event.pointerId) {
      if (!this.dragging) {
        const world = this.screenToWorld(screen);
        const tile = {
          x: Math.floor(world.x),
          y: Math.floor(world.y)
        };
        if (pointerType === "mouse") {
          this.pendingMove = tile;
          this.pendingHover = { ...tile, pointerType };
        } else {
          this.pendingTap = { ...tile, pointerType };
        }
      }
      this.dragPointerId = null;
      this.dragging = false;
      this.dragStart = null;
      this.lastDragPos = null;
    }

    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) {
      this.pinchDistance = null;
    }

    this.pendingPointerUp = { pointerType };
  };

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const factor = Math.pow(1.0015, -event.deltaY);
    if (factor !== 1) {
      this.queueZoom(factor, "mouse");
    }
  };

  private onContextMenu = (event: Event) => {
    event.preventDefault();
  };

  private queueDrag(dx: number, dy: number, pointerType: PointerType): void {
    if (this.pendingDrag) {
      this.pendingDrag.dx += dx;
      this.pendingDrag.dy += dy;
      return;
    }
    this.pendingDrag = { dx, dy, pointerType };
  }

  private queueZoom(factor: number, pointerType: PointerType): void {
    if (this.pendingZoom) {
      this.pendingZoom.factor *= factor;
      return;
    }
    this.pendingZoom = { factor, pointerType };
  }

  private getPointerType(event: PointerEvent): PointerType {
    if (event.pointerType === "touch") {
      return "touch";
    }
    if (event.pointerType === "pen") {
      return "pen";
    }
    return "mouse";
  }
}

function getPinchDistance(pointers: Map<number, { x: number; y: number }>): number {
  const entries = Array.from(pointers.values());
  if (entries.length < 2) {
    return 0;
  }
  const a = entries[0];
  const b = entries[1];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
