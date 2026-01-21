export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PrismColors {
  top: string;
  left: string;
  right: string;
  outline?: string;
  highlight?: string;
}

export function drawIsoTop(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  fill: string,
  stroke?: string,
  lineWidth: number = 1
): void {
  drawDiamondPath(ctx, cx, cy, width, height);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function drawIsoPrism(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  depth: number,
  colors: PrismColors,
  lineWidth: number = 1
): void {
  const halfW = width / 2;
  const halfH = height / 2;
  const topX = cx;
  const topY = cy - halfH;
  const rightX = cx + halfW;
  const rightY = cy;
  const bottomX = cx;
  const bottomY = cy + halfH;
  const leftX = cx - halfW;
  const leftY = cy;

  const leftDownY = leftY + depth;
  const rightDownY = rightY + depth;
  const bottomDownY = bottomY + depth;

  ctx.beginPath();
  ctx.moveTo(bottomX, bottomY);
  ctx.lineTo(rightX, rightY);
  ctx.lineTo(rightX, rightDownY);
  ctx.lineTo(bottomX, bottomDownY);
  ctx.closePath();
  ctx.fillStyle = colors.right;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(leftX, leftY);
  ctx.lineTo(bottomX, bottomY);
  ctx.lineTo(bottomX, bottomDownY);
  ctx.lineTo(leftX, leftDownY);
  ctx.closePath();
  ctx.fillStyle = colors.left;
  ctx.fill();

  drawDiamondPath(ctx, cx, cy, width, height);
  ctx.fillStyle = colors.top;
  ctx.fill();

  if (colors.outline) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = colors.outline;
    ctx.stroke();
  }

  if (colors.highlight) {
    ctx.save();
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = Math.max(1, lineWidth * 0.75);
    ctx.beginPath();
    ctx.moveTo(leftX, leftY);
    ctx.lineTo(topX, topY);
    ctx.lineTo(rightX, rightY);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  options: {
    fill: string;
    stroke?: string;
    radius: number;
    shadow?: { color: string; offsetY: number };
  }
): void {
  if (options.shadow) {
    ctx.save();
    ctx.fillStyle = options.shadow.color;
    drawRoundedRect(ctx, rect.x, rect.y + options.shadow.offsetY, rect.w, rect.h, options.radius);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, options.radius);
  ctx.fillStyle = options.fill;
  ctx.fill();
  if (options.stroke) {
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawEllipseShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDiamondPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number
): void {
  const halfW = width / 2;
  const halfH = height / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
}
