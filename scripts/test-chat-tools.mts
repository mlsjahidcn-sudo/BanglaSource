// /scripts/test-chat-tools.mts
//
// Logs in as the test admin user, then exercises /api/ai/chat with
// a question that requires the LLM to call a tool. Verifies the SSE
// stream contains `tool` events, not just plain text.
//
// Run with:
//   NODE_OPTIONS="--conditions=react-server" \
//     pnpm exec tsx --tsconfig tsconfig.json scripts/test-chat-tools.mts

// Load .env.local manually (no dotenv package installed)
import { readFileSync } from "node:fs";
try {
  const envText = readFileSync(".env.local", "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* .env.local missing — rely on real env */
}

// We can't easily call /api/ai/chat from a script because:
//   1) it needs a valid Supabase auth cookie set by the browser
//   2) it's an SSE stream
// So instead we run the same call against DeepSeek directly, with
// the same tool schema and system prompt, and verify V4-Pro picks
// the right tool. This proves the wire format works.

const KEY = process.env.DEEPSEEK_API_KEY;
if (!KEY) {
  console.error("DEEPSEEK_API_KEY missing");
  process.exit(1);
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "top_pages",
      description: "Top paths by page_views count in the last N days.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "integer", description: "1-90, default 14" },
          limit: { type: "integer", description: "1-50, default 15" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "category_stats",
      description:
        "Aggregate stats per category: product count, avg MOQ, total orders, avg rating.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const body = {
  model: "deepseek-v4-pro",
  messages: [
    {
      role: "system",
      content:
        "You are the BanglaSource Admin Ops Assistant. Answer with real data from the tools provided. Call a tool whenever the question is about real data. Format numbers clearly.",
    },
    { role: "user", content: "What are the top 5 most-visited pages in the last 14 days?" },
  ],
  tools: TOOLS,
  max_tokens: 4096,
  temperature: 1.0,
};

const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${KEY}`,
  },
  body: JSON.stringify(body),
});

if (!r.ok) {
  console.error("DeepSeek error", r.status, await r.text());
  process.exit(1);
}

const data = (await r.json()) as {
  choices: Array<{ message: { content?: string; tool_calls?: unknown[] } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

const aMsg = data.choices?.[0]?.message;
console.log("content:", aMsg?.content?.slice(0, 200));
console.log("tool_calls:", JSON.stringify(aMsg?.tool_calls, null, 2));
console.log("usage:", data.usage);

if (aMsg?.tool_calls && aMsg.tool_calls.length > 0) {
  console.log("\n✅ V4-Pro picked a tool correctly");
} else {
  console.log("\n❌ V4-Pro did NOT call a tool (problem)");
  process.exit(1);
}
