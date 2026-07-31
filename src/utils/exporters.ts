import type { DielinePath, Point } from "../types";

/* ---------------------------------------------------------------------------
   Papelaria Mestra — Exportação técnica.
   - PNG 300 DPI (impressão profissional)
   - PDF (single-page, JPEG embutido, dependency-free)
   - SVG e DXF (plotters Silhouette / Cricut)
   - Máscara de foil / verniz UV (preto e branco isolado)
--------------------------------------------------------------------------- */

export const PRINT_DPI = 300;

/** mm → pixels no DPI de impressão. */
export function mmToPrintPx(mm: number, dpi = PRINT_DPI): number {
  return Math.round((mm / 25.4) * dpi);
}

/** Dispara o download de um Blob no navegador. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* --------------------------------- PNG ------------------------------------ */

export async function exportPNG(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (blob) downloadBlob(blob, filename);
}

/* --------------------------------- PDF ------------------------------------ */

/**
 * Cria um PDF de página única embutindo a arte como JPEG (DCTDecode).
 * Sem dependências externas: monta a estrutura mínima do PDF manualmente.
 */
export function exportPDF(
  canvas: HTMLCanvasElement,
  sheetWidthMM: number,
  sheetHeightMM: number,
  filename: string,
): void {
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const jpeg = dataUrlToUint8(jpegDataUrl);

  const ptW = (sheetWidthMM / 25.4) * 72;
  const ptH = (sheetHeightMM / 25.4) * 72;
  const pxW = canvas.width;
  const pxH = canvas.height;

  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let cursor = 0;

  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === "string" ? enc.encode(chunk) : chunk;
    parts.push(bytes);
    cursor += bytes.length;
  };
  const startObject = () => {
    offsets.push(cursor);
  };

  push("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

  // 1: Catalog
  startObject();
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // 2: Pages
  startObject();
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  // 3: Page
  startObject();
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW.toFixed(2)} ${ptH.toFixed(
      2,
    )}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );

  // 4: Image XObject
  startObject();
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push("\nendstream\nendobj\n");

  // 5: Content stream
  const content = `q ${ptW.toFixed(2)} 0 0 ${ptH.toFixed(2)} 0 0 cm /Im0 Do Q`;
  startObject();
  push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  // xref
  const xrefStart = cursor;
  const count = offsets.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const merged = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    merged.set(p, pos);
    pos += p.length;
  }
  downloadBlob(new Blob([merged], { type: "application/pdf" }), filename);
}

/* --------------------------- Parsing de path SVG -------------------------- */

/** Converte um ângulo/arco SVG em pontos amostrados (endpoint → centro). */
function sampleArc(
  from: Point,
  rx: number,
  ry: number,
  xAxisRotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  to: Point,
): Point[] {
  const points: Point[] = [];
  const phi = (xAxisRotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  let rxAbs = Math.abs(rx);
  let ryAbs = Math.abs(ry);
  const lambda = (x1p * x1p) / (rxAbs * rxAbs) + (y1p * y1p) / (ryAbs * ryAbs);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rxAbs *= s;
    ryAbs *= s;
  }

  const sign = largeArc !== sweep ? 1 : -1;
  const num =
    rxAbs * rxAbs * ryAbs * ryAbs - rxAbs * rxAbs * y1p * y1p - ryAbs * ryAbs * x1p * x1p;
  const den = rxAbs * rxAbs * y1p * y1p + ryAbs * ryAbs * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * (rxAbs * y1p)) / ryAbs;
  const cyp = (co * -(ryAbs * x1p)) / rxAbs;
  const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rxAbs, (y1p - cyp) / ryAbs);
  let dTheta = angle((x1p - cxp) / rxAbs, (y1p - cyp) / ryAbs, (-x1p - cxp) / rxAbs, (-y1p - cyp) / ryAbs);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const steps = Math.max(6, Math.ceil(Math.abs(dTheta) / (Math.PI / 16)));
  for (let i = 1; i <= steps; i++) {
    const t = theta1 + (dTheta * i) / steps;
    const x = cosPhi * rxAbs * Math.cos(t) - sinPhi * ryAbs * Math.sin(t) + cx;
    const y = sinPhi * rxAbs * Math.cos(t) + cosPhi * ryAbs * Math.sin(t) + cy;
    points.push({ x, y });
  }
  return points;
}

