import type { ArtLayer, BlendMode, FadeEdge } from "../types";

/* ---------------------------------------------------------------------------
   Papelaria Mestra — Pipeline de composição de estampas em HTML5 Canvas.
   - Combina múltiplas camadas de arte (upload ou IA)
   - Aplica blend modes (multiply, screen, overlay, darken, lighten)
   - Esmaece bordas no canal alfa (radial, vinheta e direcionais)
--------------------------------------------------------------------------- */

const imageCache = new Map<string, HTMLImageElement>();

/** Carrega uma imagem (com cache) resolvendo apenas quando estiver pronta. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return Promise.resolve(cached);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${url}`));
    img.src = url;
  });
}

/** Converte o blendMode da camada para o globalCompositeOperation do canvas. */
function toCompositeOperation(mode: BlendMode): GlobalCompositeOperation {
  switch (mode) {
    case "normal":
      return "source-over";
    case "multiply":
      return "multiply";
    case "screen":
      return "screen";
    case "overlay":
      return "overlay";
    case "darken":
      return "darken";
    case "lighten":
      return "lighten";
    default:
      return "source-over";
  }
}

/**
 * Aplica um esmaecimento de borda no canal alfa de um canvas já desenhado,
 * usando composição destination-in com um gradiente cuja opacidade decai.
 */
export function applyFade(
  canvas: HTMLCanvasElement,
  edge: FadeEdge,
  amountPct: number,
): void {
  if (edge === "none" || amountPct <= 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width: w, height: h } = canvas;
  const amount = Math.min(1, Math.max(0, amountPct / 100));

  ctx.save();
  ctx.globalCompositeOperation = "destination-in";

  let gradient: CanvasGradient;
  if (edge === "radial" || edge === "vignette") {
    const cx = w / 2;
    const cy = h / 2;
    const outer = Math.hypot(w, h) / 2;
    // Vinheta esmaece mais forte; radial é mais suave.
    const innerStop = edge === "vignette" ? 1 - amount * 0.9 : 1 - amount;
    gradient = ctx.createRadialGradient(cx, cy, outer * Math.max(0, innerStop), cx, cy, outer);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
  } else {
    const map: Record<string, [number, number, number, number]> = {
      "linear-top": [0, 0, 0, h],
      "linear-bottom": [0, h, 0, 0],
      "linear-left": [0, 0, w, 0],
      "linear-right": [w, 0, 0, 0],
    };
    const coords = map[edge] ?? [0, 0, 0, h];
    gradient = ctx.createLinearGradient(coords[0], coords[1], coords[2], coords[3]);
    const fadeStart = Math.max(0, 1 - amount);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(fadeStart, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,1)");
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export interface RenderOptions {
  /** Largura do canvas de destino, em pixels. */
  widthPx: number;
  /** Altura do canvas de destino, em pixels. */
  heightPx: number;
  /** Fator de conversão de mm para px (px por mm). */
  pxPerMm: number;
  /** Cor de fundo opcional (ex.: cor de papel). Transparente se ausente. */
  background?: string;
}

/**
 * Renderiza todas as camadas visíveis, ordenadas por zIndex, sobre um canvas.
 * As posições x/y das camadas são em mm; scale é percentual (100 = 1x).
 */
export async function renderArtLayers(
  layers: ArtLayer[],
  options: RenderOptions,
): Promise<HTMLCanvasElement> {
  const { widthPx, heightPx, pxPerMm, background } = options;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(widthPx));
  canvas.height = Math.max(1, Math.round(heightPx));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const ordered = [...layers]
    .filter((l) => l.visible && l.opacity > 0)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of ordered) {
    let img: HTMLImageElement;
    try {
      img = await loadImage(layer.url);
    } catch {
      continue; // imagem inválida → pula a camada
    }

    const drawW = img.naturalWidth * (layer.scale / 100) * (pxPerMm / (96 / 25.4));
    const drawH = img.naturalHeight * (layer.scale / 100) * (pxPerMm / (96 / 25.4));
    if (drawW < 1 || drawH < 1) continue;

    // Desenha a camada num offscreen próprio para isolar o efeito de fade.
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(drawW));
    off.height = Math.max(1, Math.round(drawH));
    const offCtx = off.getContext("2d");
    if (!offCtx) continue;

    offCtx.save();
    if (layer.flipH) {
      offCtx.translate(off.width, 0);
      offCtx.scale(-1, 1);
    }
    offCtx.drawImage(img, 0, 0, off.width, off.height);
    offCtx.restore();

    applyFade(off, layer.fadeEdge, layer.fadeAmount);

    // Posiciona e rotaciona no canvas principal.
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = toCompositeOperation(layer.blendMode);

    const centerX = layer.x * pxPerMm + drawW / 2;
    const centerY = layer.y * pxPerMm + drawH / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.drawImage(off, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  return canvas;
}

/**
 * Gera um padrão contínuo (seamless) de forma procedural — usado como fallback
 * quando o modelo de imagem da IA não está disponível. Produz um dataURL PNG.
 */
export function generateProceduralPattern(
  seedColors: string[],
  size = 512,
  motif: "dots" | "leaves" | "confetti" | "waves" = "confetti",
): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const palette = seedColors.length > 0 ? seedColors : ["#89A47E", "#D97724", "#5A5A40", "#FCFAF7"];
  ctx.fillStyle = palette[palette.length - 1] ?? "#FCFAF7";
  ctx.fillRect(0, 0, size, size);

  // Gerador pseudo-aleatório determinístico simples.
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const drawMotif = (x: number, y: number, s: number, color: string) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, s * 0.15);
    if (motif === "dots") {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (motif === "leaves") {
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.3, s * 0.6, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    } else if (motif === "waves") {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      // confetti
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * Math.PI);
      ctx.fillRect(-s * 0.25, -s * 0.25, s * 0.5, s * 0.5);
      ctx.restore();
    }
  };

  const cells = 6;
  const step = size / cells;
  for (let gy = 0; gy <= cells; gy++) {
    for (let gx = 0; gx <= cells; gx++) {
      const jitterX = (rand() - 0.5) * step * 0.4;
      const jitterY = (rand() - 0.5) * step * 0.4;
      const x = gx * step + jitterX;
      const y = gy * step + jitterY;
      const s = step * (0.4 + rand() * 0.4);
      const color = palette[Math.floor(rand() * Math.max(1, palette.length - 1))] ?? palette[0]!;
      // Repete nas bordas opostas para garantir continuidade (seamless).
      drawMotif(x, y, s, color);
      if (x < s) drawMotif(x + size, y, s, color);
      if (x > size - s) drawMotif(x - size, y, s, color);
      if (y < s) drawMotif(x, y + size, s, color);
      if (y > size - s) drawMotif(x, y - size, s, color);
    }
  }

  return canvas.toDataURL("image/png");
}
