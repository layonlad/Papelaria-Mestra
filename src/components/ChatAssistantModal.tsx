import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import type { ChatMessage } from "../types";

/* ---------------------------------------------------------------------------
   ChatAssistantModal — "Mestre da Papelaria": assistente técnico especialista
   em gramatura de papel, lâminas de corte, vincos e tipos de cola.
--------------------------------------------------------------------------- */

interface ChatAssistantModalProps {
  open: boolean;
  onClose: () => void;
}

const SUGGESTIONS = [
  "Qual gramatura usar para caixa de bombom?",
  "Diferença entre lâmina da Cameo e da Cricut?",
  "Qual cola para papel Color Plus?",
  "Como evitar bordas brancas no corte?",
];

const GREETING: ChatMessage = {
  role: "model",
  text: "Olá! Sou o Mestre da Papelaria. Posso ajudar com gramaturas, lâminas de corte, vincos, colas e acabamentos. O que você precisa?",
};

export default function ChatAssistantModal({ open, onClose }: ChatAssistantModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next = [...messages, { role: "user" as const, text: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((_, i) => i > 0) }),
      });
      const data = await res.json();
      const reply = res.ok
        ? (data.reply as string)
        : `Não consegui responder agora (${data.error ?? "erro"}). Verifique a GEMINI_API_KEY no servidor.`;
      setMessages((prev) => [...prev, { role: "model", text: reply || "(sem resposta)" }]);
    } catch {
      setMessages((prev) => [...prev, { role: "model", text: "Falha de conexão com o assistente." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-end bg-[#3a3a2e]/30 p-4 backdrop-blur-sm sm:items-center sm:justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="flex h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[#faf6f0] shadow-2xl"
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-[#e6ddd0] px-5 py-4">
              <h2 className="flex items-center gap-2 font-[var(--font-title)] text-lg text-[#5a5a40]">
                <MessageCircle size={18} /> Mestre da Papelaria
              </h2>
              <button onClick={onClose} className="rounded-full p-1 text-[#5a5a40] hover:bg-[#efe9df]">
                <X size={18} />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "rounded-br-sm bg-[#5a5a40] text-[#faf6f0]"
                        : "rounded-bl-sm bg-white text-[#3a3a2e] shadow-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-[#8a8a6e] shadow-sm">
                    <Loader2 size={14} className="animate-spin" /> pensando...
                  </div>
                </div>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-[#e6ddd0] bg-white px-3 py-1 text-xs text-[#5a5a40] hover:border-[#89a47e]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form
              className="flex items-center gap-2 border-t border-[#e6ddd0] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escreva sua dúvida técnica..."
                className="flex-1 rounded-full border border-[#e6ddd0] bg-white px-4 py-2 text-sm focus:border-[#89a47e] focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d97724] text-white hover:bg-[#c1651b] disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
