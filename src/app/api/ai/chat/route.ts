// POST /api/ai/chat
//
// Admin Ops Chat. Streaming response (SSE), DeepSeek V4-Pro with
// tool-calling. The admin types a question like "what's our
// best-selling category this month?"; we send it to V4-Pro with
// our tool definitions, run any tools it picks, feed the results
// back, and stream the final natural-language answer.
//
// Auth: admin only. Uses the existing requireAdminApi() helper
// from /lib/portal-auth.
//
// Rate limit: 20 turns/min per admin user (LLM calls are expensive).
//
// Idempotency: every turn logs an `ai_runs` row with kind='ops_chat'
// for cost tracking. The conversation history is per-request (not
// stored on the server); the client sends the full thread each turn.
//
// Wire format: the route streams Server-Sent Events:
//   data: {"type":"tool","name":"top_products","args":{...}}\n\n
//   data: {"type":"text","delta":"We have 166..."}\n\n
//   data: {"type":"done","usage":{...},"cost":0.0012}\n\n
//
// This is a non-standard SSE shape but it's simple, the client can
// just JSON.parse each frame, and it doesn't need a JS-side parser.

import { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { deepseekChat, logAiRun } from "@/lib/deepseek";
import { runTool, toolSchemaForLLM, ToolName } from "@/lib/ai-tools";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const MAX_TURNS = 8; // safety: at most 8 model calls per user turn
const MAX_HISTORY = 12; // trim conversation to last 12 messages

const SYSTEM = `You are the BanglaSource Admin Ops Assistant. You answer questions about the catalog, traffic, and AI usage by calling the provided tools and reasoning over the results.

Rules:
- Call a tool whenever the question is about real data. Don't guess numbers.
- If multiple tools are needed, call them in sequence; you can call up to 5 tools per turn.
- Always show actual product names, IDs, and counts from the tool output.
- Currency: BDT (৳). Conversion from fen: 1 fen = 0.1685 BDT.
- Categories: gadgets, eyewear, shoes, bags, watches, beauty, jewelry.
- If the user asks something you can't answer with the available tools, say so directly.
- Format numbers with thousands separators; format dates as YYYY-MM-DD.
- Keep the answer tight: short intro, bullet list or table, brief takeaway. Don't pad.
- If the user asks for an action (e.g. "delete product X"), respond with the action plan and a link to the relevant admin page; don't claim to do it.`;

type ClientMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = auth.user.id;
  const userEmail = auth.user.email;

  // Rate limit per admin user
  const rl = rateLimit({
    key: `ai.chat:${userId}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ ok: false, error: "rate_limited" }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "deepseek_not_configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { messages?: ClientMessage[] } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "invalid_json" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  if (incoming.length === 0) {
    return new Response(
      JSON.stringify({ ok: false, error: "empty_messages" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  // Trim to the last MAX_HISTORY messages
  const trimmed = incoming.slice(-MAX_HISTORY);
  const messages: ClientMessage[] = [
    { role: "system", content: SYSTEM },
    ...trimmed,
  ];

  // Make sure the last message is a user turn
  const lastUserIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") return i;
    }
    return -1;
  })();
  if (lastUserIdx < 0) {
    return new Response(
      JSON.stringify({ ok: false, error: "no_user_message" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Open an SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Total cost across the loop
      let totalCost = 0;
      let totalIn = 0;
      let totalOut = 0;
      let finalText = "";
      let lastUserText = "";
      for (const m of messages) {
        if (m.role === "user" && m.content) lastUserText = m.content;
      }

      // Agent loop: send to V4-Pro with tools, run any tool calls,
      // append results, and continue until the model produces a
      // plain text message (no more tool_calls).
      const toolSchemas = toolSchemaForLLM();
      for (let turn = 0; turn < MAX_TURNS; turn += 1) {
        let resp;
        try {
          resp = await deepseekChat(messages, {
            model: "deepseek-v4-pro",
            maxTokens: 4096,
            temperature: 1.0,
            tools: toolSchemas,
          });
        } catch (e) {
          send({ type: "error", error: (e as Error).message });
          controller.close();
          return;
        }
        totalCost += resp.costUsd;
        totalIn += resp.inputTokens;
        totalOut += resp.outputTokens;
        // Pull the raw assistant message so we can read tool_calls
        const raw = resp.raw as {
          choices: Array<{
            message: {
              role: "assistant";
              content?: string | null;
              tool_calls?: Array<{
                id: string;
                type: "function";
                function: { name: string; arguments: string };
              }>;
            };
            finish_reason?: string;
          }>;
        };
        const aMsg = raw.choices?.[0]?.message;
        if (!aMsg) {
          send({ type: "error", error: "no_assistant_message" });
          controller.close();
          return;
        }
        const toolCalls = aMsg.tool_calls ?? [];

        // Append the assistant message to the conversation
        messages.push({
          role: "assistant",
          content: aMsg.content ?? "",
          ...(toolCalls.length > 0
            ? { tool_calls: toolCalls }
            : {}),
        });

        if (toolCalls.length === 0) {
          // Final answer — stream it as text deltas (the model
          // returns the full content; we send it in one chunk,
          // which is fine for V4-Pro).
          finalText = aMsg.content ?? "";
          if (finalText) send({ type: "text", delta: finalText });
          break;
        }

        // Execute each tool call sequentially and emit a `tool` event
        for (const call of toolCalls) {
          const name = call.function.name as ToolName;
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(call.function.arguments);
          } catch {
            parsedArgs = {};
          }
          send({ type: "tool", name, args: parsedArgs });
          const result = await runTool(name, parsedArgs);
          send({ type: "tool_result", name, ok: result.ok, error: result.error });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name,
            content: JSON.stringify(result.result ?? null).slice(0, 8000),
          });
        }
      }

      // Persist the run
      try {
        const supabase = getServiceRoleClient();
        await supabase.from("ai_runs").insert({
          kind: "ops_chat",
          model: "deepseek-v4-pro",
          source_table: null,
          source_id: userId,
          source_hash: null,
          input_tokens: totalIn,
          output_tokens: totalOut,
          cost_usd: totalCost,
          output: {
            user_email: userEmail,
            last_user_text: lastUserText.slice(0, 500),
            turns: messages.length,
            final_text_chars: finalText.length,
          },
        });
      } catch {
        // ignore
      }

      send({
        type: "done",
        usage: { input_tokens: totalIn, output_tokens: totalOut },
        cost: Math.round(totalCost * 10000) / 10000,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
