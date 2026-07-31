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
