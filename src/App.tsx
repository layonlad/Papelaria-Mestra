import { useMemo, useRef, useState } from "react";
import {
  Box,
  Boxes,
  Download,
  FileCode2,
  FileImage,
  FileType2,
  Layers,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Scissors,
  Sparkles,
  Stamp,
  Type,
  Wand2,
} from "lucide-react";
import type {
  ArtLayer,
  DielineTemplate,
  ExportFormat,
  PrintSettings,
  TextLayer,
} from "./types";
import {
  CATEGORY_LABELS,
  DIELINE_TEMPLATES,
  getTemplateById,
} from "./data/dielineTemplates";
import {
  bestFit,
  BLEED_OPTIONS,
  getFrontPanelCenter,
  SHEET_SIZES,
  templateToSheet,
} from "./data/silhouetteGeometry";
import { DEFAULT_FONT, FONT_CATEGORY_LABELS, fontsByCategory } from "./data/fonts";
import PrintSheetCanvas, { type PrintSheetHandle } from "./components/PrintSheetCanvas";
import ArtLayersPanel from "./components/ArtLayersPanel";
import AiAnalysisPanel from "./components/AiAnalysisPanel";
import SilhouetteGeneratorModal from "./components/SilhouetteGeneratorModal";
import ChatAssistantModal from "./components/ChatAssistantModal";
import PlotterSettingsGuide from "./components/PlotterSettingsGuide";
import Box3DViewerModal from "./components/Box3DViewerModal";
import { exportDXF, exportFoilMask, exportPDF, exportPNG, exportSVG } from "./utils/exporters";

/* ---------------------------------------------------------------------------
   App — estado global, painéis, abas e diálogos do Papelaria Mestra.
--------------------------------------------------------------------------- */

type Tab = "moldes" | "arte" | "texto" | "impressao";

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const EXPORT_ITEMS: { format: ExportFormat; label: string; icon: React.ReactNode; hint: string }[] = [
  { format: "png", label: "PNG 300 DPI", icon: <FileImage size={16} />, hint: "Impressão de alta resolução" },
  { format: "pdf", label: "PDF", icon: <FileType2 size={16} />, hint: "Documento pronto para gráfica" },
  { format: "svg", label: "SVG (corte)", icon: <FileCode2 size={16} />, hint: "Silhouette / Cricut" },
  { format: "dxf", label: "DXF (corte)", icon: <Scissors size={16} />, hint: "Vetor para plotter" },
  { format: "foil", label: "Máscara Foil/UV", icon: <Stamp size={16} />, hint: "Hot stamping / verniz" },
];

