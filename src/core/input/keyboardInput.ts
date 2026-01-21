import type { Vec2 } from "../../render/isoMath";
import type { Command } from "./commands";

export class KeyboardInput {
  private pressed = new Set<string>();
  private pending: Command[] = [];
  private actionHotkeys: Record<string, string>;

  constructor(target: Window, actionHotkeys: Record<string, string>) {
    this.actionHotkeys = { ...actionHotkeys };
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
  }

  getMoveVector(): Vec2 {
    let x = 0;
    let y = 0;

    if (this.pressed.has("KeyW") || this.pressed.has("ArrowUp")) {
      y -= 1;
    }
    if (this.pressed.has("KeyS") || this.pressed.has("ArrowDown")) {
      y += 1;
    }
    if (this.pressed.has("KeyA") || this.pressed.has("ArrowLeft")) {
      x -= 1;
    }
    if (this.pressed.has("KeyD") || this.pressed.has("ArrowRight")) {
      x += 1;
    }

    return { x, y };
  }

  consumeCommands(): Command[] {
    const commands = this.pending;
    this.pending = [];
    return commands;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) {
      return;
    }

    const actionId = this.actionHotkeys[event.code];
    if (actionId) {
      event.preventDefault();
      this.pending.push({ type: "ACTION_TRIGGER", source: "keyboard", data: { id: actionId } });
      return;
    }

    if (event.code === "KeyE") {
      event.preventDefault();
      this.pending.push({ type: "FARM_INTERACT", source: "keyboard" });
      return;
    }

    if (event.code === "Tab") {
      event.preventDefault();
      this.pending.push({ type: "UI_TAB", source: "keyboard" });
      return;
    }

    if (event.code === "Enter" || event.code === "NumpadEnter") {
      event.preventDefault();
      this.pending.push({ type: "UI_CONFIRM", source: "keyboard" });
      return;
    }

    if (event.code === "ArrowUp") {
      event.preventDefault();
      this.pending.push({ type: "UI_NAV", source: "keyboard", data: { dx: 0, dy: -1 } });
    } else if (event.code === "ArrowDown") {
      event.preventDefault();
      this.pending.push({ type: "UI_NAV", source: "keyboard", data: { dx: 0, dy: 1 } });
    } else if (event.code === "ArrowLeft") {
      event.preventDefault();
      this.pending.push({ type: "UI_NAV", source: "keyboard", data: { dx: -1, dy: 0 } });
    } else if (event.code === "ArrowRight") {
      event.preventDefault();
      this.pending.push({ type: "UI_NAV", source: "keyboard", data: { dx: 1, dy: 0 } });
    }

    if (isMovementKey(event.code) || event.code === "Space" || event.code === "Escape") {
      event.preventDefault();
    }

    this.pressed.add(event.code);

    if (event.code === "Space") {
      this.pending.push({ type: "INTERACT", source: "keyboard" });
    }
    if (event.code === "Escape") {
      this.pending.push({ type: "OPEN_MENU", source: "keyboard" });
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (isMovementKey(event.code) || event.code === "Space" || event.code === "Escape") {
      event.preventDefault();
    }
    this.pressed.delete(event.code);
  };
}

function isMovementKey(code: string): boolean {
  return (
    code === "KeyW" ||
    code === "KeyA" ||
    code === "KeyS" ||
    code === "KeyD" ||
    code === "ArrowUp" ||
    code === "ArrowLeft" ||
    code === "ArrowDown" ||
    code === "ArrowRight"
  );
}
