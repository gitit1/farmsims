export interface LoopClient {
  update(dt: number): void;
  render(): void;
}

export class GameLoop {
  private lastTime = 0;
  private rafId: number | null = null;

  constructor(private client: LoopClient) {}

  start(): void {
    if (this.rafId !== null) {
      return;
    }
    this.lastTime = performance.now();
    const tick = (time: number) => {
      const delta = Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
      this.lastTime = time;
      this.client.update(delta);
      this.client.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
