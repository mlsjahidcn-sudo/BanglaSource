"use client";
// /admin/ai/_client.tsx
//
// Chat UI. Sends the full conversation history on each turn and
// consumes an SSE stream of events from POST /api/ai/chat.
//
// Event types from the server:
//   { type: "tool", name, args }              ← LLM is calling a tool
//   { type: "tool_result", name, ok, error }  ← tool finished
//   { type: "text", delta }                   ← assistant final text
//   { type: "done", usage, cost }             ← end of turn
//   { type: "error", error }
//
// The UI surfaces the tool calls as collapsible chips so the admin
// can see what the assistant did. The final answer is the markdown-
// like text the assistant produced.

import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant" | "tool";

type ToolEvent = {
  type: "tool" | "tool_result";
  name: string;
  args?: Record<string, unknown>;
  ok?: boolean;
  error?: string;
};

type Message = {
  id: string;
  role: Role;
  // For user/assistant: text content. For tool: the events array.
  content?: string;
  tools?: ToolEvent[];
  cost?: number;
  inputTokens?: number;
  outputTokens?: number;
  pending?: boolean;
};

const STARTER_PROMPTS = [
  "What's our best-selling category right now?",
  "Show me products with MOQ under 5 across all categories.",
  "What are the top 10 most-viewed pages in the last 14 days?",
  "How much have we spent on AI so far?",
  "How is the BanglaSource catalog doing overall?",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function AiChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom on new content
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  async function send(text: string) {
    const userText = text.trim();
    if (!userText || busy) return;
    setError(null);
    const userMsg: Message = { id: uid(), role: "user", content: userText };
    const aMsgId = uid();
    const aMsg: Message = {
      id: aMsgId,
      role: "assistant",
      content: "",
      tools: [],
      pending: true,
    };
    setMessages((cur) => [...cur, userMsg, aMsg]);
    setInput("");
    setBusy(true);

    // Build the messages payload: just user/assistant turns.
    // The server maintains a system prompt and tool-call records itself.
    const payload = [...messages, userMsg]
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content ?? "" }));

    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? `HTTP ${r.status}`);
        setBusy(false);
        setMessages((cur) =>
          cur.map((m) => (m.id === aMsgId ? { ...m, pending: false } : m)),
        );
        return;
      }
      if (!r.body) {
        setError("no_response_body");
        setBusy(false);
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        // SSE frames are separated by `\n\n`
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!frame.startsWith("data: ")) continue;
          let evt: {
            type: string;
            name?: string;
            args?: Record<string, unknown>;
            ok?: boolean;
            error?: string;
            delta?: string;
            usage?: { input_tokens: number; output_tokens: number };
            cost?: number;
          };
          try {
            evt = JSON.parse(frame.slice(6));
          } catch {
            continue;
          }
          // Apply the event to the in-flight assistant message
          setMessages((cur) =>
            cur.map((m) => {
              if (m.id !== aMsgId) return m;
              if (evt.type === "tool") {
                return {
                  ...m,
                  tools: [
                    ...(m.tools ?? []),
                    {
                      type: "tool",
                      name: evt.name ?? "?",
                      args: evt.args,
                    },
                  ],
                };
              }
              if (evt.type === "tool_result") {
                // Find the matching pending tool by name and merge
                const tools = [...(m.tools ?? [])];
                for (let i = tools.length - 1; i >= 0; i -= 1) {
                  if (
                    tools[i].type === "tool" &&
                    tools[i].name === evt.name &&
                    tools[i].ok === undefined
                  ) {
                    tools[i] = { ...tools[i], ok: evt.ok, error: evt.error };
                    break;
                  }
                }
                return { ...m, tools };
              }
              if (evt.type === "text" && typeof evt.delta === "string") {
                return { ...m, content: (m.content ?? "") + evt.delta };
              }
              if (evt.type === "done") {
                return {
                  ...m,
                  pending: false,
                  cost: evt.cost,
                  inputTokens: evt.usage?.input_tokens,
                  outputTokens: evt.usage?.output_tokens,
                };
              }
              if (evt.type === "error") {
                return { ...m, content: (m.content ?? "") + `\n\n[error: ${evt.error}]`, pending: false };
              }
              return m;
            }),
          );
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setMessages((cur) =>
        cur.map((m) => (m.id === aMsgId ? { ...m, pending: false } : m)),
      );
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[520px] rounded-lg border border-border bg-bg overflow-hidden">
      {/* Messages */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="card p-6 text-center bg-slate-50 border-dashed">
              <p className="text-[15px] font-medium">Start a conversation</p>
              <p className="mt-1 text-[13px] text-fg-muted max-w-md mx-auto">
                The assistant has access to live data: catalog, traffic, AI
                usage. Try one of the prompts below, or ask your own.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-full border border-border bg-bg hover:bg-slate-50 text-[12.5px] text-fg disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} />
        ))}

        {error && (
          <p className="text-[12px] text-rose-600 font-mono px-2">error: {error}</p>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="border-t border-border p-3 bg-bg-soft"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            placeholder="Ask about catalog, traffic, orders, AI costs…"
            rows={1}
            disabled={busy}
            className="flex-1 px-3 py-2 bg-bg border border-border rounded-md text-[13.5px] outline-none focus:border-border-strong resize-none max-h-32 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="h-9 px-4 rounded-md bg-cyan-600 text-white text-[13px] font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
        <p className="mt-1.5 text-[10.5px] text-fg-subtle px-1">
          Press <kbd className="font-mono px-1 border border-border rounded">Enter</kbd> to send, <kbd className="font-mono px-1 border border-border rounded">Shift+Enter</kbd> for newline.
        </p>
      </form>
    </div>
  );
}

