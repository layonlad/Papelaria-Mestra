import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Box, RotateCcw, X } from "lucide-react";
import type { DielineTemplate } from "../types";
import ThreeBoxCanvas from "./ThreeBoxCanvas";

/* ---------------------------------------------------------------------------
   Box3DViewerModal — modal com o visualizador 3D interativo e o slider de
   dobra (0% plano → 100% montado).
--------------------------------------------------------------------------- */

interface Box3DViewerModalProps {
  open: boolean;
  onClose: () => void;
  template: DielineTemplate;
  textureDataUrl?: string | null;
}

export default function Box3DViewerModal({ open, onClose, template, textureDataUrl }: Box3DViewerModalProps) {
  const [fold, setFold] = useState(100);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#3a3a2e]/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-[#faf6f0] shadow-2xl"
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-[#e6ddd0] px-5 py-4">
              <h2 className="flex items-center gap-2 font-[var(--font-title)] text-lg text-[#5a5a40]">
                <Box size={18} /> Visualizador 3D · {template.name}
              </h2>
              <button onClick={onClose} className="rounded-full p-1 text-[#5a5a40] hover:bg-[#efe9df]">
                <X size={18} />
              </button>
            </header>

            <div className="h-[52vh] w-full bg-[#efe9df]">
              <ThreeBoxCanvas template={template} foldPct={fold} textureDataUrl={textureDataUrl} />
            </div>

            <div className="space-y-3 border-t border-[#e6ddd0] px-5 py-4">
              {template.box3D ? (
                <div className="flex items-center gap-3">
                  <span className="w-24 text-xs font-medium text-[#5a5a40]">Dobra {fold}%</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={fold}
                    onChange={(e) => setFold(Number(e.target.value))}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setFold(fold >= 100 ? 0 : 100)}
                    className="flex items-center gap-1 rounded-lg border border-[#e6ddd0] px-3 py-1.5 text-xs font-medium text-[#5a5a40] hover:bg-[#efe9df]"
                  >
                    <RotateCcw size={14} /> {fold >= 100 ? "Planificar" : "Montar"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[#8a8a6e]">
                  Este molde é plano — arraste para girar e use o scroll para aproximar.
                </p>
              )}
              <p className="text-[11px] text-[#8a8a6e]">
                Arraste para girar · scroll para zoom · a estampa aplicada aparece mapeada na face frontal.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
