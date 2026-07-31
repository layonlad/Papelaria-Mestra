import { useRef, type ChangeEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  FlipHorizontal2,
  ImagePlus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ArtLayer, BlendMode, FadeEdge } from "../types";

/* ---------------------------------------------------------------------------
   ArtLayersPanel — gestão de múltiplas camadas de arte:
   opacidade, mesclagem (blend), esmaecimento de borda, escala, rotação, flip.
--------------------------------------------------------------------------- */

const BLEND_MODES: BlendMode[] = ["normal", "multiply", "screen", "overlay", "darken", "lighten"];
const FADE_EDGES: { value: FadeEdge; label: string }[] = [
  { value: "none", label: "Nenhum" },
  { value: "radial", label: "Radial" },
  { value: "vignette", label: "Vinheta" },
  { value: "linear-top", label: "Topo" },
  { value: "linear-bottom", label: "Base" },
  { value: "linear-left", label: "Esquerda" },
  { value: "linear-right", label: "Direita" },
];

interface ArtLayersPanelProps {
  layers: ArtLayer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<ArtLayer>) => void;
  onAddImage: (url: string, name: string) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  onOpenGenerator: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-[#5a5a40]">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function ArtLayersPanel({
  layers,
  selectedId,
  onSelect,
  onUpdate,
  onAddImage,
  onRemove,
  onReorder,
  onOpenGenerator,
}: ArtLayersPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") onAddImage(reader.result, file.name.replace(/\.[^.]+$/, ""));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const ordered = [...layers].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#5a5a40] px-3 py-2 text-sm font-semibold text-[#faf6f0] transition hover:bg-[#4a4a34]"
        >
          <ImagePlus size={16} /> Adicionar
        </button>
        <button
          type="button"
          onClick={onOpenGenerator}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#89a47e] px-3 py-2 text-sm font-semibold text-[#faf6f0] transition hover:bg-[#748d69]"
        >
          <Sparkles size={16} /> Gerar IA
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
      </div>

      {ordered.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#e6ddd0] p-4 text-center text-xs text-[#8a8a6e]">
          Nenhuma camada ainda. Adicione uma imagem ou gere uma estampa com IA.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {ordered.map((layer) => {
          const selected = layer.id === selectedId;
          return (
            <div
              key={layer.id}
              className={`rounded-xl border bg-[#fcfaf7] p-2 transition ${
                selected ? "border-[#d97724] shadow-sm" : "border-[#e6ddd0]"
              }`}
            >
              <div className="flex items-center gap-2" onClick={() => onSelect(layer.id)} role="button" tabIndex={0}>
                <div
                  className="h-10 w-10 shrink-0 rounded-md border border-[#e6ddd0] bg-cover bg-center"
                  style={{ backgroundImage: `url(${layer.url})` }}
                />
                <span className="flex-1 truncate text-sm font-medium text-[#3a3a2e]">{layer.name}</span>
                <button
                  type="button"
                  title={layer.visible ? "Ocultar" : "Exibir"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate(layer.id, { visible: !layer.visible });
                  }}
                  className="rounded p-1 text-[#5a5a40] hover:bg-[#efe9df]"
                >
                  {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  type="button"
                  title="Trazer para frente"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder(layer.id, "up");
                  }}
                  className="rounded p-1 text-[#5a5a40] hover:bg-[#efe9df]"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  title="Enviar para trás"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder(layer.id, "down");
                  }}
                  className="rounded p-1 text-[#5a5a40] hover:bg-[#efe9df]"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  title="Remover"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(layer.id);
                  }}
                  className="rounded p-1 text-[#c0392b] hover:bg-[#f6e2df]"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {selected && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label={`Opacidade ${Math.round(layer.opacity * 100)}%`}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(layer.opacity * 100)}
                      onChange={(e) => onUpdate(layer.id, { opacity: Number(e.target.value) / 100 })}
                    />
                  </Field>
                  <Field label={`Escala ${layer.scale}%`}>
                    <input
                      type="range"
                      min={10}
                      max={400}
                      value={layer.scale}
                      onChange={(e) => onUpdate(layer.id, { scale: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label={`Rotação ${layer.rotation}°`}>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={layer.rotation}
                      onChange={(e) => onUpdate(layer.id, { rotation: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label={`Esmaecer ${layer.fadeAmount}%`}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={layer.fadeAmount}
                      onChange={(e) => onUpdate(layer.id, { fadeAmount: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Mesclagem">
                    <select
                      className="rounded-md border border-[#e6ddd0] bg-white px-2 py-1 text-xs"
                      value={layer.blendMode}
                      onChange={(e) => onUpdate(layer.id, { blendMode: e.target.value as BlendMode })}
                    >
                      {BLEND_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Borda">
                    <select
                      className="rounded-md border border-[#e6ddd0] bg-white px-2 py-1 text-xs"
                      value={layer.fadeEdge}
                      onChange={(e) => onUpdate(layer.id, { fadeEdge: e.target.value as FadeEdge })}
                    >
                      {FADE_EDGES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="col-span-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdate(layer.id, { flipH: !layer.flipH })}
                      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                        layer.flipH ? "border-[#d97724] text-[#d97724]" : "border-[#e6ddd0] text-[#5a5a40]"
                      }`}
                    >
                      <FlipHorizontal2 size={14} /> Espelhar
                    </button>
                    <div className="flex items-center gap-1 text-xs text-[#5a5a40]">
                      X
                      <input
                        type="number"
                        value={Math.round(layer.x)}
                        onChange={(e) => onUpdate(layer.id, { x: Number(e.target.value) })}
                        className="w-14 rounded border border-[#e6ddd0] px-1 py-0.5"
                      />
                      Y
                      <input
                        type="number"
                        value={Math.round(layer.y)}
                        onChange={(e) => onUpdate(layer.id, { y: Number(e.target.value) })}
                        className="w-14 rounded border border-[#e6ddd0] px-1 py-0.5"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
