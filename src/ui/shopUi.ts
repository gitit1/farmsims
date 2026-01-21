import type { InventoryState } from "../sim/inventory";
import { getItemCount } from "../sim/inventory";
import type { ShopItem, ShopMode } from "../sim/shop";
import { getMaxShopQuantity } from "../sim/shop";
import { PALETTE, withAlpha } from "../render/palette";
import { drawPanel, drawRoundedRect } from "../render/draw";

export interface ShopUiState {
  time: string;
  money: number;
  mode: ShopMode;
  items: ShopItem[];
  pageIndex: number;
  selectedIndex: number;
  quantity: number;
  inventory: InventoryState;
}

export type ShopUiAction =
  | { type: "select"; index: number }
  | { type: "tab"; mode: ShopMode }
  | { type: "page"; delta: number }
  | { type: "quantity"; delta: number }
  | { type: "confirm" }
  | { type: "close" };

export class ShopUi {
  handlePointer(x: number, y: number, width: number, height: number, state: ShopUiState): ShopUiAction | null {
    const layout = getLayout(width, height, state.items.length);

    if (inRect(x, y, layout.close)) {
      return { type: "close" };
    }

    if (inRect(x, y, layout.tabs.buy)) {
      return { type: "tab", mode: "buy" };
    }
    if (inRect(x, y, layout.tabs.sell)) {
      return { type: "tab", mode: "sell" };
    }

    if (layout.page.show) {
      if (inRect(x, y, layout.page.prev)) {
        return { type: "page", delta: -1 };
      }
      if (inRect(x, y, layout.page.next)) {
        return { type: "page", delta: 1 };
      }
    }

    const pageIndex = clamp(state.pageIndex, 0, Math.max(0, layout.pageCount - 1));
    const pageStart = layout.capacity * pageIndex;
    for (let index = 0; index < layout.slots.length; index += 1) {
      const slot = layout.slots[index];
      const itemIndex = pageStart + index;
      if (!slot || itemIndex >= state.items.length) {
        continue;
      }
      if (inRect(x, y, slot)) {
        return { type: "select", index: itemIndex };
      }
    }

    if (inRect(x, y, layout.qty.minus)) {
      return { type: "quantity", delta: -1 };
    }
    if (inRect(x, y, layout.qty.plus)) {
      return { type: "quantity", delta: 1 };
    }
    if (inRect(x, y, layout.actionButton)) {
      return { type: "confirm" };
    }

    return null;
  }

  moveSelection(
    current: number,
    dx: number,
    dy: number,
    width: number,
    itemCount: number,
    pageIndex: number
  ): { index: number; pageIndex: number } {
    if (itemCount <= 0) {
      return { index: 0, pageIndex: 0 };
    }
    const { columns, rows } = getGridConfig(width);
    const capacity = Math.max(1, columns * rows);
    const maxIndex = itemCount - 1;
    const pageCount = Math.max(1, Math.ceil(itemCount / capacity));
    let currentPage = clamp(pageIndex, 0, pageCount - 1);
    const localIndex = clamp(current - currentPage * capacity, 0, capacity - 1);
    let col = localIndex % columns;
    let row = Math.floor(localIndex / columns);

    let nextCol = col + dx;
    let nextRow = row + dy;

    if (nextCol < 0) {
      nextCol = 0;
    } else if (nextCol >= columns) {
      nextCol = columns - 1;
    }

    if (nextRow < 0) {
      if (currentPage > 0) {
        currentPage -= 1;
        nextRow = rows - 1;
      } else {
        nextRow = 0;
      }
    } else if (nextRow >= rows) {
      if (currentPage < pageCount - 1) {
        currentPage += 1;
        nextRow = 0;
      } else {
        nextRow = rows - 1;
      }
    }

    let nextIndex = currentPage * capacity + nextRow * columns + nextCol;
    if (nextIndex > maxIndex) {
      nextIndex = maxIndex;
      currentPage = Math.floor(nextIndex / capacity);
    }
    return { index: nextIndex, pageIndex: currentPage };
  }

