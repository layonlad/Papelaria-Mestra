/* ---------------------------------------------------------------------------
   Papelaria Mestra — Fontes pré-carregadas, categorizadas por estilo.
   As famílias são importadas no index.html via Google Fonts.
--------------------------------------------------------------------------- */

export type FontCategory = "titulo" | "festa" | "corpo";

export interface FontDefinition {
  /** Valor CSS de font-family. */
  family: string;
  /** Nome exibido na interface. */
  label: string;
  category: FontCategory;
  /** Prévia curta usada no seletor. */
  sample: string;
}

export const FONTS: FontDefinition[] = [
  // Títulos e destaques
  { family: "Playfair Display", label: "Playfair Display", category: "titulo", sample: "Elegância" },
  { family: "Bebas Neue", label: "Bebas Neue", category: "titulo", sample: "IMPACTO" },
  { family: "Baloo 2", label: "Baloo 2", category: "titulo", sample: "Suave" },

  // Textos infantis e festas
  { family: "Fredoka", label: "Fredoka", category: "festa", sample: "Alegria" },
  { family: "Chewy", label: "Chewy", category: "festa", sample: "Divertido" },
  { family: "Pacifico", label: "Pacifico", category: "festa", sample: "Festa" },
  { family: "Comfortaa", label: "Comfortaa", category: "festa", sample: "Fofura" },

  // Corpo do texto
  { family: "Plus Jakarta Sans", label: "Plus Jakarta Sans", category: "corpo", sample: "Texto de corpo" },
];

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  titulo: "Títulos & Destaques",
  festa: "Infantil & Festas",
  corpo: "Corpo do Texto",
};

/** Agrupa as fontes por categoria, preservando a ordem de declaração. */
export function fontsByCategory(): Record<FontCategory, FontDefinition[]> {
  return FONTS.reduce(
    (acc, font) => {
      acc[font.category].push(font);
      return acc;
    },
    { titulo: [], festa: [], corpo: [] } as Record<FontCategory, FontDefinition[]>,
  );
}

export const DEFAULT_FONT = FONTS[0]!.family;
