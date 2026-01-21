import type { Command } from "./commands";
import { KeyboardInput } from "./keyboardInput";
import { PointerInput, type ScreenToWorld } from "./pointerInput";

export class InputController {
  private keyboard: KeyboardInput;
  private pointer: PointerInput;

  constructor(canvas: HTMLCanvasElement, screenToWorld: ScreenToWorld, actionHotkeys: Record<string, string>) {
    this.keyboard = new KeyboardInput(window, actionHotkeys);
    this.pointer = new PointerInput(canvas, screenToWorld);
  }

  pollCommands(): Command[] {
    const commands: Command[] = [];
    const move = this.keyboard.getMoveVector();
    if (move.x !== 0 || move.y !== 0) {
      commands.push({
        type: "MOVE_VECTOR",
        source: "keyboard",
        data: move
      });
    }

    commands.push(...this.keyboard.consumeCommands());

    const pointerDown = this.pointer.consumePointerDown();
    if (pointerDown) {
      commands.push(pointerDown);
    }

    const pointerUp = this.pointer.consumePointerUp();
    if (pointerUp) {
      commands.push(pointerUp);
    }

    const hoverCommand = this.pointer.consumeHoverCommand();
    if (hoverCommand) {
      commands.push(hoverCommand);
    }

    const tapCommand = this.pointer.consumeTapCommand();
    if (tapCommand) {
      commands.push(tapCommand);
    }

    const pointerCommand = this.pointer.consumeMoveCommand();
    if (pointerCommand) {
      commands.push(pointerCommand);
    }

    const dragCommand = this.pointer.consumeDragCommand();
    if (dragCommand) {
      commands.push(dragCommand);
    }

    const zoomCommand = this.pointer.consumeZoomCommand();
    if (zoomCommand) {
      commands.push(zoomCommand);
    }

    return commands;
  }
}