  getGridCapacity(width: number): number {
    const { columns, rows } = getGridConfig(width);
    return columns * rows;
  }

  render(ctx: CanvasRenderingContext2D, state: ShopUiState, width: number, height: number): void {
    const layout = getLayout(width, height, state.items.length);
    const scale = layout.scale;
    const pageIndex = clamp(state.pageIndex, 0, Math.max(0, layout.pageCount - 1));
    const pageStart = pageIndex * layout.capacity;
    const selectedItem = state.items[state.selectedIndex] ?? null;
    const ownedCount = selectedItem ? getItemCount(state.inventory, selectedItem.id) : 0;
    const maxQty = getMaxShopQuantity(state.mode, selectedItem, state.money, ownedCount);
    const canAfford =
      !!selectedItem && state.mode === "buy" && selectedItem.priceBuy * state.quantity <= state.money;
    const canSell = !!selectedItem && state.mode === "sell" && ownedCount >= state.quantity;
    const canConfirm = state.mode === "buy" ? canAfford : canSell;

    ctx.save();
    ctx.fillStyle = "rgba(10, 12, 16, 0.6)";
    ctx.fillRect(0, 0, width, height);

    drawPanel(ctx, layout.panel, {
      fill: PALETTE.ui.panel,
      stroke: PALETTE.ui.panelEdge,
      radius: Math.round(16 * scale),
      shadow: { color: PALETTE.ui.panelShadow, offsetY: Math.round(6 * scale) }
    });

    ctx.fillStyle = PALETTE.ui.text;
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(22 * scale)}px ${PALETTE.uiFont}`;
    ctx.fillText("Shop", layout.header.x, layout.header.y + layout.header.h / 2);

    ctx.font = `${Math.round(13 * scale)}px ${PALETTE.uiFont}`;
    ctx.textAlign = "left";
    ctx.fillStyle = PALETTE.ui.textMuted;
    ctx.fillText(state.time, layout.header.x + Math.round(92 * scale), layout.header.y + layout.header.h / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = PALETTE.ui.text;
    ctx.fillText(
      `Money: $${state.money}`,
      layout.header.x + layout.header.w - layout.close.w - Math.round(16 * scale),
      layout.header.y + layout.header.h / 2
    );

    drawButton(ctx, layout.close, "Close", scale, true);

    drawTab(ctx, layout.tabs.buy, "Buy", scale, state.mode === "buy");
    drawTab(ctx, layout.tabs.sell, "Sell", scale, state.mode === "sell");

    for (let index = 0; index < layout.slots.length; index += 1) {
      const slot = layout.slots[index];
      if (!slot) {
        continue;
      }
      const itemIndex = pageStart + index;
      const item = state.items[itemIndex];
      const isSelected = itemIndex === state.selectedIndex;
      drawSlot(ctx, slot, scale, isSelected);
      if (item) {
        drawItemIcon(ctx, slot, item, scale);
        const owned = getItemCount(state.inventory, item.id);
        if (owned > 0) {
          drawBadge(ctx, slot, owned, scale);
        }
      }
    }

    if (layout.page.show) {
      const canPrev = pageIndex > 0;
      const canNext = pageIndex < layout.pageCount - 1;
      drawPageButton(ctx, layout.page.prev, "Prev", scale, canPrev);
      drawPageButton(ctx, layout.page.next, "Next", scale, canNext);
      ctx.save();
      ctx.fillStyle = PALETTE.ui.textMuted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.round(12 * scale)}px ${PALETTE.uiFont}`;
      ctx.fillText(
        `Page ${pageIndex + 1}/${layout.pageCount}`,
        layout.page.label.x + layout.page.label.w / 2,
        layout.page.label.y + layout.page.label.h / 2
      );
      ctx.restore();
    }

    drawDetailPanel(
      ctx,
      layout.detail,
      scale,
      selectedItem,
      ownedCount,
      state.mode,
      state.quantity,
      maxQty
    );

    const minusEnabled = state.quantity > 1;
    const plusEnabled = state.quantity < maxQty;
    drawStepper(ctx, layout.qty, scale, minusEnabled, plusEnabled, state.quantity);

    const actionLabel = state.mode === "buy" ? "Buy" : "Sell";
    drawPrimaryButton(ctx, layout.actionButton, actionLabel, scale, canConfirm);

    ctx.restore();
  }
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  scale: number;
  panel: Rect;
  header: Rect;
  close: Rect;
  tabs: {
    buy: Rect;
    sell: Rect;
  };
  slots: Rect[];
  capacity: number;
  pageCount: number;
  page: {
    show: boolean;
    prev: Rect;
    next: Rect;
    label: Rect;
  };
  detail: Rect;
  qty: {
    minus: Rect;
    plus: Rect;
    box: Rect;
  };
  actionButton: Rect;
}

