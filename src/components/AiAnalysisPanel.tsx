import { useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Sparkles, Upload, Wand2, X } from "lucide-react";
import type { AiAnalysisResult } from "../types";

/* ---------------------------------------------------------------------------
   AiAnalysisPanel — envia uma foto de referência ao Gemini Vision e extrai
   tema, paleta (hex + CMYK), elementos gráficos e um prompt técnico.
--------------------------------------------------------------------------- */

interface AiAnalysisPanelProps {
  open: boolean;
  onClose: () => void;
  onUsePrompt: (prompt: string) => void;
  onPickColor: (hex: string) => void;
}

export default function AiAnalysisPanel({ open, onClose, onUsePrompt, onPickColor }: AiAnalysisPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiAnalysisResult | null>(null);

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
        setResult(null);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na análise.");
      setResult(data as AiAnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
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
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[#faf6f0] shadow-2xl"
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-[#e6ddd0] px-5 py-4">
              <h2 className="flex items-center gap-2 font-[var(--font-title)] text-lg text-[#5a5a40]">
                <Wand2 size={18} /> Análise de Referência
              </h2>
              <button onClick={onClose} className="rounded-full p-1 text-[#5a5a40] hover:bg-[#efe9df]">
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#c9bfae] bg-[#fcfaf7] transition hover:border-[#89a47e]"
              >
                {image ? (
                  <img src={image} alt="Referência" className="h-full w-full object-contain" />
                ) : (
                  <span className="flex flex-col items-center gap-2 text-sm text-[#8a8a6e]">
                    <Upload size={22} /> Enviar foto de inspiração
                  </span>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Observação opcional (ex.: festa infantil tema safári)"
                className="w-full rounded-lg border border-[#e6ddd0] bg-white p-2 text-sm"
                rows={2}
              />

              <button
                type="button"
                disabled={!image || loading}
                onClick={analyze}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#d97724] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c1651b] disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? "Analisando..." : "Analisar com Gemini"}
              </button>

              {error && (
                <p className="rounded-lg bg-[#f6e2df] px-3 py-2 text-xs text-[#c0392b]">{error}</p>
              )}

              {result && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#5a5a40]">{result.theme}</h3>
                    <p className="text-xs text-[#6a6a52]">{result.description}</p>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-medium text-[#5a5a40]">Paleta</p>
                    <div className="flex flex-wrap gap-2">
                      {result.palette?.map((color) => (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => onPickColor(color.hex)}
                          title={`${color.name} · ${color.hex} · CMYK ${color.cmyk} (clique p/ usar no texto)`}
                          className="flex items-center gap-2 rounded-full border border-[#e6ddd0] bg-white py-1 pl-1 pr-3 text-xs"
                        >
                          <span className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                          <span className="font-mono">{color.hex}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {result.graphicElements?.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[#5a5a40]">Elementos gráficos</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.graphicElements.map((el) => (
                          <span key={el} className="rounded-full bg-[#efe9df] px-2 py-0.5 text-xs text-[#5a5a40]">
                            {el}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.suggestedPrompt && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[#5a5a40]">Prompt sugerido</p>
                      <p className="rounded-lg bg-[#fcfaf7] p-2 text-xs italic text-[#6a6a52]">
                        {result.suggestedPrompt}
                      </p>
                      <button
                        type="button"
                        onClick={() => onUsePrompt(result.suggestedPrompt)}
                        className="mt-2 flex items-center gap-1 rounded-lg bg-[#89a47e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#748d69]"
                      >
                        <Sparkles size={14} /> Usar no gerador de estampas
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
