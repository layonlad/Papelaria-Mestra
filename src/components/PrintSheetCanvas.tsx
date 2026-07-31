import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ArtLayer, DielineTemplate, PrintSettings, TextLayer } from "../types";
import {
  bestFit,
  bleedRect,
  SHEET_SIZES,
  type FitResult,
} from "../data/silhouetteGeometry";
import { loadImage, renderArtLayers } from "../utils/artLayerRenderer";
import DielineCanvas from "./DielineCanvas";

/* ---------------------------------------------------------------------------
   PrintSheetCanvas — pré-visualização central da folha de corte (A4/Carta/A3):
   papel, sangria, marcas de registro, camadas de arte (blend + fade via CSS),
   camadas de texto e o molde por cima. Expõe um handle imperativo para
   compor a arte em alta resolução (usado pelos exportadores).
--------------------------------------------------------------------------- */

const PX_PER_MM_96 = 96 / 25.4;
const PAPER_COLOR = "#fcfaf7";

export interface CompositeOptions {
  dpi: number;
  includeDieline: boolean;
  /** Apenas arte + texto, sem papel de fundo (para máscara de foil/UV). */
  artOnly?: boolean;
}

export interface PrintSheetHandle {
  renderComposite(opts: CompositeOptions): Promise<HTMLCanvasElement>;
}

interface PrintSheetCanvasProps {
  template: DielineTemplate;
  settings: PrintSettings;
  artLayers: ArtLayer[];
  textLayers: TextLayer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDragArt: (id: string, xMM: number, yMM: number) => void;
  onDragText: (id: string, xMM: number, yMM: number) => void;
}

function fadeMask(layer: ArtLayer): string | undefined {
  if (layer.fadeEdge === "none" || layer.fadeAmount <= 0) return undefined;
  const a = Math.min(1, layer.fadeAmount / 100);
  switch (layer.fadeEdge) {
    case "radial":
      return `radial-gradient(circle at center, #000 ${Math.round((1 - a) * 100)}%, transparent 100%)`;
    case "vignette":
      return `radial-gradient(circle at center, #000 ${Math.round((1 - a * 0.92) * 100)}%, transparent 100%)`;
    case "linear-top":
      return `linear-gradient(to bottom, transparent 0%, #000 ${Math.round(a * 100)}%)`;
    case "linear-bottom":
      return `linear-gradient(to top, transparent 0%, #000 ${Math.round(a * 100)}%)`;
    case "linear-left":
      return `linear-gradient(to right, transparent 0%, #000 ${Math.round(a * 100)}%)`;
    case "linear-right":
      return `linear-gradient(to left, transparent 0%, #000 ${Math.round(a * 100)}%)`;
    default:
      return undefined;
  }
}