function getLayout(width: number, height: number, itemCount: number): Layout {
  const scale = getScale(width);
  const outerPad = Math.round(16 * scale);
  const innerPad = Math.round(16 * scale);
  const panel: Rect = {
    x: outerPad,
    y: outerPad,
    w: Math.max(0, width - outerPad * 2),
    h: Math.max(0, height - outerPad * 2)
  };

  const headerH = Math.round(46 * scale);
  const header: Rect = {
    x: panel.x + innerPad,
    y: panel.y + innerPad,
    w: panel.w - innerPad * 2,
    h: headerH
  };

  const closeW = Math.round(76 * scale);
  const closeH = Math.round(28 * scale);
  const close: Rect = {
    x: header.x + header.w - closeW,
    y: header.y + Math.round((header.h - closeH) / 2),
    w: closeW,
    h: closeH
  };

  const tabGap = Math.round(8 * scale);
  const tabH = Math.round(32 * scale);
  const tabsY = header.y + header.h + Math.round(8 * scale);
  const tabW = Math.floor((header.w - tabGap) / 2);
  const tabs = {
    buy: { x: header.x, y: tabsY, w: tabW, h: tabH },
    sell: { x: header.x + tabW + tabGap, y: tabsY, w: tabW, h: tabH }
  };

  const bodyY = tabsY + tabH + Math.round(12 * scale);
  const bodyH = panel.y + panel.h - innerPad - bodyY;
  const body: Rect = {
    x: header.x,
    y: bodyY,
    w: header.w,
    h: Math.max(0, bodyH)
  };

  const isSmall = width < 720;
  const splitGap = Math.round(12 * scale);
  let gridRect: Rect;
  let detailRect: Rect;

  if (isSmall) {
    const gridH = Math.floor(body.h * 0.55);
    gridRect = { x: body.x, y: body.y, w: body.w, h: gridH };
    detailRect = {
      x: body.x,
      y: gridRect.y + gridRect.h + splitGap,
      w: body.w,
      h: Math.max(0, body.h - gridRect.h - splitGap)
    };
  } else {
    const gridW = Math.floor(body.w * 0.58);
    gridRect = { x: body.x, y: body.y, w: gridW, h: body.h };
    detailRect = {
      x: gridRect.x + gridRect.w + splitGap,
      y: body.y,
      w: Math.max(0, body.w - gridRect.w - splitGap),
      h: body.h
    };
  }

  const { columns, rows } = getGridConfig(width);
  const capacity = Math.max(1, columns * rows);
  const pageCount = Math.max(1, Math.ceil(itemCount / capacity));
  const showPaging = pageCount > 1;
  const gap = Math.round(8 * scale);
  const pageBarH = showPaging ? Math.round(28 * scale) : 0;
  const pageGap = showPaging ? Math.round(8 * scale) : 0;
  const slotAreaH = Math.max(0, gridRect.h - pageBarH - pageGap);
  const slotSize = Math.floor(
    Math.min(
      (gridRect.w - gap * (columns - 1)) / columns,
      (slotAreaH - gap * (rows - 1)) / rows
    )
  );
  const totalGridW = slotSize * columns + gap * (columns - 1);
  const totalGridH = slotSize * rows + gap * (rows - 1);
  const startX = gridRect.x + Math.round((gridRect.w - totalGridW) / 2);
  const startY = gridRect.y + Math.round((slotAreaH - totalGridH) / 2);
  const slots: Rect[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      slots.push({
        x: startX + col * (slotSize + gap),
        y: startY + row * (slotSize + gap),
        w: slotSize,
        h: slotSize
      });
    }
  }

  const pageY = gridRect.y + gridRect.h - pageBarH;
  const pageButtonW = Math.round(80 * scale);
  const pagePrev: Rect = {
    x: gridRect.x,
    y: pageY,
    w: pageButtonW,
    h: pageBarH
  };
  const pageNext: Rect = {
    x: gridRect.x + gridRect.w - pageButtonW,
    y: pageY,
    w: pageButtonW,
    h: pageBarH
  };
  const pageLabel: Rect = {
    x: pagePrev.x + pagePrev.w + gap,
    y: pageY,
    w: Math.max(0, gridRect.w - pagePrev.w - pageNext.w - gap * 2),
    h: pageBarH
  };

  const detailPad = Math.round(14 * scale);
  const buttonH = Math.round(40 * scale);
  const stepperH = Math.round(34 * scale);
  const actionButton: Rect = {
    x: detailRect.x + detailPad,
    y: detailRect.y + detailRect.h - detailPad - buttonH,
    w: Math.max(0, detailRect.w - detailPad * 2),
    h: buttonH
  };
  const stepperY = actionButton.y - Math.round(10 * scale) - stepperH;
  const stepperW = actionButton.w;
  const minus: Rect = {
    x: actionButton.x,
    y: stepperY,
    w: stepperH,
    h: stepperH
  };
  const plus: Rect = {
    x: actionButton.x + stepperW - stepperH,
    y: stepperY,
    w: stepperH,
    h: stepperH
  };
  const box: Rect = {
    x: minus.x + minus.w + Math.round(6 * scale),
    y: stepperY,
    w: Math.max(0, stepperW - minus.w - plus.w - Math.round(12 * scale)),
    h: stepperH
  };

  return {
    scale,
    panel,
    header,
    close,
    tabs,
    slots,
    capacity,
    pageCount,
    page: {
      show: showPaging,
      prev: pagePrev,
      next: pageNext,
      label: pageLabel
    },
    detail: detailRect,
    qty: { minus, plus, box },
    actionButton
  };
}