function quad(from: Point, c: Point, to: Point, steps = 16): Point[] {
  const pts: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * from.x + 2 * mt * t * c.x + t * t * to.x,
      y: mt * mt * from.y + 2 * mt * t * c.y + t * t * to.y,
    });
  }
  return pts;
}

function cubic(from: Point, c1: Point, c2: Point, to: Point, steps = 20): Point[] {
  const pts: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * mt * from.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * to.x,
      y: mt * mt * mt * from.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * to.y,
    });
  }
  return pts;
}

/** Converte um atributo `d` de SVG em uma lista de polilinhas (arrays de pontos). */
export function pathToPolylines(d: string): Point[][] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const polylines: Point[][] = [];
  let current: Point[] = [];
  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  let i = 0;
  let cmd = "";

  const num = () => parseFloat(tokens[i++] ?? "0");
  const flush = () => {
    if (current.length > 1) polylines.push(current);
    current = [];
  };

  while (i < tokens.length) {
    const token = tokens[i]!;
    if (/[a-zA-Z]/.test(token)) {
      cmd = token;
      i++;
    }
    const rel = cmd === cmd.toLowerCase();
    const base = rel ? cur : { x: 0, y: 0 };
    switch (cmd.toUpperCase()) {
      case "M": {
        flush();
        cur = { x: base.x + num(), y: base.y + num() };
        start = { ...cur };
        current = [{ ...cur }];
        cmd = rel ? "l" : "L";
        break;
      }
      case "L": {
        cur = { x: base.x + num(), y: base.y + num() };
        current.push({ ...cur });
        break;
      }
      case "H": {
        cur = { x: base.x + num(), y: cur.y };
        current.push({ ...cur });
        break;
      }
      case "V": {
        cur = { x: cur.x, y: base.y + num() };
        current.push({ ...cur });
        break;
      }
      case "Q": {
        const c = { x: base.x + num(), y: base.y + num() };
        const to = { x: base.x + num(), y: base.y + num() };
        current.push(...quad(cur, c, to));
        cur = to;
        break;
      }
      case "C": {
        const c1 = { x: base.x + num(), y: base.y + num() };
        const c2 = { x: base.x + num(), y: base.y + num() };
        const to = { x: base.x + num(), y: base.y + num() };
        current.push(...cubic(cur, c1, c2, to));
        cur = to;
        break;
      }
      case "A": {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = num() !== 0;
        const sweep = num() !== 0;
        const to = { x: base.x + num(), y: base.y + num() };
        current.push(...sampleArc(cur, rx, ry, rot, large, sweep, to));
        cur = to;
        break;
      }
      case "Z": {
        current.push({ ...start });
        cur = { ...start };
        flush();
        break;
      }
      default:
        i++; // token inesperado → avança para evitar loop
        break;
    }
  }
  flush();
  return polylines;
}

/* --------------------------------- SVG ------------------------------------ */

const LINE_COLORS: Record<DielinePath["type"], string> = {
  cut: "#D0021B",
  crease: "#0057FF",
  perforation: "#8B5CF6",
  bleed: "#F5A623",
  glue: "#7ED321",
};

export interface SvgExportOptions {
  widthMM: number;
  heightMM: number;
  paths: DielinePath[];
  /** Arte rasterizada opcional (dataURL) posicionada dentro do molde. */
  artDataUrl?: string;
  artRect?: { x: number; y: number; width: number; height: number };
}

