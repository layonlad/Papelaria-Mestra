# PROMPT MESTRE DA APLICAÇÃO: PAPELARIA MESTRA

## 1. VISÃO GERAL DA APLICAÇÃO

O **Papelaria Mestra** é uma plataforma web full-stack desenvolvida para artesãos, designers de papelaria personalizada e profissionais de festas. A aplicação permite criar, personalizar, analisar e exportar moldes estruturais (dielines/facas de corte) para embalagens, papelaria artesanal, convites e lembrancinhas.

---

## 2. PILHA TECNOLÓGICA & DEPENDÊNCIAS

### Core & Frameworks

- **Linguagem**: TypeScript (Strict Mode)
- **Frontend**: React 19 + Vite 6
- **Backend / API Proxy**: Node.js + Express 4.x (rodando na porta `3000` em `0.0.0.0`)
- **Estilização**: Tailwind CSS v4 + `@tailwindcss/vite`
- **Animações**: `motion` (Framer Motion)
- **Ícones**: `lucide-react`
- **Renderização 3D**: `three` (Three.js) + `@types/three`
- **Inteligência Artificial**: `@google/genai` (SDK Oficial do Gemini no servidor)
- **Compilação de Servidor**: `esbuild` (agrupando `server.ts` em `dist/server.cjs`) + `tsx` para desenvolvimento.

---

## 3. ESTRUTURA COMPLETA DE ARQUIVOS & RESPONSABILIDADES

```text
├── /.env.example                        # Declaração das chaves GEMINI_API_KEY e APP_URL
├── /metadata.json                       # Nome, descrição e permissões do applet
├── /package.json                        # Scripts de build ("build", "dev", "start") e dependências
├── /server.ts                           # Servidor Express com rotas de API do Gemini e fallback SPA Vite
├── /index.html                          # Importação das fontes Google Fonts (Playfair, Fredoka, Bebas, etc.)
├── /vite.config.ts                      # Configuração do Vite com suporte ao Tailwind v4
├── /tsconfig.json                       # CompilerOptions para TypeScript ES2022 / JSX
├── /src
│   ├── App.tsx                          # Estado global, gerenciamento de painéis, abas e diálogos
│   ├── main.tsx                         # Ponto de entrada do React (createRoot)
│   ├── index.css                        # Importação do Tailwind CSS (@import "tailwindcss";)
│   ├── types.ts                         # Interfaces TypeScript para moldes, camadas de arte, texto, etc.
│   ├── /components
│   │   ├── AiAnalysisPanel.tsx          # Análise de fotos com Gemini Vision para extrair tema e paleta
│   │   ├── ArtLayersPanel.tsx           # Gestão de multi-camadas de arte (opacidade, mesclagem, esmaecimento)
│   │   ├── Box3DViewerModal.tsx         # Modal com visualizador 3D interativo para dobra e montagem
│   │   ├── ChatAssistantModal.tsx       # Assistente de IA especialista em engenharia de papelaria
│   │   ├── DielineCanvas.tsx            # Canvas SVG do molde estrutural (linhas de corte/vinco e sangria)
│   │   ├── PlotterSettingsGuide.tsx     # Guia técnico de corte (Silhouette Cameo & Cricut)
│   │   ├── PrintSheetCanvas.tsx         # Renderização da folha de impressão (A4, Carta, A3) com marcas de registro
│   │   ├── SilhouetteGeneratorModal.tsx # Gerador de patterns e estampas via Gemini AI (Imagen/Pattern)
│   │   └── ThreeBoxCanvas.tsx           # Renderizador Three.js para caixas dobradas em 3D
│   ├── /data
│   │   ├── dielineTemplates.ts          # Definição dos 17+ modelos de caixas, cadernos e embalagens
│   │   ├── fonts.ts                     # Lista de fontes pré-carregadas e categorizadas por estilo
│   │   └── silhouetteGeometry.ts        # Cálculo geométrico vetorial e melhor encaixe (bestFit) na folha
│   └── /utils
│       ├── artLayerRenderer.ts          # Pipeline HTML5 Canvas para mesclagem (blend modes) e bordas suaves
│       └── exporters.ts                 # Exportadores para PDF/PNG (300 DPI), SVG, DXF e Máscara de Foil
```

---

## 4. INTERFACES DE TIPO PRINCIPAIS

### 4.1. ArtLayer (Camada de Arte)

```ts
export interface ArtLayer {
  id: string;
  name: string;
  url: string;
  x: number;          // Offset X em mm
  y: number;          // Offset Y em mm
  scale: number;      // Escala 10% a 400%
  rotation: number;   // Rotação -180 a 180°
  flipH: boolean;
  opacity: number;    // Opacidade de 0.0 a 1.0
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';
  fadeEdge: 'none' | 'radial' | 'vignette' | 'linear-top' | 'linear-bottom' | 'linear-left' | 'linear-right';
  fadeAmount: number; // Porcentagem do esmaecimento de borda (0-100%)
  visible: boolean;
  zIndex: number;
}
```