function getGridConfig(width: number): { columns: number; rows: number } {
  if (width < 720) {
    return { columns: 3, rows: 4 };
  }
  return { columns: 5, rows: 3 };
}

function drawTab(ctx: CanvasRenderingContext2D, rect: Rect, label: string, scale: number, active: boolean): void {
  ctx.save();
  ctx.fillStyle = active ? PALETTE.ui.accent : withAlpha(PALETTE.ui.panelEdge, 0.15);
  ctx.strokeStyle = active ? withAlpha(PALETTE.ui.accentDeep, 0.5) : withAlpha(PALETTE.ui.panelEdge, 0.25);
  drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.round(9 * scale));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = active ? PALETTE.ui.text : PALETTE.ui.textMuted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(14 * scale)}px ${PALETTE.uiFont}`;
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.restore();
}

function drawSlot(ctx: CanvasRenderingContext2D, rect: Rect, scale: number, selected: boolean): void {
  ctx.save();
  if (selected) {
    ctx.fillStyle = withAlpha(PALETTE.ui.accentSoft, 0.9);
  } else {
    ctx.fillStyle = withAlpha("#ffffff", 0.65);
  }
  ctx.strokeStyle = selected ? withAlpha(PALETTE.ui.accentDeep, 0.7) : withAlpha(PALETTE.ui.panelEdge, 0.3);
  ctx.lineWidth = selected ? 2 : 1;
  drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.round(12 * scale));
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawItemIcon(ctx: CanvasRenderingContext2D, rect: Rect, item: ShopItem, scale: number): void {
  const pad = Math.round(10 * scale);
  const iconRect: Rect = {
    x: rect.x + pad,
    y: rect.y + pad,
    w: rect.w - pad * 2,
    h: rect.h - pad * 2
  };
  ctx.save();
  ctx.fillStyle = item.iconColor;
  ctx.strokeStyle = withAlpha("#2b241d", 0.2);
  drawRoundedRect(ctx, iconRect.x, iconRect.y, iconRect.w, iconRect.h, Math.round(10 * scale));
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = withAlpha("#ffffff", 0.45);
  drawRoundedRect(
    ctx,
    iconRect.x + Math.round(3 * scale),
    iconRect.y + Math.round(3 * scale),
    iconRect.w * 0.45,
    iconRect.h * 0.3,
    Math.round(8 * scale)
  );
  ctx.fill();

  ctx.fillStyle = "#fef6ea";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(iconRect.w * 0.4)}px ${PALETTE.uiFont}`;
  ctx.fillText(item.iconLabel, iconRect.x + iconRect.w / 2, iconRect.y + iconRect.h / 2);
  ctx.restore();
}

