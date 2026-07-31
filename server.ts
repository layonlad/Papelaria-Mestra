import path from "node:path";
import fs from "node:fs";
import express, { type Request, type Response } from "express";
import { GoogleGenAI } from "@google/genai";

/* ---------------------------------------------------------------------------
   Papelaria Mestra — Servidor Express + proxy de API do Gemini
   - Porta 3000 em 0.0.0.0
   - Em desenvolvimento: Vite em middlewareMode (SPA)
   - Em produção: serve /dist estático com fallback de SPA
--------------------------------------------------------------------------- */

const PORT = Number(process.env.PORT ?? 3000);
const HOST = "0.0.0.0";
const isProduction = process.env.NODE_ENV === "production";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "imagen-3.0-generate-002";

const app = express();
app.use(express.json({ limit: "25mb" }));

/* --------------------------- Cliente Gemini -------------------------------- */

let genai: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genai) genai = new GoogleGenAI({ apiKey });
  return genai;
}

/** Extrai o primeiro bloco JSON de um texto do modelo (tolerante a cercas ```json). */
function parseJsonLoose<T>(raw: string): T | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Divide um dataURL (data:image/png;base64,....) em mimeType + dados base64. */
function splitDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

/* ---------------------------------------------------------------------------
   Rotas de API registradas PRIMEIRO (antes do middleware do Vite / fallback SPA)
--------------------------------------------------------------------------- */

/**
 * Análise visual de uma foto de referência.
 * Body: { image: dataURL, note?: string }
 * Retorna: { theme, description, palette[], graphicElements[], suggestedPrompt, ... }
 */
app.post("/api/gemini/analyze", async (req: Request, res: Response) => {
  const ai = getGenAI();
  if (!ai) {
    res.status(503).json({ error: "GEMINI_API_KEY não configurada no servidor." });
    return;
  }

  const { image, note } = req.body as { image?: string; note?: string };
  const parsed = image ? splitDataUrl(image) : null;
  if (!parsed) {
    res.status(400).json({ error: "Campo 'image' ausente ou não é um dataURL base64 válido." });
    return;
  }

  const instruction = `Você é um diretor de arte especialista em papelaria personalizada e identidade de festas.
Analise a imagem de referência e responda ESTRITAMENTE em JSON válido, sem comentários, no formato:
{
  "theme": "tema principal em poucas palavras",
  "description": "descrição curta do clima/estilo (1-2 frases)",
  "palette": [ { "name": "nome da cor", "hex": "#RRGGBB", "cmyk": "C,M,Y,K" } ],
  "graphicElements": ["elemento 1", "elemento 2"],
  "suggestedPrompt": "prompt técnico em inglês pronto para gerar uma estampa seamless coerente"
}
A paleta deve ter de 4 a 6 cores. ${note ? `Observação do usuário: ${note}` : ""}`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: instruction },
            { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
          ],
        },
      ],
    });

    const text = response.text ?? "";
    const json = parseJsonLoose<Record<string, unknown>>(text);
    if (!json) {
      res.status(502).json({ error: "Não foi possível interpretar a resposta do modelo.", raw: text });
      return;
    }
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: "Falha ao analisar a imagem.", detail: String(err) });
  }
});

/**
 * Geração de estampa / padronagem.
 * Body: { prompt: string, seamless?: boolean }
 * Estratégia: tenta o modelo de imagem oficial (Imagen); em caso de falta de acesso,
 * o cliente recebe { fallback: true } e gera um padrão procedural localmente.
 */
app.post("/api/gemini/generate-pattern", async (req: Request, res: Response) => {
  const ai = getGenAI();
  const { prompt, seamless } = req.body as { prompt?: string; seamless?: boolean };
  if (!prompt || !prompt.trim()) {
    res.status(400).json({ error: "Campo 'prompt' é obrigatório." });
    return;
  }

  if (!ai) {
    res.json({ fallback: true, reason: "GEMINI_API_KEY não configurada." });
    return;
  }

  const fullPrompt = `${prompt.trim()}${
    seamless ? ", seamless repeating pattern, tileable, flat vector illustration, soft pastel palette" : ""
  }`;

  try {
    const response = await ai.models.generateImages({
      model: IMAGE_MODEL,
      prompt: fullPrompt,
      config: { numberOfImages: 1, aspectRatio: "1:1" },
    });

    const generated = response.generatedImages?.[0]?.image?.imageBytes;
    if (!generated) {
      res.json({ fallback: true, reason: "O modelo não retornou imagem." });
      return;
    }
    res.json({ image: `data:image/png;base64,${generated}` });
  } catch (err) {
    // Chave sem acesso ao Imagen, cota, etc. → cliente cai no gerador procedural.
    res.json({ fallback: true, reason: String(err) });
  }
});

/**
 * Assistente técnico de papelaria (chat).
 * Body: { messages: { role: 'user' | 'model', text: string }[] }
 * Retorna: { reply: string }
 */
app.post("/api/gemini/chat", async (req: Request, res: Response) => {
  const ai = getGenAI();
  if (!ai) {
    res.status(503).json({ error: "GEMINI_API_KEY não configurada no servidor." });
    return;
  }

  const { messages } = req.body as { messages?: { role: "user" | "model"; text: string }[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Campo 'messages' é obrigatório." });
    return;
  }

  const systemInstruction = `Você é o "Mestre da Papelaria", um assistente técnico especialista em papelaria artesanal, encadernação e engenharia de embalagens.
Responda em português do Brasil, de forma prática e objetiva. Domine: gramaturas de papel (150g, 180g, 240g, papel fotográfico, Lamicote, Color Plus), tipos de faca/lâmina para plotters de corte (Silhouette Cameo, Cricut), vincos, sangria, tipos de cola (PVA, cola quente, fita dupla-face), acabamentos (hot stamping/foil, verniz UV localizado) e montagem de caixas. Quando útil, sugira valores concretos.`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      config: { systemInstruction },
      contents: messages.map((m) => ({
        role: m.role === "model" ? "model" : "user",
        parts: [{ text: m.text }],
      })),
    });
    res.json({ reply: response.text ?? "" });
  } catch (err) {
    res.status(500).json({ error: "Falha ao consultar o assistente.", detail: String(err) });
  }
});

/** Status simples de saúde / disponibilidade da IA. */
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, ai: Boolean(process.env.GEMINI_API_KEY), textModel: TEXT_MODEL });
});

/* ---------------------------------------------------------------------------
   Middleware do Vite (dev) / arquivos estáticos (produção)
--------------------------------------------------------------------------- */

async function start(): Promise<void> {
  if (!isProduction) {
    // Import dinâmico para que o bundle de produção (esbuild) não precise do Vite.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: HOST },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(500).send("Build de produção não encontrado. Rode 'npm run build'.");
      }
    });
  }

  app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`\n  Papelaria Mestra rodando em http://${HOST}:${PORT} (${isProduction ? "produção" : "desenvolvimento"})\n`);
  });
}

void start();
