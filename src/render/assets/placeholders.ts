import type { AssetSize, PlaceholderKind } from "./assetTypes";

export function createPlaceholderCanvas(id: string, size: AssetSize, kind: PlaceholderKind): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(size.w));
  canvas.height = Math.max(1, Math.round(size.h));

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const base = colorFromId(id, 52, 46);
  const shade = colorFromId(id, 52, 34);
  const highlight = colorFromId(id, 48, 62);

  if (kind === "tile") {
    drawTilePlaceholder(ctx, canvas.width, canvas.height, base, shade, highlight);
  } else if (kind === "crop") {
    drawCropPlaceholder(ctx, canvas.width, canvas.height, base, highlight);
  } else {
    drawEntityPlaceholder(ctx, canvas.width, canvas.height, base, highlight);
  }

  return canvas;
}

function drawTilePlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: string,
  shade: string,
  highlight: string
): void {
  const cx = width / 2;
  const cy = height / 2;
  const halfW = width / 2;
  const halfH = height / 2;

  const grad = ctx.createLinearGradient(0, cy - halfH, 0, cy + halfH);
  grad.addColorStop(0, highlight);
  grad.addColorStop(1, base);

  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = shade;
  ctx.lineWidth = Math.max(1, width * 0.02);
  ctx.stroke();
}

function drawEntityPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: string,
  highlight: string
): void {
  const centerX = width / 2;
  const groundY = height * 0.88;
  const bodyW = width * 0.42;
  const bodyH = height * 0.38;
  const headR = width * 0.18;

  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(centerX, groundY, bodyW * 0.45, bodyH * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = base;
  ctx.fillRect(centerX - bodyW / 2, groundY - bodyH, bodyW, bodyH);

  ctx.fillStyle = highlight;
  ctx.beginPath();
  ctx.arc(centerX, groundY - bodyH - headR * 0.65, headR, 0, Math.PI * 2);
  ctx.fill();
}

function drawCropPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: string,
  highlight: string
): void {
  const centerX = width / 2;
  const groundY = height * 0.78;
  const leafW = width * 0.32;
  const leafH = height * 0.2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.beginPath();
  ctx.ellipse(centerX, groundY, leafW * 0.6, leafH * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(centerX - leafW * 0.2, groundY - leafH * 0.6, leafW * 0.45, leafH * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = highlight;
  ctx.beginPath();
  ctx.ellipse(centerX + leafW * 0.2, groundY - leafH * 0.7, leafW * 0.4, leafH * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
}

function colorFromId(id: string, saturation: number, lightness: number): string {
  const hue = hashString(id) % 360;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
