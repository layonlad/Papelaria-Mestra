import { AnimatePresence, motion } from "motion/react";
import { Scissors, X } from "lucide-react";

/* ---------------------------------------------------------------------------
   PlotterSettingsGuide — guia técnico de configuração de corte para as
   principais máquinas de recorte (Silhouette Cameo & Cricut).
--------------------------------------------------------------------------- */

interface PlotterSettingsGuideProps {
  open: boolean;
  onClose: () => void;
}

interface Preset {
  material: string;
  grammage: string;
  blade: string;
  force: string;
  speed: string;
  passes: string;
}

const CAMEO: Preset[] = [
  { material: "Papel comum", grammage: "75–120 g", blade: "1", force: "5", speed: "8", passes: "1" },
  { material: "Cartão / Color Plus", grammage: "180 g", blade: "2–3", force: "10", speed: "5", passes: "1" },
  { material: "Cartão pesado", grammage: "240 g", blade: "4", force: "17", speed: "4", passes: "2" },
  { material: "Papel fotográfico", grammage: "230 g", blade: "3", force: "14", speed: "4", passes: "1" },
  { material: "Lamicote", grammage: "250 g", blade: "5", force: "20", speed: "3", passes: "2" },
];

const CRICUT: Preset[] = [
  { material: "Papel comum", grammage: "75–120 g", blade: "Fina", force: "Papel de impressão", speed: "Padrão", passes: "1" },
  { material: "Cartão / Color Plus", grammage: "180 g", blade: "Fina", force: "Cardstock médio", speed: "Padrão", passes: "1" },
  { material: "Cartão pesado", grammage: "240 g", blade: "Profunda", force: "Cardstock pesado", speed: "Lenta", passes: "2" },
  { material: "Papel fotográfico", grammage: "230 g", blade: "Fina", force: "Foto", speed: "Padrão", passes: "1" },
  { material: "Lamicote", grammage: "250 g", blade: "Profunda", force: "Poster board", speed: "Lenta", passes: "2" },
];

function PresetTable({ title, rows }: { title: string; rows: Preset[] }) {
  return (
    <div className="overflow-x-auto">
      <h3 className="mb-2 font-[var(--font-title)] text-base text-[#5a5a40]">{title}</h3>
      <table className="w-full min-w-[420px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-[#e6ddd0] text-[#8a8a6e]">
            <th className="py-2 pr-3 font-semibold">Material</th>
            <th className="py-2 pr-3 font-semibold">Gramatura</th>
            <th className="py-2 pr-3 font-semibold">Lâmina</th>
            <th className="py-2 pr-3 font-semibold">Força</th>
            <th className="py-2 pr-3 font-semibold">Veloc.</th>
            <th className="py-2 font-semibold">Passadas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.material} className="border-b border-[#efe9df] text-[#3a3a2e]">
              <td className="py-2 pr-3 font-medium">{r.material}</td>
              <td className="py-2 pr-3">{r.grammage}</td>
              <td className="py-2 pr-3">{r.blade}</td>
              <td className="py-2 pr-3">{r.force}</td>
              <td className="py-2 pr-3">{r.speed}</td>
              <td className="py-2">{r.passes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PlotterSettingsGuide({ open, onClose }: PlotterSettingsGuideProps) {
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
                <Scissors size={18} /> Guia de Corte
              </h2>
              <button onClick={onClose} className="rounded-full p-1 text-[#5a5a40] hover:bg-[#efe9df]">
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <p className="text-xs text-[#6a6a52]">
                Valores de referência. Faça sempre um teste de corte em uma sobra do material antes da produção.
                As linhas de <span className="font-semibold text-[#c0392b]">corte</span> saem no vetor; os{" "}
                <span className="font-semibold text-[#2563eb]">vincos</span> devem usar a caneta de dobra ou força reduzida.
              </p>
              <PresetTable title="Silhouette Cameo" rows={CAMEO} />
              <PresetTable title="Cricut Design Space" rows={CRICUT} />
              <div className="rounded-xl bg-[#efe9df] p-4 text-xs text-[#5a5a40]">
                <p className="mb-1 font-semibold">Dicas de acabamento</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Use sangria de 3–5 mm para evitar bordas brancas após o corte.</li>
                  <li>Para vincos limpos, aplique a lâmina de dobra ou reduza a força pela metade.</li>
                  <li>Foil/hot stamping: imprima a máscara P&B e aplique com laminadora a quente.</li>
                  <li>Verniz UV localizado: exporte a máscara e envie ao fornecedor de acabamento.</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
