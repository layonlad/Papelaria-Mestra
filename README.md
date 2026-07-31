# Papelaria Mestra

Plataforma web full-stack para artesãos, designers de papelaria personalizada e profissionais de festas. Permite criar, personalizar, analisar e exportar moldes estruturais (dielines / facas de corte) para embalagens, papelaria artesanal, convites e lembrancinhas — com integração de IA (Gemini) para análise de referências visuais, geração de estampas e assistência técnica.

## Stack principal

- **TypeScript** (strict) + **React 19** + **Vite 6**
- **Node.js + Express** como proxy de API
- **Tailwind CSS v4**, **Framer Motion**, **lucide-react**
- **Three.js** para visualização 3D
- **@google/genai** (SDK oficial do Gemini) no servidor

## Estrutura deste repositório

```
.
├── README.md
├── docs/
│   └── PROMPT_MESTRE.md              # Especificação completa do projeto
└── snippets/
    ├── types/
    │   ├── ArtLayer.ts               # Interface de camada de arte
    │   └── TextLayer.ts              # Interface de camada de texto
    └── server/
        └── server-routes-snippet.ts  # Trecho de rotas Gemini + Vite middleware
```

## Documentação

Toda a especificação técnica — pilha, mapa de arquivos, interfaces, regras de negócio, integrações com IA e diretrizes de UI — está em [`docs/PROMPT_MESTRE.md`](docs/PROMPT_MESTRE.md).

## Funcionalidades-chave

- Motor de renderização multi-camadas com blend modes e esmaecimento de bordas
- Cálculo geométrico de moldes com `bestFit` automático para A4, Carta e A3
- Visualizador 3D interativo com animação de dobra
- Integração com Gemini para análise de referência, geração de padrões e chat técnico
- Exportação para PNG 300 DPI, SVG, DXF e máscara de foil / verniz UV
