import type { Vec2 } from "../render/isoMath";

export class Camera {
  position: Vec2;
  private smoothing: number;
  private offset: Vec2 = { x: 0, y: 0 };

  constructor(start: Vec2, smoothing: number) {
    this.position = { x: start.x, y: start.y };
    this.smoothing = smoothing;
  }

  update(target: Vec2, dt: number): void {
    const desired = {
      x: target.x + this.offset.x,
      y: target.y + this.offset.y
    };
    const t = 1 - Math.exp(-this.smoothing * dt);
    this.position.x += (desired.x - this.position.x) * t;
    this.position.y += (desired.y - this.position.y) * t;
  }

  panByWorld(delta: Vec2): void {
    this.offset.x += delta.x;
    this.offset.y += delta.y;
    this.position.x += delta.x;
    this.position.y += delta.y;
  }
}
