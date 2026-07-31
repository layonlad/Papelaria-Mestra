import type {
  DielinePanel,
  DielinePath,
  DielineTemplate,
} from "../types";

/* ---------------------------------------------------------------------------
   Papelaria Mestra — Catálogo de moldes estruturais (dielines).
   Todas as coordenadas são em milímetros, origem no canto superior esquerdo.
   Geradores paramétricos produzem os traçados de corte (cut), vinco (crease),
   picote (perforation) e abas de cola (glue).
--------------------------------------------------------------------------- */

interface DielineGeometry {
  widthMM: number;
  heightMM: number;
  paths: DielinePath[];
  panels: DielinePanel[];
  box3D?: { width: number; height: number; depth: number };
}

/* ------------------------------- Helpers ---------------------------------- */

const f = (n: number): string => Number(n.toFixed(2)).toString();

function rect(x: number, y: number, w: number, h: number): string {
  return `M ${f(x)} ${f(y)} L ${f(x + w)} ${f(y)} L ${f(x + w)} ${f(y + h)} L ${f(x)} ${f(y + h)} Z`;
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)}`;
}

/**
 * Caixa com fechamento tipo "tuck end" (tampa e fundo com abas).
 * Cinta de 4 painéis (esquerda, frente, direita, trás) + tampa/fundo sob a frente.
 */
function tuckBox(W: number, D: number, H: number, glue = 12, tuck = 14): DielineGeometry {
  const beltW = 2 * W + 2 * D;
  const y1 = tuck;
  const y2 = tuck + D;
  const y3 = tuck + D + H;
  const y4 = y3 + D;
  const y5 = y4 + tuck;

  const xLeft = 0;
  const xFront = D;
  const xRight = D + W;
  const xBack = 2 * D + W;

  const cut: string[] = [];
  // Silhueta externa (sentido horário a partir do topo da coluna da tampa).
  cut.push(
    [
      `M ${f(xFront)} ${f(0)}`,
      `L ${f(xRight)} ${f(0)}`,
      `L ${f(xRight)} ${f(y2)}`,
      `L ${f(beltW)} ${f(y2)}`,
      `L ${f(beltW)} ${f(y3)}`,
      `L ${f(xRight)} ${f(y3)}`,
      `L ${f(xRight)} ${f(y5)}`,
      `L ${f(xFront)} ${f(y5)}`,
      `L ${f(xFront)} ${f(y3)}`,
      `L ${f(xLeft)} ${f(y3)}`,
      `L ${f(xLeft)} ${f(y2)}`,
      `L ${f(xFront)} ${f(y2)}`,
      "Z",
    ].join(" "),
  );
  // Aba de cola à direita da traseira.
  cut.push(
    `M ${f(beltW)} ${f(y2 + 3)} L ${f(beltW + glue)} ${f(y2 + 6)} L ${f(beltW + glue)} ${f(y3 - 6)} L ${f(beltW)} ${f(y3 - 3)}`,
  );

  const cuts: DielinePath[] = cut.map((d) => ({ type: "cut", d }));

  const creases: DielinePath[] = [
    { type: "crease", d: line(xFront, y1, xRight, y1) }, // tampa | aba superior
    { type: "crease", d: line(xFront, y2, xRight, y2) }, // tampa | frente
    { type: "crease", d: line(xFront, y3, xRight, y3) }, // frente | fundo
    { type: "crease", d: line(xFront, y4, xRight, y4) }, // fundo | aba inferior
    { type: "crease", d: line(xFront, y2, xFront, y3) }, // esquerda | frente
    { type: "crease", d: line(xRight, y2, xRight, y3) }, // frente | direita
    { type: "crease", d: line(xBack, y2, xBack, y3) }, // direita | trás
    { type: "glue", d: line(beltW, y2, beltW, y3) }, // trás | aba de cola
  ];

  const panels: DielinePanel[] = [
    { id: "front", name: "Frente", x: xFront, y: y2, width: W, height: H, isFront: true, role: "front" },
    { id: "back", name: "Trás", x: xBack, y: y2, width: W, height: H, role: "back" },
    { id: "left", name: "Esquerda", x: xLeft, y: y2, width: D, height: H, role: "left" },
    { id: "right", name: "Direita", x: xRight, y: y2, width: D, height: H, role: "right" },
    { id: "top", name: "Tampa", x: xFront, y: y1, width: W, height: D, role: "top" },
    { id: "bottom", name: "Fundo", x: xFront, y: y3, width: W, height: D, role: "bottom" },
  ];

  return {
    widthMM: beltW + glue,
    heightMM: y5,
    paths: [...cuts, ...creases],
    panels,
    box3D: { width: W, height: H, depth: D },
  };
}

/** Luva / cinta que envolve uma caixa (4 painéis + aba de cola, sem tampa). */
function sleeve(W: number, D: number, H: number, glue = 15): DielineGeometry {
  const beltW = 2 * W + 2 * D;
  const paths: DielinePath[] = [
    { type: "cut", d: rect(0, 0, beltW, H) },
    { type: "cut", d: rect(beltW, 6, glue, H - 12) },
    { type: "crease", d: line(D, 0, D, H) },
    { type: "crease", d: line(D + W, 0, D + W, H) },
    { type: "crease", d: line(2 * D + W, 0, 2 * D + W, H) },
    { type: "glue", d: line(beltW, 0, beltW, H) },
  ];
  const panels: DielinePanel[] = [
    { id: "front", name: "Frente", x: D, y: 0, width: W, height: H, isFront: true, role: "front" },
    { id: "left", name: "Esquerda", x: 0, y: 0, width: D, height: H, role: "left" },
    { id: "right", name: "Direita", x: D + W, y: 0, width: D, height: H, role: "right" },
    { id: "back", name: "Trás", x: 2 * D + W, y: 0, width: W, height: H, role: "back" },
  ];
  return { widthMM: beltW + glue, heightMM: H, paths, panels, box3D: { width: W, height: H, depth: D } };
}

/** Caixa travesseiro (pillow box) — corpo com 3 vincos e abas curvas nas pontas. */
function pillowBox(W: number, H: number, curve = 22): DielineGeometry {
  const totalH = H + 2 * curve;
  const q = W / 4;
  const paths: DielinePath[] = [
    // Contorno com pontas curvas (arcos quadráticos).
    {
      type: "cut",
      d: [
        `M ${f(0)} ${f(curve)}`,
        `Q ${f(0)} ${f(0)} ${f(q)} ${f(0)}`,
        `L ${f(W - q)} ${f(0)}`,
        `Q ${f(W)} ${f(0)} ${f(W)} ${f(curve)}`,
        `L ${f(W)} ${f(curve + H)}`,
        `Q ${f(W)} ${f(totalH)} ${f(W - q)} ${f(totalH)}`,
        `L ${f(q)} ${f(totalH)}`,
        `Q ${f(0)} ${f(totalH)} ${f(0)} ${f(curve + H)}`,
        "Z",
      ].join(" "),
    },
    { type: "crease", d: line(W / 4, curve, W / 4, curve + H) },
    { type: "crease", d: line(W / 2, curve, W / 2, curve + H) },
    { type: "crease", d: line((3 * W) / 4, curve, (3 * W) / 4, curve + H) },
    // Vincos curvos das pontas (picote de dobra).
    { type: "perforation", d: `M ${f(0)} ${f(curve)} Q ${f(W / 2)} ${f(curve * 1.6)} ${f(W)} ${f(curve)}` },
    { type: "perforation", d: `M ${f(0)} ${f(curve + H)} Q ${f(W / 2)} ${f(curve + H - curve * 0.6)} ${f(W)} ${f(curve + H)}` },
  ];
  const panels: DielinePanel[] = [
    { id: "front", name: "Frente", x: 0, y: curve, width: W / 2, height: H, isFront: true, role: "front" },
    { id: "back", name: "Trás", x: W / 2, y: curve, width: W / 2, height: H, role: "back" },
  ];
  return { widthMM: W, heightMM: totalH, paths, panels };
}

/** Envelope / convite quadrado com 4 abas triangulares. */
function envelope(side: number, flap = 30): DielineGeometry {
  const total = side + 2 * flap;
  const cx = flap;
  const cy = flap;
  const paths: DielinePath[] = [
    {
      type: "cut",
      d: [
        `M ${f(cx)} ${f(0)}`, // topo da aba superior (ponta)
        `L ${f(cx + side / 2)} ${f(cy - flap * 0.0)}`,
        `M ${f(cx + side / 2)} ${f(0)}`,
        "",
      ].join(" "),
    },
  ];
  // Recompõe como octógono de abas: definimos o quadrado central e 4 triângulos.
  const x0 = flap;
  const y0 = flap;
  const x1 = flap + side;
  const y1 = flap + side;
  const outline = [
    `M ${f(x0)} ${f(y0)}`,
    `L ${f((x0 + x1) / 2)} ${f(0)}`, // ponta superior
    `L ${f(x1)} ${f(y0)}`,
    `L ${f(total)} ${f((y0 + y1) / 2)}`, // ponta direita
    `L ${f(x1)} ${f(y1)}`,
    `L ${f((x0 + x1) / 2)} ${f(total)}`, // ponta inferior
    `L ${f(x0)} ${f(y1)}`,
    `L ${f(0)} ${f((y0 + y1) / 2)}`, // ponta esquerda
    "Z",
  ].join(" ");
  paths.length = 0;
  paths.push({ type: "cut", d: outline });
  paths.push({ type: "crease", d: rect(x0, y0, side, side) });
  const panels: DielinePanel[] = [
    { id: "front", name: "Face", x: x0, y: y0, width: side, height: side, isFront: true, role: "front" },
  ];
  return { widthMM: total, heightMM: total, paths, panels };
}

/** Convite em painéis dobráveis (trifold, sanfona, etc.). */
function foldCard(panelW: number, H: number, panels: number): DielineGeometry {
  const total = panelW * panels;
  const paths: DielinePath[] = [{ type: "cut", d: rect(0, 0, total, H) }];
  const dielinePanels: DielinePanel[] = [];
  for (let i = 1; i < panels; i++) {
    paths.push({ type: "crease", d: line(panelW * i, 0, panelW * i, H) });
  }
  for (let i = 0; i < panels; i++) {
    dielinePanels.push({
      id: `panel-${i}`,
      name: `Painel ${i + 1}`,
      x: panelW * i,
      y: 0,
      width: panelW,
      height: H,
      isFront: i === 0,
      role: i === 0 ? "front" : "flap",
    });
  }
  return { widthMM: total, heightMM: H, paths, panels: dielinePanels };
}

/** Capa de caderno com lombada (spine) central. */
function notebookCover(coverW: number, coverH: number, spine: number): DielineGeometry {
  const total = coverW * 2 + spine;
  const paths: DielinePath[] = [
    { type: "cut", d: rect(0, 0, total, coverH) },
    { type: "crease", d: line(coverW, 0, coverW, coverH) },
    { type: "crease", d: line(coverW + spine, 0, coverW + spine, coverH) },
    // Guia de furação para espiral (picote).
    { type: "perforation", d: line(coverW + spine / 2, 6, coverW + spine / 2, coverH - 6) },
  ];
  const panels: DielinePanel[] = [
    { id: "front", name: "Capa", x: coverW + spine, y: 0, width: coverW, height: coverH, isFront: true, role: "front" },
    { id: "back", name: "Contracapa", x: 0, y: 0, width: coverW, height: coverH, role: "back" },
    { id: "spine", name: "Lombada", x: coverW, y: 0, width: spine, height: coverH, role: "left" },
  ];
  return { widthMM: total, heightMM: coverH, paths, panels };
}

/** Caixa pirâmide — base quadrada com 4 triângulos e abas de cola. */
function pyramidBox(base: number, faceH: number): DielineGeometry {
  const total = base + 2 * faceH;
  const x0 = faceH;
  const y0 = faceH;
  const x1 = faceH + base;
  const y1 = faceH + base;
  const apex = faceH * 1.15;
  const outline = [
    `M ${f(x0)} ${f(y0)}`,
    `L ${f((x0 + x1) / 2)} ${f(y0 - apex)}`,
    `L ${f(x1)} ${f(y0)}`,
    `L ${f(x1 + apex)} ${f((y0 + y1) / 2)}`,
    `L ${f(x1)} ${f(y1)}`,
    `L ${f((x0 + x1) / 2)} ${f(y1 + apex)}`,
    `L ${f(x0)} ${f(y1)}`,
    `L ${f(x0 - apex)} ${f((y0 + y1) / 2)}`,
    "Z",
  ].join(" ");
  const paths: DielinePath[] = [
    { type: "cut", d: outline },
    { type: "crease", d: rect(x0, y0, base, base) },
  ];
  const panels: DielinePanel[] = [
    { id: "front", name: "Base", x: x0, y: y0, width: base, height: base, isFront: true, role: "front" },
  ];
  return { widthMM: total, heightMM: total, paths, panels };
}

/** Cone para guloseimas — setor circular (aproximado por arco). */
function cone(radius: number, spread = 150): DielineGeometry {
  const cx = radius;
  const cy = radius;
  const a0 = (-90 - spread / 2) * (Math.PI / 180);
  const a1 = (-90 + spread / 2) * (Math.PI / 180);
  const p0 = { x: cx + radius * Math.cos(a0), y: cy + radius * Math.sin(a0) };
  const p1 = { x: cx + radius * Math.cos(a1), y: cy + radius * Math.sin(a1) };
  const largeArc = spread > 180 ? 1 : 0;
  const paths: DielinePath[] = [
    {
      type: "cut",
      d: [
        `M ${f(cx)} ${f(cy)}`,
        `L ${f(p0.x)} ${f(p0.y)}`,
        `A ${f(radius)} ${f(radius)} 0 ${largeArc} 1 ${f(p1.x)} ${f(p1.y)}`,
        "Z",
      ].join(" "),
    },
    { type: "glue", d: line(cx, cy, p0.x, p0.y) },
  ];
  const panels: DielinePanel[] = [
    { id: "front", name: "Corpo", x: 0, y: 0, width: radius * 2, height: radius, isFront: true, role: "front" },
  ];
  return { widthMM: radius * 2, heightMM: radius + 4, paths, panels };
}

/** Sacola de presente — cinta de 4 painéis com fundo e abas de fundo. */
function giftBag(W: number, D: number, H: number, glue = 15, bottom = 25): DielineGeometry {
  const beltW = 2 * W + 2 * D;
  const totalH = H + bottom;
  const paths: DielinePath[] = [
    { type: "cut", d: rect(0, 0, beltW, H) },
    { type: "cut", d: rect(beltW, 8, glue, H - 16) },
    // Abas de fundo por painel.
    { type: "cut", d: rect(0, H, beltW, bottom) },
    { type: "crease", d: line(0, H, beltW, H) },
    { type: "crease", d: line(D, 0, D, totalH) },
    { type: "crease", d: line(D + W, 0, D + W, totalH) },
    { type: "crease", d: line(2 * D + W, 0, 2 * D + W, totalH) },
    { type: "glue", d: line(beltW, 0, beltW, H) },
    // Alças (picote/furos indicativos).
    { type: "perforation", d: line(D + W * 0.3, 8, D + W * 0.7, 8) },
    { type: "perforation", d: line(2 * D + W + W * 0.3, 8, 2 * D + W + W * 0.7, 8) },
  ];
  const panels: DielinePanel[] = [
    { id: "front", name: "Frente", x: D, y: 0, width: W, height: H, isFront: true, role: "front" },
    { id: "left", name: "Esquerda", x: 0, y: 0, width: D, height: H, role: "left" },
    { id: "right", name: "Direita", x: D + W, y: 0, width: D, height: H, role: "right" },
    { id: "back", name: "Trás", x: 2 * D + W, y: 0, width: W, height: H, role: "back" },
  ];
  return { widthMM: beltW + glue, heightMM: totalH, paths, panels, box3D: { width: W, height: H, depth: D } };
}

/** Tag / etiqueta com furo. */
function tag(W: number, H: number, hole = 5): DielineGeometry {
  const r = Math.min(W, H) * 0.12;
  const notch = W * 0.18;
  const paths: DielinePath[] = [
    {
      type: "cut",
      d: [
        `M ${f(notch)} ${f(0)}`,
        `L ${f(W - notch)} ${f(0)}`,
        `L ${f(W)} ${f(notch)}`,
        `L ${f(W)} ${f(H - r)}`,
        `Q ${f(W)} ${f(H)} ${f(W - r)} ${f(H)}`,
        `L ${f(r)} ${f(H)}`,
        `Q ${f(0)} ${f(H)} ${f(0)} ${f(H - r)}`,
        `L ${f(0)} ${f(notch)}`,
        "Z",
      ].join(" "),
    },
    // Furo circular.
    {
      type: "cut",
      d: `M ${f(W / 2 - hole)} ${f(notch * 0.9)} a ${f(hole)} ${f(hole)} 0 1 0 ${f(hole * 2)} 0 a ${f(hole)} ${f(hole)} 0 1 0 ${f(-hole * 2)} 0`,
    },
  ];
  const panels: DielinePanel[] = [
    { id: "front", name: "Face", x: 0, y: 0, width: W, height: H, isFront: true, role: "front" },
  ];
  return { widthMM: W, heightMM: H, paths, panels };
}

/** Base de caixa explosão — quadrado central com 4 paredes rebatíveis. */
function explosionBase(base: number, wall: number): DielineGeometry {
  const total = base + 2 * wall;
  const x0 = wall;
  const y0 = wall;
  const paths: DielinePath[] = [
    {
      type: "cut",
      d: [
        `M ${f(x0)} ${f(0)}`,
        `L ${f(x0 + base)} ${f(0)}`,
        `L ${f(x0 + base)} ${f(y0)}`,
        `L ${f(total)} ${f(y0)}`,
        `L ${f(total)} ${f(y0 + base)}`,
        `L ${f(x0 + base)} ${f(y0 + base)}`,
        `L ${f(x0 + base)} ${f(total)}`,
        `L ${f(x0)} ${f(total)}`,
        `L ${f(x0)} ${f(y0 + base)}`,
        `L ${f(0)} ${f(y0 + base)}`,
        `L ${f(0)} ${f(y0)}`,
        `L ${f(x0)} ${f(y0)}`,
        "Z",
      ].join(" "),
    },
    { type: "crease", d: rect(x0, y0, base, base) },
  ];
  const panels: DielinePanel[] = [
    { id: "front", name: "Base", x: x0, y: y0, width: base, height: base, isFront: true, role: "front" },
  ];
  return { widthMM: total, heightMM: total, paths, panels, box3D: { width: base, height: wall, depth: base } };
}

/* ------------------------- Catálogo de templates -------------------------- */

interface TemplateSeed {
  id: string;
  name: string;
  category: DielineTemplate["category"];
  description: string;
  geometry: DielineGeometry;
}

const SEEDS: TemplateSeed[] = [
  {
    id: "caixa-cubo-60",
    name: "Caixa Cubo 60mm",
    category: "caixa",
    description: "Cubo clássico para lembrancinhas e bem-casados.",
    geometry: tuckBox(60, 60, 60),
  },
  {
    id: "caixa-bombom",
    name: "Caixa Bombom Baixa",
    category: "caixa",
    description: "Retangular baixa, ideal para doces e brigadeiros gourmet.",
    geometry: tuckBox(90, 60, 35),
  },
  {
    id: "caixa-caneca",
    name: "Caixa para Caneca",
    category: "caixa",
    description: "Alta e reforçada para canecas personalizadas de 325ml.",
    geometry: tuckBox(95, 95, 120),
  },
  {
    id: "caixa-milk",
    name: "Caixinha Milk",
    category: "caixa",
    description: "Formato leitinho com topo trapezoidal, um charme nas mesas.",
    geometry: tuckBox(70, 70, 95, 12, 40),
  },
  {
    id: "caixa-berco",
    name: "Caixa Berço Grande",
    category: "caixa",
    description: "Ampla para kits e presentes montados.",
    geometry: tuckBox(150, 100, 60),
  },
  {
    id: "caixa-batom",
    name: "Caixa Batom Slim",
    category: "caixa",
    description: "Estreita e vertical para cosméticos e mimos alongados.",
    geometry: tuckBox(28, 28, 90),
  },
  {
    id: "travesseiro-p",
    name: "Caixa Travesseiro P",
    category: "embalagem",
    description: "Pillow box pequena para bijuterias e doces finos.",
    geometry: pillowBox(120, 70),
  },
  {
    id: "travesseiro-g",
    name: "Caixa Travesseiro G",
    category: "embalagem",
    description: "Pillow box grande para lenços, meias e presentes leves.",
    geometry: pillowBox(180, 110, 30),
  },
  {
    id: "luva-caixa",
    name: "Luva / Cinta de Caixa",
    category: "embalagem",
    description: "Cinta envolvente para vestir caixas neutras com sua arte.",
    geometry: sleeve(100, 100, 40),
  },
  {
    id: "envelope-quadrado",
    name: "Envelope Convite Quadrado",
    category: "convite",
    description: "Envelope com abas triangulares para convites 150x150mm.",
    geometry: envelope(150, 45),
  },
  {
    id: "convite-trifold",
    name: "Convite Trifold",
    category: "convite",
    description: "Três painéis dobráveis para convites detalhados.",
    geometry: foldCard(99, 210, 3),
  },
  {
    id: "convite-sanfona",
    name: "Cardápio Sanfona",
    category: "convite",
    description: "Quatro painéis em acordeão para cardápios e programações.",
    geometry: foldCard(105, 148, 4),
  },
  {
    id: "convite-simples",
    name: "Convite Dobra Única",
    category: "convite",
    description: "Cartão A6 com dobra central, o mais versátil.",
    geometry: foldCard(105, 148, 2),
  },
  {
    id: "caderno-a5",
    name: "Capa de Caderno A5",
    category: "caderno",
    description: "Capa com lombada e guia de espiral para miolo A5.",
    geometry: notebookCover(148, 210, 12),
  },
  {
    id: "caderno-a6",
    name: "Capa de Caderno A6",
    category: "caderno",
    description: "Bloco de notas A6 com lombada estreita.",
    geometry: notebookCover(105, 148, 8),
  },
  {
    id: "piramide",
    name: "Caixa Pirâmide",
    category: "lembrancinha",
    description: "Fechamento em pirâmide, elegante para lembranças.",
    geometry: pyramidBox(70, 55),
  },
  {
    id: "cone-guloseimas",
    name: "Cone de Guloseimas",
    category: "lembrancinha",
    description: "Cone enrolável para pipoca, algodão-doce e confeitos.",
    geometry: cone(90),
  },
  {
    id: "sacola-p",
    name: "Sacola Presente P",
    category: "embalagem",
    description: "Sacola pequena com alças e fundo reforçado.",
    geometry: giftBag(80, 50, 130),
  },
  {
    id: "sacola-m",
    name: "Sacola Presente M",
    category: "embalagem",
    description: "Sacola média para presentes de médio porte.",
    geometry: giftBag(120, 70, 180),
  },
  {
    id: "tag-furada",
    name: "Tag / Etiqueta",
    category: "lembrancinha",
    description: "Etiqueta com furo para cordão, agradecimentos e preços.",
    geometry: tag(50, 90),
  },
  {
    id: "caixa-explosao",
    name: "Base Caixa Explosão",
    category: "caixa",
    description: "Base rebatível para a clássica caixa explosão de fotos.",
    geometry: explosionBase(150, 60),
  },
];

export const DIELINE_TEMPLATES: DielineTemplate[] = SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  category: seed.category,
  description: seed.description,
  widthMM: seed.geometry.widthMM,
  heightMM: seed.geometry.heightMM,
  paths: seed.geometry.paths,
  panels: seed.geometry.panels,
  ...(seed.geometry.box3D ? { box3D: seed.geometry.box3D } : {}),
}));

export const CATEGORY_LABELS: Record<DielineTemplate["category"], string> = {
  caixa: "Caixas",
  caderno: "Cadernos",
  embalagem: "Embalagens",
  convite: "Convites",
  lembrancinha: "Lembrancinhas",
};

export function getTemplateById(id: string): DielineTemplate | undefined {
  return DIELINE_TEMPLATES.find((t) => t.id === id);
}