export function buildSVG(options: SvgExportOptions): string {
  const { widthMM, heightMM, paths, artDataUrl, artRect } = options;
  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMM}mm" height="${heightMM}mm" viewBox="0 0 ${widthMM} ${heightMM}">`,
  );
  if (artDataUrl && artRect) {
    lines.push(
      `<image href="${artDataUrl}" x="${artRect.x}" y="${artRect.y}" width="${artRect.width}" height="${artRect.height}" preserveAspectRatio="none" />`,
    );
  }
  lines.push(`<g fill="none" stroke-width="0.25">`);
  for (const p of paths) {
    const color = LINE_COLORS[p.type];
    const dash = p.type === "crease" ? ` stroke-dasharray="2 1.5"` : p.type === "perforation" ? ` stroke-dasharray="1 1"` : "";
    lines.push(`<path d="${p.d}" stroke="${color}"${dash} data-type="${p.type}" />`);
  }
  lines.push(`</g></svg>`);
  return lines.join("\n");
}

export function exportSVG(options: SvgExportOptions, filename: string): void {
  const svg = buildSVG(options);
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), filename);
}

/* --------------------------------- DXF ------------------------------------ */

/**
 * Exporta as linhas de corte/vinco como DXF (AutoCAD R12 ASCII), compatível
 * com Silhouette Studio e Cricut. Curvas são achatadas em polilinhas.
 * O eixo Y é invertido (DXF cresce para cima).
 */
export function buildDXF(paths: DielinePath[], heightMM: number): string {
  const out: string[] = [];
  const w = (code: number | string, value: number | string) => {
    out.push(String(code));
    out.push(String(value));
  };

  w(0, "SECTION");
  w(2, "ENTITIES");

  for (const path of paths) {
    if (path.type === "bleed") continue; // sangria não é linha de corte
    const layerName = path.type.toUpperCase();
    const polylines = pathToPolylines(path.d);
    for (const poly of polylines) {
      if (poly.length < 2) continue;
      w(0, "POLYLINE");
      w(8, layerName);
      w(66, 1);
      w(70, 0);
      for (const pt of poly) {
        w(0, "VERTEX");
        w(8, layerName);
        w(10, pt.x.toFixed(3));
        w(20, (heightMM - pt.y).toFixed(3));
        w(30, "0.0");
      }
      w(0, "SEQEND");
    }
  }

  w(0, "ENDSEC");
  w(0, "EOF");
  return out.join("\n");
}

export function exportDXF(paths: DielinePath[], heightMM: number, filename: string): void {
  const dxf = buildDXF(paths, heightMM);
  downloadBlob(new Blob([dxf], { type: "application/dxf" }), filename);
}

/* ----------------------------- Máscara de foil ---------------------------- */

/**
 * Gera uma máscara preto-e-branco a partir de um canvas: onde há tinta (alfa > limiar)
 * fica preto sobre fundo branco. Serve para hot stamping / foil e verniz UV localizado.
 */
export function buildFoilMask(source: HTMLCanvasElement, threshold = 8): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const srcCtx = source.getContext("2d");
  const dstCtx = out.getContext("2d");
  if (!srcCtx || !dstCtx) return out;

  dstCtx.fillStyle = "#ffffff";
  dstCtx.fillRect(0, 0, out.width, out.height);

  const img = srcCtx.getImageData(0, 0, source.width, source.height);
  const data = img.data;
  const mask = dstCtx.getImageData(0, 0, out.width, out.height);
  const md = mask.data;
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) > threshold) {
      md[i] = 0;
      md[i + 1] = 0;
      md[i + 2] = 0;
      md[i + 3] = 255;
    }
  }
  dstCtx.putImageData(mask, 0, 0);
  return out;
}

export async function exportFoilMask(source: HTMLCanvasElement, filename: string): Promise<void> {
  const mask = buildFoilMask(source);
  await exportPNG(mask, filename);
}
