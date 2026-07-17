import { useEffect, useRef, useState } from "react";
import {
  MessageCircle, ChevronDown, ChevronUp, Send, FileCode2, Loader2,
} from "lucide-react";
import { useStore } from "../store/useStore.js";
import { askChat } from "../api.js";

const SUGGESTIONS = [
  "Where is the login logic?",
  "What does this use for database access?",
  "Which file should I look at first?",
];

const COLLAPSED_HEIGHT = 48;
const MIN_HEIGHT = 160;

export default function ChatDrawer() {
  const chatOpen = useStore((s) => s.chatOpen);
  const toggleChat = useStore((s) => s.toggleChat);
  const chatMessages = useStore((s) => s.chatMessages);
  const addChatMessage = useStore((s) => s.addChatMessage);
  const jobId = useStore((s) => s.jobId);
  const selectFile = useStore((s) => s.selectFile);
  const chatPrefill = useStore((s) => s.chatPrefill);
  const clearPrefill = useStore((s) => s.clearPrefill);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [height, setHeight] = useState(() =>
    typeof window !== "undefined" ? Math.round(window.innerHeight * 0.34) : 320
  );
  const listRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    function onMove(e) {
      if (!draggingRef.current) return;
      const next = window.innerHeight - e.clientY;
      const max = window.innerHeight * 0.85;
      setHeight(Math.min(Math.max(next, MIN_HEIGHT), max));
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startDrag(e) {
    if (!chatOpen) return;
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }

  useEffect(() => {
    if (chatPrefill) {
      setInput(chatPrefill);
      clearPrefill();
    }
  }, [chatPrefill]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, sending]);

  async function send(text) {
    const question = (text ?? input).trim();
    if (!question || sending) return;
    setInput("");
    addChatMessage({ role: "user", content: question });
    setSending(true);
    try {
      const history = chatMessages.slice(-6).map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      }));
      const { answer, sources } = await askChat(jobId, question, history);
      addChatMessage({ role: "ai", content: answer, sources });
    } catch (e) {
      addChatMessage({
        role: "ai",
        content: `I ran into a problem answering that: ${e.message}`,
        sources: [],
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="border-t border-border bg-surface flex flex-col"
      style={{ height: chatOpen ? height : COLLAPSED_HEIGHT }}
    >
      {chatOpen && (
        <div
          onMouseDown={startDrag}
          className="h-1.5 w-full shrink-0 cursor-row-resize hover:bg-accent/40 transition-colors"
          title="Drag to resize"
        />
      )}

      <button
        onClick={() => toggleChat()}
        className="flex items-center gap-2 px-4 py-3 shrink-0 text-left"
      >
        <MessageCircle size={16} className="text-accent" />
        <span className="text-sm font-medium text-text-primary">Ask about this repo</span>
        <span className="text-xs text-text-secondary hidden sm:inline">
          Answers are grounded in the actual files
        </span>
        <span className="flex-1" />
        {chatOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {chatOpen && (
        <div className="flex-1 flex flex-col min-h-0">
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 flex flex-col gap-3">
            {chatMessages.length === 0 && (
              <p className="text-xs text-text-disabled mt-2">
                Ask anything about this codebase — answers cite the files they came from.
              </p>
            )}
            {chatMessages.map((m, i) => (
              <Bubble key={i} message={m} onSourceClick={selectFile} />
            ))}
            {sending && (
              <div className="flex items-center gap-1.5 self-start bg-chat-ai border-l-2 border-accent rounded-btn px-3 py-2">
                <Loader2 size={12} className="animate-spin text-accent" />
                <span className="text-xs text-text-secondary">thinking...</span>
              </div>
            )}
          </div>

          <div className="px-4 py-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-xs border border-border rounded-pill px-3 py-1.5 text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask a question about this repo..."
              className="flex-1 font-mono text-sm bg-bg border border-border rounded-btn px-3 py-2 text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none"
            />
            <button
              onClick={() => send()}
              disabled={sending || !input.trim()}
              className="shrink-0 bg-accent hover:bg-accent-hover disabled:bg-text-disabled text-white rounded-btn p-2.5 transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ message, onSourceClick }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-btn px-3 py-2 text-sm ${
          isUser ? "bg-chat-user text-white" : "bg-chat-ai text-text-primary border-l-2 border-accent"
        }`}
      >
        <p className="leading-relaxed">{message.content}</p>
        {!isUser && message.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.sources.map((s) => (
              <button
                key={s}
                onClick={() => onSourceClick(s)}
                className="flex items-center gap-1 text-[11px] font-mono bg-surface border border-border rounded-pill px-2 py-1 text-text-secondary hover:text-accent hover:border-accent transition-colors"
              >
                <FileCode2 size={10} />
                {s.split("/").pop()}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
