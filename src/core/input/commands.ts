export type CommandSource = "keyboard" | "pointer";

export type PointerType = "mouse" | "touch" | "pen";

export type CommandType =
  | "MOVE_VECTOR"
  | "MOVE_TO_TILE"
  | "HOVER_TILE"
  | "TAP_TILE"
  | "FARM_INTERACT"
  | "ACTION_TRIGGER"
  | "UI_NAV"
  | "UI_CONFIRM"
  | "UI_TAB"
  | "DRAG"
  | "ZOOM"
  | "POINTER_DOWN"
  | "POINTER_UP"
  | "INTERACT"
  | "OPEN_MENU";

export interface CommandBase {
  type: CommandType;
  source: CommandSource;
}

export interface MoveVectorCommand extends CommandBase {
  type: "MOVE_VECTOR";
  data: {
    x: number;
    y: number;
  };
}

export interface MoveToTileCommand extends CommandBase {
  type: "MOVE_TO_TILE";
  data: {
    x: number;
    y: number;
  };
}

export interface HoverTileCommand extends CommandBase {
  type: "HOVER_TILE";
  data: {
    x: number;
    y: number;
    pointerType: PointerType;
  };
}

export interface TapTileCommand extends CommandBase {
  type: "TAP_TILE";
  data: {
    x: number;
    y: number;
    pointerType: PointerType;
  };
}

export interface FarmInteractCommand extends CommandBase {
  type: "FARM_INTERACT";
}

export interface ActionTriggerCommand extends CommandBase {
  type: "ACTION_TRIGGER";
  data: {
    id: string;
  };
}

export interface UiNavCommand extends CommandBase {
  type: "UI_NAV";
  data: {
    dx: number;
    dy: number;
  };
}

export interface UiConfirmCommand extends CommandBase {
  type: "UI_CONFIRM";
}

export interface UiTabCommand extends CommandBase {
  type: "UI_TAB";
}

export interface DragCommand extends CommandBase {
  type: "DRAG";
  data: {
    dx: number;
    dy: number;
    pointerType: PointerType;
  };
}

export interface ZoomCommand extends CommandBase {
  type: "ZOOM";
  data: {
    factor: number;
    pointerType: PointerType;
  };
}

export interface PointerDownCommand extends CommandBase {
  type: "POINTER_DOWN";
  data: {
    x: number;
    y: number;
    pointerType: PointerType;
  };
}

export interface PointerUpCommand extends CommandBase {
  type: "POINTER_UP";
  data: {
    pointerType: PointerType;
  };
}

export interface SimpleCommand extends CommandBase {
  type: "INTERACT" | "OPEN_MENU";
}

export type Command =
  | MoveVectorCommand
  | MoveToTileCommand
  | HoverTileCommand
  | TapTileCommand
  | FarmInteractCommand
  | ActionTriggerCommand
  | UiNavCommand
  | UiConfirmCommand
  | UiTabCommand
  | DragCommand
  | ZoomCommand
  | PointerDownCommand
  | PointerUpCommand
  | SimpleCommand;
