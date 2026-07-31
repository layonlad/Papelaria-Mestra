import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Palette, Sparkles, X } from "lucide-react";
import { generateProceduralPattern } from "../utils/artLayerRenderer";

/* ---------------------------------------------------------------------------
   SilhouetteGeneratorModal — gera estampas/padrões contínuos via Gemini (Imagen).
   Em caso de indisponibilidade do modelo de imagem, cai num gerador procedural.
--------------------------------------------------------------------------- */

type Motif = "confetti" | "dots" | "leaves" | "waves";

interface SilhouetteGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  initialPrompt?: string;
  onGenerated: (url: string, name: string) => void;
}

const MOTIFS: { value: Motif; label: string }[] = [
  { value: "confetti", label: "Confete" },
  { value: "dots", label: "Poás" },
  { value: "leaves", label: "Folhas" },
  { value: "waves", label: "Ondas" },
];

export default function SilhouetteGeneratorModal({
  open,
  onClose,
  initialPrompt,
  onGenerated,
}: SilhouetteGeneratorModalProps) {
  const [prompt, setPrompt] = useState("");
  const [seamless, setSeamless] = useState(true);
  const [motif, setMotif] = useState<Motif>("confetti");
  const [colors, setColors] = useState("#89A47E, #D97724, #5A5A40, #FCFAF7");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialPrompt) setPrompt(initialPrompt);
  }, [open, initialPrompt]);

  const parseColors = () =>
    colors
      .split(",")
      .map((c) => c.trim())
      .filter((c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c));

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/gemini/generate-pattern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, seamless }),
      });
      const data = await res.json();
      if (data.image) {
        setPreview(data.image);
      } else {
        // Fallback procedural quando o modelo de imagem não está disponível.
        const proc = generateProceduralPattern(parseColors(), 512, motif);
        setPreview(proc);
        setNotice(
          data.reason
            ? "Modelo de imagem indisponível — gerado padrão procedural local."
            : "Padrão procedural gerado localmente.",
        );
      }
    } catch {
      const proc = generateProceduralPattern(parseColors(), 512, motif);
      setPreview(proc);
      setNotice("Sem conexão com a IA — gerado padrão procedural local.");
    } finally {
      setLoading(false);
    }
  };

  const generateProcedural = () => {
    setPreview(generateProceduralPattern(parseColors(), 512, motif));
    setNotice("Padrão procedural gerado localmente.");
  };

  const apply = () => {
    if (!preview) return;
    onGenerated(preview, prompt.slice(0, 28) || "Estampa IA");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#3a3a2e]/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#faf6f0] shadow-2xl"
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-[#e6ddd0] px-5 py-4">
              <h2 className="flex items-center gap-2 font-[var(--font-title)] text-lg text-[#5a5a40]">
                <Sparkles size={18} /> Gerador de Estampas
              </h2>
              <button onClick={onClose} className="rounded-full p-1 text-[#5a5a40] hover:bg-[#efe9df]">
                <X size={18} />
              </button>
            </header>

            <div className="grid flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-2">
              <div className="space-y-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-[#5a5a40]">
                  Descrição da estampa
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    placeholder="Ex.: padrão de folhagens tropicais em tons pastéis, estilo aquarela"
                    className="rounded-lg border border-[#e6ddd0] bg-white p-2 text-sm"
                  />
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-[#5a5a40]">
                  <input type="checkbox" checked={seamless} onChange={(e) => setSeamless(e.target.checked)} />
                  Padrão contínuo (seamless)
                </label>

                <label className="flex flex-col gap-1 text-xs font-medium text-[#5a5a40]">
                  Cores base (fallback procedural)
                  <input
                    value={colors}
                    onChange={(e) => setColors(e.target.value)}
                    className="rounded-lg border border-[#e6ddd0] bg-white p-2 font-mono text-xs"
                  />
                </label>

                <div className="flex flex-col gap-1 text-xs font-medium text-[#5a5a40]">
                  Motivo procedural
                  <div className="flex flex-wrap gap-1.5">
                    {MOTIFS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMotif(m.value)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          motif === m.value ? "border-[#d97724] bg-[#d97724] text-white" : "border-[#e6ddd0] text-[#5a5a40]"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!prompt.trim() || loading}
                    onClick={generate}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#d97724] px-3 py-2 text-sm font-semibold text-white hover:bg-[#c1651b] disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    IA
                  </button>
                  <button
                    type="button"
                    onClick={generateProcedural}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#89a47e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#748d69]"
                  >
                    <Palette size={16} /> Procedural
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-[#e6ddd0] bg-[#fcfaf7]">
                  {preview ? (
                    <img src={preview} alt="Prévia da estampa" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-[#8a8a6e]">A prévia aparecerá aqui</span>
                  )}
                </div>
                {notice && <p className="text-xs text-[#8a8a6e]">{notice}</p>}
                <button
                  type="button"
                  disabled={!preview}
                  onClick={apply}
                  className="rounded-lg bg-[#5a5a40] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4a4a34] disabled:opacity-50"
                >
                  Adicionar como camada
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