function MessageBubble({ m }: { m: Message }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-cyan-600 text-white text-[13.5px] leading-relaxed">
          {m.content}
        </div>
      </div>
    );
  }
  if (m.role === "assistant") {
    return (
      <div className="flex flex-col gap-2 max-w-[90%]">
        {/* Tool call chips (collapsible) */}
        {m.tools && m.tools.length > 0 && (
          <details className="text-[11.5px] text-fg-muted">
            <summary className="cursor-pointer hover:text-fg list-none flex items-center gap-1.5">
              <span className="font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-border">
                {m.tools.length} tool{m.tools.length === 1 ? "" : "s"}
              </span>
              <span className="text-fg-subtle">
                {m.tools
                  .map((t) => (t.ok === false ? `✗ ${t.name}` : `✓ ${t.name}`))
                  .join(" · ")}
              </span>
            </summary>
            <div className="mt-1.5 ml-1 space-y-1.5">
              {m.tools.map((t, i) => (
                <div
                  key={i}
                  className="font-mono text-[10.5px] px-2 py-1 rounded bg-slate-50 border border-border"
                >
                  <span
                    className={
                      t.ok === false
                        ? "text-rose-600"
                        : t.ok
                          ? "text-emerald-700"
                          : "text-amber-700"
                    }
                  >
                    {t.ok === false ? "✗" : t.ok ? "✓" : "⏳"} {t.name}
                  </span>
                  {t.args && (
                    <span className="text-fg-subtle ml-1.5">
                      {JSON.stringify(t.args)}
                    </span>
                  )}
                  {t.error && (
                    <span className="text-rose-600 ml-1.5">{t.error}</span>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Final answer */}
        <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-slate-50 border border-border text-[13.5px] leading-relaxed whitespace-pre-wrap">
          {m.content || (m.pending ? "Thinking…" : "")}
        </div>

        {/* Cost / token footer */}
        {m.cost !== undefined && !m.pending && (
          <div className="text-[10.5px] text-fg-subtle font-mono px-1.5">
            V4-Pro · {m.inputTokens ?? 0}→{m.outputTokens ?? 0} tokens · ${m.cost.toFixed(4)}
          </div>
        )}
      </div>
    );
  }
  return null;
}