export default function App() {
  const sheetRef = useRef<PrintSheetHandle>(null);

  const [templateId, setTemplateId] = useState<string>(DIELINE_TEMPLATES[0]!.id);
  const template: DielineTemplate = getTemplateById(templateId) ?? DIELINE_TEMPLATES[0]!;

  const [settings, setSettings] = useState<PrintSettings>({
    sheet: "A4",
    bleed: 3,
    showRegistrationMarks: true,
    showDieline: true,
  });

  const [artLayers, setArtLayers] = useState<ArtLayer[]>([]);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("moldes");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [show3D, setShow3D] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPlotter, setShowPlotter] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [generatorPrompt, setGeneratorPrompt] = useState("");
  const [threeTexture, setThreeTexture] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const groupedTemplates = useMemo(() => {
    const groups: Record<string, DielineTemplate[]> = {};
    for (const t of DIELINE_TEMPLATES) {
      (groups[t.category] ??= []).push(t);
    }
    return groups;
  }, []);

  const fontGroups = useMemo(() => fontsByCategory(), []);

  /* ------------------------------ Art layers ----------------------------- */

  const addImage = (url: string, name: string) => {
    const fit = bestFit(template, settings.sheet, settings.bleed);
    const maxZ = artLayers.reduce((m, l) => Math.max(m, l.zIndex), 0);
    const layer: ArtLayer = {
      id: uid(),
      name,
      url,
      x: Math.round(fit.offset.x),
      y: Math.round(fit.offset.y),
      scale: 100,
      rotation: 0,
      flipH: false,
      opacity: 1,
      blendMode: "normal",
      fadeEdge: "none",
      fadeAmount: 0,
      visible: true,
      zIndex: maxZ + 1,
    };
    setArtLayers((prev) => [...prev, layer]);
    setSelectedId(layer.id);
    setTab("arte");
  };

  const updateArt = (id: string, patch: Partial<ArtLayer>) =>
    setArtLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const removeArt = (id: string) => {
    setArtLayers((prev) => prev.filter((l) => l.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const reorderArt = (id: string, direction: "up" | "down") => {
    setArtLayers((prev) => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((l) => l.id === id);
      const swapWith = direction === "up" ? idx + 1 : idx - 1;
      if (idx === -1 || swapWith < 0 || swapWith >= sorted.length) return prev;
      const a = sorted[idx]!;
      const b = sorted[swapWith]!;
      const z = a.zIndex;
      return prev.map((l) => (l.id === a.id ? { ...l, zIndex: b.zIndex } : l.id === b.id ? { ...l, zIndex: z } : l));
    });
  };

  /* ------------------------------ Text layers ---------------------------- */

  const addText = (type: TextLayer["type"], preset?: Partial<TextLayer>) => {
    const fit = bestFit(template, settings.sheet, settings.bleed);
    const center = templateToSheet(getFrontPanelCenter(template), fit);
    const layer: TextLayer = {
      id: uid(),
      text: type === "number" ? "5" : "Nome",
      fontFamily: DEFAULT_FONT,
      fontSize: 12,
      fill: "#5a5a40",
      rotation: 0,
      bold: false,
      italic: false,
      stroke: false,
      strokeWidth: 1.2,
      x: Math.round(center.x - 12),
      y: Math.round(center.y - 6),
      type,
      ...preset,
    };
    setTextLayers((prev) => [...prev, layer]);
    setSelectedId(layer.id);
    setTab("texto");
  };

  const updateText = (id: string, patch: Partial<TextLayer>) =>
    setTextLayers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeText = (id: string) => {
    setTextLayers((prev) => prev.filter((t) => t.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const pickColor = (hex: string) => {
    if (selectedId && textLayers.some((t) => t.id === selectedId)) {
      updateText(selectedId, { fill: hex });
    } else {
      addText("text", { fill: hex, text: "Título" });
    }
  };

  /* ------------------------------- Export -------------------------------- */

  /** Recorta a região do molde da composição da folha, retornando um dataURL. */
  const buildTemplateArt = async (dpi: number): Promise<string | null> => {
    if (!sheetRef.current) return null;
    const comp = await sheetRef.current.renderComposite({ dpi, includeDieline: false, artOnly: true });
    const fit = bestFit(template, settings.sheet, settings.bleed);
    const pxPerMm = dpi / 25.4;
    const crop = document.createElement("canvas");
    crop.width = Math.max(1, Math.round(template.widthMM * fit.scale * pxPerMm));
    crop.height = Math.max(1, Math.round(template.heightMM * fit.scale * pxPerMm));
    const ctx = crop.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(
      comp,
      fit.offset.x * pxPerMm,
      fit.offset.y * pxPerMm,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    );
    return crop.toDataURL("image/png");
  };

  const open3D = async () => {
    setThreeTexture(await buildTemplateArt(120));
    setShow3D(true);
  };

  const handleExport = async (format: ExportFormat) => {
    setExportOpen(false);
    if (!sheetRef.current) return;
    setBusy(true);
    try {
      const sheet = SHEET_SIZES[settings.sheet];
      const stamp = `papelaria-mestra-${template.id}`;
      if (format === "png") {
        const canvas = await sheetRef.current.renderComposite({ dpi: 300, includeDieline: settings.showDieline });
        await exportPNG(canvas, `${stamp}.png`);
      } else if (format === "pdf") {
        const canvas = await sheetRef.current.renderComposite({ dpi: 300, includeDieline: settings.showDieline });
        exportPDF(canvas, sheet.width, sheet.height, `${stamp}.pdf`);
      } else if (format === "svg") {
        const art = await buildTemplateArt(150);
        exportSVG(
          {
            widthMM: template.widthMM,
            heightMM: template.heightMM,
            paths: template.paths,
            ...(art ? { artDataUrl: art, artRect: { x: 0, y: 0, width: template.widthMM, height: template.heightMM } } : {}),
          },
          `${stamp}.svg`,
        );
      } else if (format === "dxf") {
        exportDXF(template.paths, template.heightMM, `${stamp}.dxf`);
      } else if (format === "foil") {
        const canvas = await sheetRef.current.renderComposite({ dpi: 300, includeDieline: false, artOnly: true });
        await exportFoilMask(canvas, `${stamp}-foil-mask.png`);
      }
    } finally {
      setBusy(false);
    }
  };

  const fitInfo = bestFit(template, settings.sheet, settings.bleed);
  const selectedText = textLayers.find((t) => t.id === selectedId) ?? null;

  /* ------------------------------- Render -------------------------------- */

  return (
    <div className="flex h-screen flex-col bg-[#faf6f0] text-[#3a3a2e]">
      {/* Header */}
      <header className="z-20 flex items-center gap-3 border-b border-[#e6ddd0] bg-[#faf6f0]/95 px-4 py-2.5 backdrop-blur">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="rounded-lg p-1.5 text-[#5a5a40] hover:bg-[#efe9df]"
          title={sidebarOpen ? "Recolher painel" : "Expandir painel"}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#5a5a40] font-[var(--font-title)] text-lg text-[#faf6f0]">
            P
          </div>
          <div className="leading-tight">
            <h1 className="font-[var(--font-title)] text-lg text-[#5a5a40]">Papelaria Mestra</h1>
            <p className="text-[10px] uppercase tracking-wider text-[#8a8a6e]">moldes · estampas · exportação</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <ToolbarButton icon={<Wand2 size={16} />} label="Análise IA" onClick={() => setShowAi(true)} />
          <ToolbarButton icon={<Box size={16} />} label="3D" onClick={open3D} />
          <ToolbarButton icon={<MessageCircle size={16} />} label="Assistente" onClick={() => setShowChat(true)} />
          <ToolbarButton icon={<Scissors size={16} />} label="Guia" onClick={() => setShowPlotter(true)} />
          <div className="relative">
            <button
              onClick={() => setExportOpen((v) => !v)}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-[#d97724] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#c1651b] disabled:opacity-60"
            >
              <Download size={16} /> {busy ? "Exportando..." : "Exportar"}
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-[#e6ddd0] bg-white shadow-xl">
                  {EXPORT_ITEMS.map((item) => (
                    <button
                      key={item.format}
                      onClick={() => handleExport(item.format)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#faf6f0]"
                    >
                      <span className="text-[#5a5a40]">{item.icon}</span>
                      <span className="flex-1">
                        <span className="block font-medium text-[#3a3a2e]">{item.label}</span>
                        <span className="block text-[11px] text-[#8a8a6e]">{item.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="flex w-80 shrink-0 flex-col border-r border-[#e6ddd0] bg-[#faf6f0]">
            <nav className="grid grid-cols-4 border-b border-[#e6ddd0]">
              <TabButton active={tab === "moldes"} icon={<Boxes size={16} />} label="Moldes" onClick={() => setTab("moldes")} />
              <TabButton active={tab === "arte"} icon={<Layers size={16} />} label="Arte" onClick={() => setTab("arte")} />
              <TabButton active={tab === "texto"} icon={<Type size={16} />} label="Texto" onClick={() => setTab("texto")} />
              <TabButton active={tab === "impressao"} icon={<FileImage size={16} />} label="Folha" onClick={() => setTab("impressao")} />
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {tab === "moldes" && (
                <div className="space-y-4">
                  {Object.entries(groupedTemplates).map(([category, items]) => (
                    <div key={category}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8a8a6e]">
                        {CATEGORY_LABELS[category as DielineTemplate["category"]]}
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {items.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setTemplateId(t.id);
                              setSelectedId(null);
                            }}
                            className={`rounded-xl border p-2 text-left transition ${
                              t.id === templateId ? "border-[#d97724] bg-white shadow-sm" : "border-[#e6ddd0] bg-[#fcfaf7] hover:border-[#89a47e]"
                            }`}
                          >
                            <div className="mb-1 grid h-14 place-items-center rounded-lg bg-[#f2ece2]">
                              <svg viewBox={`0 0 ${t.widthMM} ${t.heightMM}`} className="h-11 w-full" preserveAspectRatio="xMidYMid meet">
                                {t.paths
                                  .filter((p) => p.type === "cut")
                                  .map((p, i) => (
                                    <path key={i} d={p.d} fill="none" stroke="#5a5a40" strokeWidth={Math.max(t.widthMM, t.heightMM) / 120} vectorEffect="non-scaling-stroke" />
                                  ))}
                              </svg>
                            </div>
                            <span className="block truncate text-xs font-medium text-[#3a3a2e]">{t.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "arte" && (
                <ArtLayersPanel
                  layers={artLayers}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onUpdate={updateArt}
                  onAddImage={addImage}
                  onRemove={removeArt}
                  onReorder={reorderArt}
                  onOpenGenerator={() => setShowGenerator(true)}
                />
              )}

              {tab === "texto" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => addText("text", { text: "Nome" })} className="rounded-lg bg-[#5a5a40] px-2 py-2 text-xs font-semibold text-white hover:bg-[#4a4a34]">
                      + Nome
                    </button>
                    <button onClick={() => addText("number", { text: "5", fontSize: 20, bold: true })} className="rounded-lg bg-[#89a47e] px-2 py-2 text-xs font-semibold text-white hover:bg-[#748d69]">
                      + Idade
                    </button>
                    <button onClick={() => addText("text", { text: "Texto" })} className="rounded-lg bg-[#d97724] px-2 py-2 text-xs font-semibold text-white hover:bg-[#c1651b]">
                      + Texto
                    </button>
                  </div>

                  {textLayers.length === 0 && (
                    <p className="rounded-lg border border-dashed border-[#e6ddd0] p-4 text-center text-xs text-[#8a8a6e]">
                      Textos novos aparecem no centro do painel frontal do molde.
                    </p>
                  )}

                  {textLayers.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={`space-y-2 rounded-xl border p-3 ${t.id === selectedId ? "border-[#d97724] bg-white" : "border-[#e6ddd0] bg-[#fcfaf7]"}`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          value={t.text}
                          onChange={(e) => updateText(t.id, { text: e.target.value })}
                          className="flex-1 rounded border border-[#e6ddd0] px-2 py-1 text-sm"
                        />
                        <button onClick={() => removeText(t.id)} className="rounded p-1 text-[#c0392b] hover:bg-[#f6e2df]">
                          <Type size={14} className="hidden" />✕
                        </button>
                      </div>
                      {t.id === selectedId && (
                        <div className="grid grid-cols-2 gap-2 text-xs text-[#5a5a40]">
                          <label className="col-span-2 flex flex-col gap-1">
                            Fonte
                            <select
                              value={t.fontFamily}
                              onChange={(e) => updateText(t.id, { fontFamily: e.target.value })}
                              className="rounded border border-[#e6ddd0] bg-white px-2 py-1"
                            >
                              {Object.entries(fontGroups).map(([cat, fonts]) => (
                                <optgroup key={cat} label={FONT_CATEGORY_LABELS[cat as keyof typeof FONT_CATEGORY_LABELS]}>
                                  {fonts.map((fnt) => (
                                    <option key={fnt.family} value={fnt.family}>
                                      {fnt.label}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            Tamanho {t.fontSize}mm
                            <input type="range" min={4} max={60} value={t.fontSize} onChange={(e) => updateText(t.id, { fontSize: Number(e.target.value) })} />
                          </label>
                          <label className="flex flex-col gap-1">
                            Rotação {t.rotation}°
                            <input type="range" min={-180} max={180} value={t.rotation} onChange={(e) => updateText(t.id, { rotation: Number(e.target.value) })} />
                          </label>
                          <label className="flex items-center gap-2">
                            Cor
                            <input type="color" value={t.fill} onChange={(e) => updateText(t.id, { fill: e.target.value })} className="h-7 w-10 rounded border border-[#e6ddd0]" />
                          </label>
                          <div className="flex items-center gap-1.5">
                            <TogglePill active={t.bold} onClick={() => updateText(t.id, { bold: !t.bold })} label="B" />
                            <TogglePill active={t.italic} onClick={() => updateText(t.id, { italic: !t.italic })} label="I" />
                            <TogglePill active={t.stroke} onClick={() => updateText(t.id, { stroke: !t.stroke })} label="Contorno" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedText && (
                    <p className="text-[11px] text-[#8a8a6e]">Arraste o texto na folha para reposicionar.</p>
                  )}
                </div>
              )}

              {tab === "impressao" && (
                <div className="space-y-4 text-sm">
                  <label className="flex flex-col gap-1 text-xs font-medium text-[#5a5a40]">
                    Tamanho da folha
                    <select
                      value={settings.sheet}
                      onChange={(e) => setSettings((s) => ({ ...s, sheet: e.target.value as PrintSettings["sheet"] }))}
                      className="rounded-lg border border-[#e6ddd0] bg-white px-2 py-2"
                    >
                      {Object.values(SHEET_SIZES).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-col gap-1 text-xs font-medium text-[#5a5a40]">
                    Sangria
                    <div className="flex gap-2">
                      {BLEED_OPTIONS.map((b) => (
                        <button
                          key={b}
                          onClick={() => setSettings((s) => ({ ...s, bleed: b }))}
                          className={`flex-1 rounded-lg border py-2 ${settings.bleed === b ? "border-[#d97724] bg-white text-[#d97724]" : "border-[#e6ddd0] bg-[#fcfaf7] text-[#5a5a40]"}`}
                        >
                          {b} mm
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center justify-between rounded-lg border border-[#e6ddd0] bg-[#fcfaf7] px-3 py-2 text-xs font-medium text-[#5a5a40]">
                    Mostrar molde (corte/vinco)
                    <input type="checkbox" checked={settings.showDieline} onChange={(e) => setSettings((s) => ({ ...s, showDieline: e.target.checked }))} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-[#e6ddd0] bg-[#fcfaf7] px-3 py-2 text-xs font-medium text-[#5a5a40]">
                    Marcas de registro
                    <input type="checkbox" checked={settings.showRegistrationMarks} onChange={(e) => setSettings((s) => ({ ...s, showRegistrationMarks: e.target.checked }))} />
                  </label>

                  <div className="rounded-lg bg-[#efe9df] p-3 text-xs text-[#5a5a40]">
                    <p>Molde: {template.widthMM.toFixed(0)} × {template.heightMM.toFixed(0)} mm</p>
                    <p>Encaixe (bestFit): {Math.round(fitInfo.scale * 100)}%</p>
                    {fitInfo.reduced && <p className="mt-1 text-[#c0392b]">Reduzido para caber na folha escolhida.</p>}
                  </div>

                  <button
                    onClick={() => setShowGenerator(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#89a47e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#748d69]"
                  >
                    <Sparkles size={16} /> Gerar estampa de fundo
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Canvas central */}
        <main className="min-w-0 flex-1">
          <PrintSheetCanvas
            ref={sheetRef}
            template={template}
            settings={settings}
            artLayers={artLayers}
            textLayers={textLayers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDragArt={(id, x, y) => updateArt(id, { x, y })}
            onDragText={(id, x, y) => updateText(id, { x, y })}
          />
        </main>
      </div>

      {/* Modais */}
      <AiAnalysisPanel
        open={showAi}
        onClose={() => setShowAi(false)}
        onUsePrompt={(p) => {
          setGeneratorPrompt(p);
          setShowAi(false);
          setShowGenerator(true);
        }}
        onPickColor={pickColor}
      />
      <SilhouetteGeneratorModal
        open={showGenerator}
        onClose={() => setShowGenerator(false)}
        initialPrompt={generatorPrompt}
        onGenerated={addImage}
      />
      <ChatAssistantModal open={showChat} onClose={() => setShowChat(false)} />
      <PlotterSettingsGuide open={showPlotter} onClose={() => setShowPlotter(false)} />
      <Box3DViewerModal open={show3D} onClose={() => setShow3D(false)} template={template} textureDataUrl={threeTexture} />
    </div>
  );
}

/* ------------------------------ Subcomponentes ---------------------------- */

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-[#e6ddd0] bg-[#fcfaf7] px-2.5 py-2 text-xs font-medium text-[#5a5a40] transition hover:border-[#89a47e] hover:bg-white"
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
        active ? "bg-white text-[#d97724]" : "text-[#5a5a40] hover:bg-[#efe9df]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function TogglePill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs font-semibold ${active ? "border-[#d97724] bg-[#d97724] text-white" : "border-[#e6ddd0] text-[#5a5a40]"}`}
    >
      {label}
    </button>
  );
}