function drawBadge(ctx: CanvasRenderingContext2D, rect: Rect, count: number, scale: number): void {
  const badgeSize = Math.round(18 * scale);
  const x = rect.x + rect.w - badgeSize - Math.round(6 * scale);
  const y = rect.y + rect.h - badgeSize - Math.round(6 * scale);
  ctx.save();
  ctx.fillStyle = withAlpha("#2f2720", 0.85);
  ctx.beginPath();
  ctx.arc(x + badgeSize / 2, y + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fef6ea";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(11 * scale)}px ${PALETTE.uiFont}`;
  ctx.fillText(String(count), x + badgeSize / 2, y + badgeSize / 2);
  ctx.restore();
}

function drawDetailPanel(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  scale: number,
  item: ShopItem | null,
  owned: number,
  mode: ShopMode,
  quantity: number,
  maxQty: number
): void {
  ctx.save();
  drawPanel(ctx, rect, {
    fill: PALETTE.ui.panelSoft,
    stroke: withAlpha(PALETTE.ui.panelEdge, 0.25),
    radius: Math.round(12 * scale)
  });

  const pad = Math.round(14 * scale);
  let y = rect.y + pad;

  if (!item) {
    ctx.fillStyle = PALETTE.ui.textMuted;
    ctx.font = `${Math.round(14 * scale)}px ${PALETTE.uiFont}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("No item selected", rect.x + pad, y);
    ctx.restore();
    return;
  }

  const iconSize = Math.round(Math.min(rect.w, rect.h) * 0.28);
  const iconRect: Rect = {
    x: rect.x + pad,
    y,
    w: iconSize,
    h: iconSize
  };
  ctx.fillStyle = item.iconColor;
  ctx.strokeStyle = withAlpha("#2b241d", 0.2);
  drawRoundedRect(ctx, iconRect.x, iconRect.y, iconRect.w, iconRect.h, Math.round(10 * scale));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fef6ea";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(iconRect.w * 0.4)}px ${PALETTE.uiFont}`;
  ctx.fillText(item.iconLabel, iconRect.x + iconRect.w / 2, iconRect.y + iconRect.h / 2);

  const textX = iconRect.x + iconRect.w + Math.round(12 * scale);
  const lineHeight = Math.round(18 * scale);
  ctx.fillStyle = PALETTE.ui.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `${Math.round(16 * scale)}px ${PALETTE.uiFont}`;
  ctx.fillText(item.name, textX, y);
  y += lineHeight;
  ctx.fillStyle = PALETTE.ui.textMuted;
  ctx.font = `${Math.round(13 * scale)}px ${PALETTE.uiFont}`;
  wrapText(ctx, item.description, textX, y, rect.x + rect.w - pad - textX, lineHeight);
  y += lineHeight * 2;
  ctx.fillText(`Category: ${item.category}`, textX, y);
  y += lineHeight;
  ctx.fillText(`Owned: ${owned}`, textX, y);
  y += lineHeight;
  const price = mode === "buy" ? item.priceBuy : item.priceSell;
  ctx.fillText(`Price: $${price}`, textX, y);

  ctx.fillStyle = PALETTE.ui.textMuted;
  ctx.font = `${Math.round(12 * scale)}px ${PALETTE.uiFont}`;
  ctx.fillText(`Max ${maxQty}`, rect.x + pad, rect.y + rect.h - pad - Math.round(78 * scale));
  ctx.fillText(`Qty ${quantity}`, rect.x + pad, rect.y + rect.h - pad - Math.round(60 * scale));

  ctx.restore();
}

function drawStepper(
  ctx: CanvasRenderingContext2D,
  rects: { minus: Rect; plus: Rect; box: Rect },
  scale: number,
  minusEnabled: boolean,
  plusEnabled: boolean,
  quantity: number
): void {
  drawStepButton(ctx, rects.minus, "-", scale, minusEnabled);
  drawStepButton(ctx, rects.plus, "+", scale, plusEnabled);
  ctx.save();
  ctx.fillStyle = withAlpha("#ffffff", 0.7);
  ctx.strokeStyle = withAlpha(PALETTE.ui.panelEdge, 0.25);
  drawRoundedRect(ctx, rects.box.x, rects.box.y, rects.box.w, rects.box.h, Math.round(8 * scale));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.ui.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(14 * scale)}px ${PALETTE.uiFont}`;
  ctx.fillText(String(quantity), rects.box.x + rects.box.w / 2, rects.box.y + rects.box.h / 2);
  ctx.restore();
}

function drawStepButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  scale: number,
  enabled: boolean
): void {
  ctx.save();
  ctx.fillStyle = enabled ? PALETTE.ui.accent : PALETTE.ui.disabled;
  ctx.strokeStyle = enabled ? withAlpha(PALETTE.ui.accentDeep, 0.6) : withAlpha(PALETTE.ui.panelEdge, 0.25);
  drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.round(8 * scale));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = enabled ? PALETTE.ui.text : PALETTE.ui.textMuted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(16 * scale)}px ${PALETTE.uiFont}`;
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  ctx.restore();
}

function drawPageButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  scale: number,
  enabled: boolean
): void {
  if (rect.w <= 0 || rect.h <= 0) {
    return;
  }
  ctx.save();
  ctx.fillStyle = enabled ? withAlpha("#ffffff", 0.7) : PALETTE.ui.disabled;
  ctx.strokeStyle = enabled ? withAlpha(PALETTE.ui.panelEdge, 0.3) : withAlpha(PALETTE.ui.panelEdge, 0.2);
  drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.round(8 * scale));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = enabled ? PALETTE.ui.text : PALETTE.ui.textMuted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(12 * scale)}px ${PALETTE.uiFont}`;
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.restore();
}

function drawPrimaryButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  scale: number,
  enabled: boolean
): void {
  ctx.save();
  ctx.fillStyle = enabled ? PALETTE.ui.accent : PALETTE.ui.disabled;
  ctx.strokeStyle = enabled ? withAlpha(PALETTE.ui.accentDeep, 0.6) : withAlpha(PALETTE.ui.panelEdge, 0.3);
  drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.round(10 * scale));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = enabled ? PALETTE.ui.text : PALETTE.ui.textMuted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(16 * scale)}px ${PALETTE.uiFont}`;
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.restore();
}

function drawButton(ctx: CanvasRenderingContext2D, rect: Rect, label: string, scale: number, enabled: boolean): void {
  ctx.save();
  ctx.fillStyle = enabled ? withAlpha("#ffffff", 0.75) : PALETTE.ui.disabled;
  ctx.strokeStyle = withAlpha(PALETTE.ui.panelEdge, 0.3);
  drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.round(8 * scale));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = enabled ? PALETTE.ui.text : PALETTE.ui.textMuted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(12 * scale)}px ${PALETTE.uiFont}`;
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, lineY);
  }
}

function inRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function getScale(width: number): number {
  return clamp(width / 920, 0.85, 1.25);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