### 4.2. TextLayer (Camada de Texto)

```ts
export interface TextLayer {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  rotation: number;
  bold: boolean;
  italic: boolean;
  stroke: boolean;       // Contorno branco para contraste sobre estampas
  strokeWidth: number;
  x: number;             // Coordenada mm na folha
  y: number;             // Coordenada mm na folha
  type: 'text' | 'number';
}
```

### 4.3. Trecho do `server.ts` (rotas Gemini + Vite middleware)

```ts
// Rotas de API registradas PRIMEIRO
app.post("/api/gemini/analyze", ...);
app.post("/api/gemini/generate-pattern", ...);

// Middleware do Vite para desenvolvimento
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(process.cwd(), 'dist')));
  app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
}
```

---

## 5. FUNCIONALIDADES PRINCIPAIS & REGRAS DE NEGÓCIO

### A. Motor de Renderização de Estampas Multi-Camadas (`artLayerRenderer.ts`)

1. **Composição Dinâmica**: Combina múltiplas imagens carregadas pelo usuário ou geradas via IA.
2. **Modos de Mesclagem (Blend Modes)**: Suporte para Multiply, Screen, Overlay, Darken e Lighten.
3. **Esmaecimento de Bordas (Fade Effect)**: Aplica gradientes radiais, vinhetas ou direcionais (top/bottom/left/right) no Alpha Channel do Canvas HTML5 para fusão suave de ilustrações sobre o fundo.

### B. Geometria de Moldes e Encaixe Automático (`silhouetteGeometry.ts`)

1. **Cálculo de Escala `bestFit`**: Adapta automaticamente o vetor do molde para as dimensões da folha escolhida (A4, Carta ou A3).
2. **Snapping no Painel Frontal**: A função `getFrontPanelCenter()` calcula matematicamente o centro da face principal da caixa para posicionamento automático do nome/idade do aniversariante.
3. **Margem de Sangria (Bleed)**: Suporte para 0mm, 3mm e 5mm de sangria para evitar bordas brancas após o corte.

### C. Visualizador 3D Interativo (`ThreeBoxCanvas.tsx` & `Box3DViewerModal.tsx`)

1. **Visualização em Tempo Real**: Converte a estampa 2D e o molde vetorial em texturas mapeadas sobre malhas 3D no Three.js.
2. **Animação de Dobra**: Permite simular a montagem e o fechamento da caixa através de um slider de porcentagem de dobra (0% a 100%).
3. **Iluminação e Fundo de Estúdio**: Renderização com iluminação ambiente e direcional para simulação realista do produto acabado.

### D. Integração com IA Gemini (Server-Side)

1. **Análise Visual de Referência (`AiAnalysisPanel.tsx`)**: O usuário envia uma foto de inspiração, e o Gemini analisa o tema, paleta de cores (hexadecimal + CMYK), elementos gráficos e gera um prompt técnico.
2. **Gerador de Estampas e Padronagens (`SilhouetteGeneratorModal.tsx`)**: Gera ilustrações e padrões contínuos (seamless patterns) diretamente no canvas de fundo.
3. **Assistente Técnico em Papelaria (`ChatAssistantModal.tsx`)**: Chat interativo para tirar dúvidas sobre gramatura de papel (180g, 240g, Papel Fotográfico, Lamicote), lâmina de corte e tipo de cola.

### E. Módulo de Exportação Técnica (`exporters.ts`)

1. **Impressão em Alta Resolução**: Exporta a arte final em formato PNG a 300 DPI, pronta para impressão profissional.
2. **Vetores para Plotters de Corte**: Exporta arquivos vetoriais em formato SVG e DXF, compatíveis com Silhouette Studio e Cricut Design Space.
3. **Máscara de Efeitos Especiais**: Gera PNGs isolados em preto e branco para aplicação de Hot Stamping / Foil Dourado e Verniz Localizado UV.

---

## 6. DIRETRIZES DE DESIGN & INTERFACE (UI ANTI-SLOP)

1. **Esquema de Cores**: Paleta neutra acolhedora e sofisticada baseada em tons pastéis de papelaria artesanal.
   - Fundo: `#FAF6F0` / `#FCFAF7`
   - Primária: `#5A5A40`
   - Secundária: `#89A47E`
   - Destaque: `#D97724`
2. **Tipografia**:
   - Títulos e Destaques: Playfair Display, Bebas Neue, Baloo 2.
   - Textos Infantis e Festas: Fredoka, Chewy, Pacifico, Comfortaa.
   - Corpo do Texto: Plus Jakarta Sans.
3. **Layout e Espaçamento**:
   - Painel central focado na pré-visualização da folha de corte.
   - Barra lateral retrátil para edição de camadas de arte, textos e parâmetros de impressão.
   - Modais responsivos para análise 3D e geração por IA.

---

Este prompt contém todas as especificações técnicas, regras de cálculo, mapa de arquivos, dependências e integrações com IA necessárias para reproduzir, evoluir ou documentar o **Papelaria Mestra**.