const PrintSheetCanvas = forwardRef<PrintSheetHandle, PrintSheetCanvasProps>(function PrintSheetCanvas(
  { template, settings, artLayers, textLayers, selectedId, onSelect, onDragArt, onDragText },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  const [naturalSizes, setNaturalSizes] = useState<Record<string, { w: number; h: number }>>({});
  const dragState = useRef<{ id: string; kind: "art" | "text"; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const sheet = SHEET_SIZES[settings.sheet];

  // Mede o espaço disponível para escalar a folha.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setBox({ w: rect.width, h: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Pré-carrega tamanhos naturais das imagens de arte.
  useEffect(() => {
    let cancelled = false;
    for (const layer of artLayers) {
      if (naturalSizes[layer.url]) continue;
      loadImage(layer.url)
        .then((img) => {
          if (!cancelled) {
            setNaturalSizes((prev) => ({ ...prev, [layer.url]: { w: img.naturalWidth, h: img.naturalHeight } }));
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [artLayers, naturalSizes]);

  const pad = 24;
  const pxPerMm = Math.max(
    0.5,
    Math.min((box.w - pad) / sheet.width, (box.h - pad) / sheet.height),
  );
  const sheetW = sheet.width * pxPerMm;
  const sheetH = sheet.height * pxPerMm;
  const fit: FitResult = bestFit(template, settings.sheet, settings.bleed);
  const bleed = bleedRect(fit, settings.bleed);

  const layerDrawSize = useCallback(
    (layer: ArtLayer): { w: number; h: number } => {
      const nat = naturalSizes[layer.url] ?? { w: 300, h: 300 };
      const factor = (layer.scale / 100) * (pxPerMm / PX_PER_MM_96);
      return { w: nat.w * factor, h: nat.h * factor };
    },
    [naturalSizes, pxPerMm],
  );

  /* ------------------------------- Drag ---------------------------------- */

  const onPointerDown = (
    e: ReactPointerEvent,
    id: string,
    kind: "art" | "text",
    origX: number,
    origY: number,
  ) => {
    e.stopPropagation();
    onSelect(id);
    dragState.current = { id, kind, startX: e.clientX, startY: e.clientY, origX, origY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const st = dragState.current;
    if (!st) return;
    const dxMM = (e.clientX - st.startX) / pxPerMm;
    const dyMM = (e.clientY - st.startY) / pxPerMm;
    if (st.kind === "art") onDragArt(st.id, st.origX + dxMM, st.origY + dyMM);
    else onDragText(st.id, st.origX + dxMM, st.origY + dyMM);
  };

  const onPointerUp = () => {
    dragState.current = null;
  };

  /* ------------------------- Composição p/ export ------------------------ */

  const renderComposite = useCallback(
    async (opts: CompositeOptions): Promise<HTMLCanvasElement> => {
      const dpiPxPerMm = opts.dpi / 25.4;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sheet.width * dpiPxPerMm);
      canvas.height = Math.round(sheet.height * dpiPxPerMm);
      const ctx = canvas.getContext("2d");
      if (!ctx) return canvas;

      if (!opts.artOnly) {
        ctx.fillStyle = PAPER_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Camadas de arte (posições em mm da folha).
      const artCanvas = await renderArtLayers(artLayers, {
        widthPx: canvas.width,
        heightPx: canvas.height,
        pxPerMm: dpiPxPerMm,
      });
      ctx.drawImage(artCanvas, 0, 0);

      // Texto.
      await document.fonts.ready;
      for (const t of textLayers) {
        if (!t.text) continue;
        ctx.save();
        ctx.translate(t.x * dpiPxPerMm, t.y * dpiPxPerMm);
        ctx.rotate((t.rotation * Math.PI) / 180);
        const weight = t.bold ? "700" : "400";
        const stylePart = t.italic ? "italic " : "";
        ctx.font = `${stylePart}${weight} ${t.fontSize * dpiPxPerMm}px "${t.fontFamily}", sans-serif`;
        ctx.textBaseline = "top";
        if (t.stroke) {
          ctx.lineJoin = "round";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = Math.max(1, t.strokeWidth * dpiPxPerMm);
          ctx.strokeText(t.text, 0, 0);
        }
        ctx.fillStyle = t.fill;
        ctx.fillText(t.text, 0, 0);
        ctx.restore();
      }

      // Molde (opcional).
      if (opts.includeDieline) {
        ctx.save();
        ctx.translate(fit.offset.x * dpiPxPerMm, fit.offset.y * dpiPxPerMm);
        const s = fit.scale * dpiPxPerMm;
        ctx.scale(s, s);
        for (const path of template.paths) {
          const colors: Record<string, string> = {
            cut: "#c0392b",
            crease: "#2563eb",
            perforation: "#7c3aed",
            bleed: "#f5a623",
            glue: "#4f9d3a",
          };
          ctx.strokeStyle = colors[path.type] ?? "#333";
          ctx.lineWidth = 0.4 / s * dpiPxPerMm;
          ctx.setLineDash(path.type === "crease" ? [2, 1.5] : path.type === "perforation" ? [1, 1.2] : []);
          try {
            ctx.stroke(new Path2D(path.d));
          } catch {
            /* path inválido ignorado */
          }
        }
        ctx.restore();
      }

      return canvas;
    },
    [artLayers, textLayers, template, fit, sheet.width, sheet.height],
  );

  useImperativeHandle(ref, () => ({ renderComposite }), [renderComposite]);

  /* ------------------------------- Render -------------------------------- */

  const sheetStyle: CSSProperties = {
    width: sheetW,
    height: sheetH,
    backgroundColor: PAPER_COLOR,
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-dots p-4"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerDown={() => onSelect(null)}
    >
      <div
        className="relative shadow-[0_10px_40px_-12px_rgba(90,90,64,0.45)] ring-1 ring-[#e6ddd0]"
        style={sheetStyle}
      >
        {/* Sangria */}
        {settings.bleed > 0 && (
          <div
            className="pointer-events-none absolute border border-dashed border-[#f5a623]"
            style={{
              left: bleed.x * pxPerMm,
              top: bleed.y * pxPerMm,
              width: bleed.width * pxPerMm,
              height: bleed.height * pxPerMm,
            }}
          />
        )}

        {/* Camadas de arte */}
        {[...artLayers]
          .filter((l) => l.visible && l.opacity > 0)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((layer) => {
            const size = layerDrawSize(layer);
            const mask = fadeMask(layer);
            const style: CSSProperties = {
              position: "absolute",
              left: layer.x * pxPerMm,
              top: layer.y * pxPerMm,
              width: size.w,
              height: size.h,
              opacity: layer.opacity,
              mixBlendMode: layer.blendMode === "normal" ? "normal" : (layer.blendMode as CSSProperties["mixBlendMode"]),
              transform: `rotate(${layer.rotation}deg) scaleX(${layer.flipH ? -1 : 1})`,
              transformOrigin: "center",
              backgroundImage: `url(${layer.url})`,
              backgroundSize: "100% 100%",
              cursor: "grab",
              outline: selectedId === layer.id ? "2px solid #d97724" : "none",
              ...(mask ? { WebkitMaskImage: mask, maskImage: mask } : {}),
            };
            return (
              <div
                key={layer.id}
                style={style}
                onPointerDown={(e) => onPointerDown(e, layer.id, "art", layer.x, layer.y)}
              />
            );
          })}

        {/* Molde estrutural */}
        {settings.showDieline && (
          <DielineCanvas
            template={template}
            style={{
              position: "absolute",
              left: fit.offset.x * pxPerMm,
              top: fit.offset.y * pxPerMm,
              width: template.widthMM * fit.scale * pxPerMm,
              height: template.heightMM * fit.scale * pxPerMm,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Camadas de texto */}
        {textLayers.map((t) => {
          const style: CSSProperties = {
            position: "absolute",
            left: t.x * pxPerMm,
            top: t.y * pxPerMm,
            transform: `rotate(${t.rotation}deg)`,
            transformOrigin: "left top",
            fontFamily: `"${t.fontFamily}", sans-serif`,
            fontSize: t.fontSize * pxPerMm,
            fontWeight: t.bold ? 700 : 400,
            fontStyle: t.italic ? "italic" : "normal",
            color: t.fill,
            whiteSpace: "nowrap",
            lineHeight: 1,
            cursor: "grab",
            userSelect: "none",
            paintOrder: "stroke",
            WebkitTextStroke: t.stroke ? `${Math.max(1, t.strokeWidth * pxPerMm)}px #fff` : undefined,
            outline: selectedId === t.id ? "2px solid #d97724" : "none",
          } as CSSProperties;
          return (
            <div key={t.id} style={style} onPointerDown={(e) => onPointerDown(e, t.id, "text", t.x, t.y)}>
              {t.text || "Texto"}
            </div>
          );
        })}

        {/* Marcas de registro (crop marks nos cantos) */}
        {settings.showRegistrationMarks && (
          <svg className="pointer-events-none absolute inset-0" width={sheetW} height={sheetH}>
            {[
              [0, 0, 1, 1],
              [sheetW, 0, -1, 1],
              [0, sheetH, 1, -1],
              [sheetW, sheetH, -1, -1],
            ].map(([x, y, sx, sy], idx) => (
              <g key={idx} stroke="#5a5a40" strokeWidth={1}>
                <line x1={x} y1={y} x2={x! + sx! * 14} y2={y} />
                <line x1={x} y1={y} x2={x} y2={y! + sy! * 14} />
              </g>
            ))}
          </svg>
        )}
      </div>

      {/* Rótulo da folha */}
      <div className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-[#5a5a40]/85 px-3 py-1 text-xs font-medium text-[#faf6f0]">
        {sheet.label} · {template.name} · {Math.round(fit.scale * 100)}%
      </div>
    </div>
  );
});

export default PrintSheetCanvas;
