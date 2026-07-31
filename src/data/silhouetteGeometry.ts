import type {
  BleedSize,
  DielineTemplate,
  Point,
  SheetSize,
  SheetSizeId,
  Size,
} from "../types";

/* ---------------------------------------------------------------------------
   Papelaria Mestra — Geometria vetorial de moldes e encaixe na folha.
   - Cálculo de escala bestFit para A4 / Carta / A3
   - getFrontPanelCenter() para snapping automático de nome/idade
   - Suporte a margens de sangria (bleed) de 0, 3 e 5 mm
--------------------------------------------------------------------------- */

export const SHEET_SIZES: Record<SheetSizeId, SheetSize> = {
  A4: { id: "A4", label: "A4 (210 × 297)", width: 210, height: 297 },
  Carta: { id: "Carta", label: "Carta (216 × 279)", width: 216, height: 279 },
  A3: { id: "A3", label: "A3 (297 × 420)", width: 297, height: 420 },
};

export const BLEED_OPTIONS: BleedSize[] = [0, 3, 5];

/** Margem de segurança interna da folha (mm) para as marcas e pinças. */
export const SHEET_MARGIN_MM = 8;

export interface FitResult {
  /** Fator de escala aplicado ao molde (1 = tamanho real). */
  scale: number;
  /** Deslocamento em mm para centralizar o molde na área útil da folha. */
  offset: Point;
  /** Dimensão do molde já escalado, em mm. */
  scaledSize: Size;
  /** True quando o molde precisou ser reduzido para caber. */
  reduced: boolean;
}

/**
 * Calcula a melhor escala (bestFit) para encaixar o molde na folha escolhida,
 * respeitando a margem e a sangria. Nunca amplia acima de 100% (1.0).
 */
export function bestFit(
  template: DielineTemplate,
  sheetId: SheetSizeId,
  bleed: BleedSize = 0,
): FitResult {
  const sheet = SHEET_SIZES[sheetId];
  const usableW = sheet.width - 2 * SHEET_MARGIN_MM;
  const usableH = sheet.height - 2 * SHEET_MARGIN_MM;

  const artW = template.widthMM + 2 * bleed;
  const artH = template.heightMM + 2 * bleed;

  const rawScale = Math.min(usableW / artW, usableH / artH);
  const scale = Math.min(1, rawScale);

  const scaledSize: Size = { width: artW * scale, height: artH * scale };
  const offset: Point = {
    x: (sheet.width - scaledSize.width) / 2 + bleed * scale,
    y: (sheet.height - scaledSize.height) / 2 + bleed * scale,
  };

  return { scale, offset, scaledSize, reduced: rawScale < 1 };
}

/**
 * Retorna o centro geométrico do painel frontal do molde (em mm, coordenadas
 * do molde). Usado para posicionar automaticamente nome e idade do aniversariante.
 * Cai no centro do bounding box do molde quando não há painel marcado como frontal.
 */
export function getFrontPanelCenter(template: DielineTemplate): Point {
  const front = template.panels.find((p) => p.isFront) ?? template.panels[0];
  if (front) {
    return { x: front.x + front.width / 2, y: front.y + front.height / 2 };
  }
  return { x: template.widthMM / 2, y: template.heightMM / 2 };
}

/** Retângulo do painel frontal (em mm), útil para limitar/alinhar textos. */
export function getFrontPanelRect(template: DielineTemplate): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const front = template.panels.find((p) => p.isFront) ?? template.panels[0];
  if (front) {
    return { x: front.x, y: front.y, width: front.width, height: front.height };
  }
  return { x: 0, y: 0, width: template.widthMM, height: template.heightMM };
}

/**
 * Converte uma coordenada em mm do molde para coordenada em mm na folha,
 * dado o resultado do bestFit.
 */
export function templateToSheet(point: Point, fit: FitResult): Point {
  return {
    x: fit.offset.x + point.x * fit.scale,
    y: fit.offset.y + point.y * fit.scale,
  };
}

/** Área de sangria como retângulo (mm) ao redor do molde escalado. */
export function bleedRect(
  fit: FitResult,
  bleed: BleedSize,
): { x: number; y: number; width: number; height: number } {
  return {
    x: fit.offset.x - bleed * fit.scale,
    y: fit.offset.y - bleed * fit.scale,
    width: fit.scaledSize.width,
    height: fit.scaledSize.height,
  };
}

/** Conversão utilitária: milímetros → pixels a um determinado DPI. */
export function mmToPx(mm: number, dpi = 96): number {
  return (mm / 25.4) * dpi;
}

/** Conversão utilitária: pixels → milímetros a um determinado DPI. */
export function pxToMm(px: number, dpi = 96): number {
  return (px / dpi) * 25.4;
}
