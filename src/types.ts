/* ---------------------------------------------------------------------------
   Papelaria Mestra — Interfaces de tipo centrais
   (moldes/dielines, camadas de arte, camadas de texto, folha de impressão, IA)
--------------------------------------------------------------------------- */

/** Camada de arte (imagem carregada ou gerada por IA) posicionada sobre o molde. */
export interface ArtLayer {
  id: string;
  name: string;
  url: string;
  x: number; // Offset X em mm
  y: number; // Offset Y em mm
  scale: number; // Escala 10% a 400%
  rotation: number; // Rotação -180 a 180°
  flipH: boolean;
  opacity: number; // Opacidade de 0.0 a 1.0
  blendMode: "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
  fadeEdge:
    | "none"
    | "radial"
    | "vignette"
    | "linear-top"
    | "linear-bottom"
    | "linear-left"
    | "linear-right";
  fadeAmount: number; // Porcentagem do esmaecimento de borda (0-100%)
  visible: boolean;
  zIndex: number;
}

/** Camada de texto (nome, idade, frase) posicionada em mm sobre a folha. */
export interface TextLayer {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  rotation: number;
  bold: boolean;
  italic: boolean;
  stroke: boolean; // Contorno branco para contraste sobre estampas
  strokeWidth: number;
  x: number; // Coordenada mm na folha
  y: number; // Coordenada mm na folha
  type: "text" | "number";
}

export type BlendMode = ArtLayer["blendMode"];
export type FadeEdge = ArtLayer["fadeEdge"];

/* ------------------------------- Geometria -------------------------------- */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Tipo de linha do molde estrutural. */
export type DielineLineType = "cut" | "crease" | "perforation" | "bleed" | "glue";

/** Traçado vetorial (em coordenadas mm) que compõe o molde. */
export interface DielinePath {
  type: DielineLineType;
  /** Caminho SVG em mm. Ex.: "M 0 0 L 100 0 L 100 60 L 0 60 Z" */
  d: string;
}

/** Painel/face nomeada do molde (usado para snapping e mapeamento 3D). */
export interface DielinePanel {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Face frontal principal (recebe automaticamente nome/idade). */
  isFront?: boolean;
  /** Papel do painel na montagem 3D. */
  role?: "front" | "back" | "left" | "right" | "top" | "bottom" | "flap";
}

export type DielineCategory =
  | "caixa"
  | "caderno"
  | "embalagem"
  | "convite"
  | "lembrancinha";

/** Definição completa de um molde estrutural. */
export interface DielineTemplate {
  id: string;
  name: string;
  category: DielineCategory;
  description: string;
  /** Largura total do molde planificado, em mm. */
  widthMM: number;
  /** Altura total do molde planificado, em mm. */
  heightMM: number;
  paths: DielinePath[];
  panels: DielinePanel[];
  /** Dimensões da caixa montada (para o visualizador 3D), quando aplicável. */
  box3D?: { width: number; height: number; depth: number };
}

/* --------------------------- Folha de impressão --------------------------- */

export type SheetSizeId = "A4" | "Carta" | "A3";
export type BleedSize = 0 | 3 | 5;

export interface SheetSize {
  id: SheetSizeId;
  label: string;
  width: number; // mm
  height: number; // mm
}

/* -------------------------------- IA / Gemini ----------------------------- */

export interface PaletteColor {
  name: string;
  hex: string;
  cmyk: string;
}

export interface AiAnalysisResult {
  theme: string;
  description: string;
  palette: PaletteColor[];
  graphicElements: string[];
  suggestedPrompt: string;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

/* --------------------------- Estado de exportação ------------------------- */

export type ExportFormat = "png" | "pdf" | "svg" | "dxf" | "foil";

export interface PrintSettings {
  sheet: SheetSizeId;
  bleed: BleedSize;
  showRegistrationMarks: boolean;
  showDieline: boolean;
}
