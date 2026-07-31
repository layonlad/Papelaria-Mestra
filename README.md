# Papelaria Mestra

Plataforma web full-stack para artesãos, designers de papelaria personalizada e profissionais de festas. Permite criar, personalizar, analisar e exportar moldes estruturais (dielines / facas de corte) para embalagens, papelaria artesanal, convites e lembrancinhas — com integração de IA (Gemini) para análise de referências visuais, geração de estampas e assistência técnica.

## Stack

- **TypeScript** (strict) + **React 19** + **Vite 6**
- **Node.js + Express 4** (porta `3000`, `0.0.0.0`) como servidor e proxy de API
- **Tailwind CSS v4** (`@tailwindcss/vite`), **Framer Motion** (`motion`), **lucide-react**
- **Three.js** para o visualizador 3D
- **@google/genai** (SDK oficial do Gemini) no servidor
- **esbuild** empacota `server.ts` em `dist/server.cjs`; **tsx** roda em desenvolvimento

## Como rodar

```bash
npm install
cp .env.example .env      # e preencha GEMINI_API_KEY (opcional; a app funciona sem)
npm run dev               # desenvolvimento (Vite em middlewareMode) → http://localhost:3000
```

Produção:

```bash
npm run build             # gera dist/ (cliente) e dist/server.cjs (servidor)
npm start                 # NODE_ENV=production, serve dist/ com fallback de SPA
```

Outros scripts: `npm run typecheck` (tsc --noEmit).

### Variáveis de ambiente

| Variável             | Descrição                                                        |
| -------------------- | ---------------------------------------------------------------- |
| `GEMINI_API_KEY`     | Chave do Google Gemini. Sem ela, os recursos de IA ficam inertes.|
| `APP_URL`            | URL pública da aplicação (opcional).                             |
| `GEMINI_TEXT_MODEL`  | Modelo de texto/visão (padrão `gemini-2.5-flash`).              |
| `GEMINI_IMAGE_MODEL` | Modelo de imagem (padrão `imagen-3.0-generate-002`).            |

> A geração de estampas tenta o modelo de imagem oficial (Imagen); se a chave não tiver acesso, a aplicação cai automaticamente num **gerador procedural** de padrões contínuos no próprio navegador.

## Estrutura

```
├── server.ts                       # Express + rotas Gemini + Vite middleware / fallback SPA
├── vite.config.ts · tsconfig.json · index.html · .env.example · metadata.json
└── src/
    ├── App.tsx · main.tsx · index.css · types.ts
    ├── components/                  # AiAnalysisPanel, ArtLayersPanel, Box3DViewerModal,
    │                                # ChatAssistantModal, DielineCanvas, PlotterSettingsGuide,
    │                                # PrintSheetCanvas, SilhouetteGeneratorModal, ThreeBoxCanvas
    ├── data/                        # dielineTemplates, fonts, silhouetteGeometry
    └── utils/                       # artLayerRenderer, exporters
```

Especificação técnica completa em [`docs/PROMPT_MESTRE.md`](docs/PROMPT_MESTRE.md).

## Funcionalidades

- **Motor de estampas multi-camadas** — composição com blend modes (multiply, screen, overlay, darken, lighten) e esmaecimento de bordas (radial, vinheta, direcional) no canal alfa.
- **Geometria de moldes** — 21 modelos paramétricos (caixas, cadernos, embalagens, convites, lembrancinhas) com cálculo `bestFit` para A4/Carta/A3, sangria (0/3/5 mm) e snapping no painel frontal.
- **Visualizador 3D** — Three.js com animação de dobra (0–100%), estampa mapeada nas faces, rotação por arraste e zoom.
- **IA Gemini** — análise de foto de referência (tema, paleta hex+CMYK, elementos, prompt), gerador de estampas e chat técnico ("Mestre da Papelaria").
- **Exportação técnica** — PNG 300 DPI, PDF, SVG e DXF (Silhouette/Cricut) e máscara P&B para foil / verniz UV.
