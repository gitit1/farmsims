import type { NeedsState } from "../sim/needs";
import { PALETTE, withAlpha } from "../render/palette";
import { drawPanel, drawRoundedRect } from "../render/draw";

export interface ActionButtonState {
  id: string;
  label: string;
  enabled: boolean;
}

export interface ActionStatus {
  label: string;
  remainingMinutes: number;
}

export interface HudState {
  fps: number;
  playerTile: { x: number; y: number };
  mode: "Keyboard" | "Pointer" | "Idle";
  hint: string | null;
  time: string;
  money: number;
  needs: NeedsState;
  actionButtons: ActionButtonState[];
  activeAction: ActionStatus | null;
}

export class HUD {
  hitTestAction(x: number, y: number, width: number, height: number, buttons: ActionButtonState[]): string | null {
    const rects = getActionButtonRects(width, height, buttons);
    for (const rect of rects) {
      if (!rect.enabled) {
        continue;
      }
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        return rect.id;
      }
    }
    return null;
  }

  render(ctx: CanvasRenderingContext2D, state: HudState, width: number, height: number): void {
    const headerLines = [
      state.time,
      `Money: $${state.money}`,
      `Move: ${state.mode}`,
      `FPS: ${Math.round(state.fps)}`
    ];

    if (state.activeAction) {
      const minutes = Math.max(0, Math.ceil(state.activeAction.remainingMinutes));
      headerLines.push(`Action: ${state.activeAction.label} (${minutes}m)`);
    }

    if (state.hint) {
      headerLines.push(`Hint: ${state.hint}`);
    }

    const needLines = [
      { key: "Hunger", value: state.needs.hunger, color: "#d68b65" },
      { key: "Energy", value: state.needs.energy, color: "#7aa8d0" },
      { key: "Hygiene", value: state.needs.hygiene, color: "#7db59a" },
      { key: "Fun", value: state.needs.fun, color: "#e0b66d" },
      { key: "Social", value: state.needs.social, color: "#b695c7" }
    ];

    ctx.save();
    const scale = getScale(width);
    const fontSize = Math.round(14 * scale);
    const smallFont = Math.round(12 * scale);
    ctx.font = `${fontSize}px ${PALETTE.uiFont}`;
    ctx.textBaseline = "top";

    const padding = Math.round(12 * scale);
    const lineHeight = Math.round(fontSize * 1.35);
    const spacing = Math.round(lineHeight * 0.4);
    const barHeight = Math.round(8 * scale);
    const barWidth = Math.min(Math.round(210 * scale), Math.max(140, width - padding * 2 - 20));
    const headerHeight = headerLines.length * lineHeight;
    const needsHeight = needLines.length * (lineHeight + barHeight + spacing);
    const idealWidth = barWidth + padding * 2 + 6;
    const boxWidth = Math.min(idealWidth, Math.max(0, width - padding * 2));
    const idealHeight = padding * 2 + headerHeight + needsHeight;
    const boxHeight = Math.min(idealHeight, Math.max(0, height - padding * 2));

    drawPanel(
      ctx,
      { x: padding, y: padding, w: boxWidth, h: boxHeight },
      {
        fill: PALETTE.ui.panel,
        stroke: PALETTE.ui.panelEdge,
        radius: Math.round(14 * scale),
        shadow: { color: PALETTE.ui.panelShadow, offsetY: Math.round(4 * scale) }
      }
    );

    ctx.fillStyle = PALETTE.ui.text;
    let y = padding + Math.round(6 * scale);
    const textX = padding + Math.round(12 * scale);
    for (const line of headerLines) {
      ctx.fillText(line, textX, y);
      y += lineHeight;
    }

    y += spacing;
    for (const need of needLines) {
      const value = Math.round(need.value);
      ctx.fillStyle = PALETTE.ui.text;
      ctx.font = `${fontSize}px ${PALETTE.uiFont}`;
      ctx.fillText(`${need.key}: ${value}`, textX, y);
      y += lineHeight;

      const barX = textX;
      const barY = y;
      const clampedValue = clamp(need.value, 0, 100);
      ctx.fillStyle = withAlpha("#1e1b18", 0.1);
      drawRoundedRect(ctx, barX, barY, barWidth, barHeight, Math.round(4 * scale));
      ctx.fill();
      ctx.fillStyle = need.color;
      drawRoundedRect(ctx, barX, barY, (barWidth * clampedValue) / 100, barHeight, Math.round(4 * scale));
      ctx.fill();
      y += barHeight + spacing;
    }

    const actionRects = getActionButtonRects(width, height, state.actionButtons);
    for (const rect of actionRects) {
      drawActionButton(ctx, rect, scale, smallFont);
    }

    ctx.restore();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getScale(width: number): number {
  return clamp(width / 520, 0.9, 1.4);
}

interface ActionButtonRect extends ActionButtonState {
  x: number;
  y: number;
  w: number;
  h: number;
}

function getActionButtonRects(
  width: number,
  height: number,
  buttons: ActionButtonState[]
): ActionButtonRect[] {
  if (buttons.length === 0) {
    return [];
  }
  const scale = getScale(width);
  const margin = Math.round(14 * scale);
  const buttonHeight = Math.round(46 * scale);
  const spacing = Math.round(10 * scale);
  const availableWidth = Math.max(0, width - margin * 2 - spacing * (buttons.length - 1));
  const targetWidth = Math.round(130 * scale);
  const minWidth = Math.round(92 * scale);
  const buttonWidth = clamp(Math.floor(availableWidth / buttons.length), minWidth, targetWidth);
  const totalWidth = buttonWidth * buttons.length + spacing * (buttons.length - 1);
  const startX = Math.round((width - totalWidth) / 2);
  const y = Math.round(height - margin - buttonHeight);

  return buttons.map((button, index) => ({
    ...button,
    x: startX + index * (buttonWidth + spacing),
    y,
    w: buttonWidth,
    h: buttonHeight
  }));
}

function drawActionButton(
  ctx: CanvasRenderingContext2D,
  rect: ActionButtonRect,
  scale: number,
  fontSize: number
): void {
  ctx.save();
  const radius = Math.round(10 * scale);
  ctx.fillStyle = withAlpha("#1b1711", rect.enabled ? 0.2 : 0.08);
  drawRoundedRect(ctx, rect.x, rect.y + Math.round(3 * scale), rect.w, rect.h, radius);
  ctx.fill();

  ctx.fillStyle = rect.enabled ? PALETTE.ui.accent : PALETTE.ui.disabled;
  ctx.strokeStyle = rect.enabled ? withAlpha(PALETTE.ui.accentDeep, 0.6) : withAlpha(PALETTE.ui.panelEdge, 0.4);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = rect.enabled ? PALETTE.ui.text : PALETTE.ui.textMuted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${fontSize}px ${PALETTE.uiFont}`;
  ctx.fillText(rect.label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.restore();
}
