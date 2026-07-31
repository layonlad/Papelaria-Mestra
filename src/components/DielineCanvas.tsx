import type { CSSProperties } from "react";
import type { DielinePath, DielineTemplate } from "../types";

/* ---------------------------------------------------------------------------
   DielineCanvas — desenha o molde estrutural (SVG) com linhas de corte,
   vinco, picote, sangria e abas de cola, em coordenadas mm do molde.
--------------------------------------------------------------------------- */

const STROKE: Record<DielinePath["type"], { color: string; dash?: string }> = {
  cut: { color: "#c0392b" },
  crease: { color: "#2563eb", dash: "2 1.5" },
  perforation: { color: "#7c3aed", dash: "1 1.2" },
  bleed: { color: "#f5a623", dash: "3 2" },
  glue: { color: "#4f9d3a", dash: "1.5 1.5" },
};

interface DielineCanvasProps {
  template: DielineTemplate;
  className?: string;
  style?: CSSProperties;
  strokeWidthMM?: number;
  showPanelHints?: boolean;
}

export default function DielineCanvas({
  template,
  className,
  style,
  strokeWidthMM = 0.4,
  showPanelHints = false,
}: DielineCanvasProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${template.widthMM} ${template.heightMM}`}
      preserveAspectRatio="none"
      fill="none"
    >
      {showPanelHints &&
        template.panels.map((panel) => (
          <rect
            key={panel.id}
            x={panel.x}
            y={panel.y}
            width={panel.width}
            height={panel.height}
            fill={panel.isFront ? "rgba(137,164,126,0.14)" : "rgba(90,90,64,0.05)"}
            stroke="none"
          />
        ))}
      {template.paths.map((path, index) => {
        const spec = STROKE[path.type];
        return (
          <path
            key={`${path.type}-${index}`}
            d={path.d}
            stroke={spec.color}
            strokeWidth={strokeWidthMM}
            strokeDasharray={spec.dash}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
