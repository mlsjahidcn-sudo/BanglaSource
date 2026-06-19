// /lib/mcp-vision.ts
//
// Server-side wrapper around the matrix MCP `matrix_describe_images`
// tool. Used by the Phase 60 screenshot import flow to extract
// product data from uploaded screenshots.
//
// WHY MCP AND NOT DIRECT API:
//   - We tried apinebula.com (already set up for GPT Image 2) but
//     it only serves the `vip_image2` group — image-generation
//     models only. GPT-4o / GPT-4-vision all return
//     "model_not_found".
//   - DeepSeek doesn't ship vision (DeepSeek-VL2 isn't in our
//     configured models).
//   - The matrix MCP daemon already runs locally and provides
//     vision via `matrix_describe_images`. It supports file/url/
//     base64 inputs and works well for OCR + structured JSON
//     extraction (see scripts/test-screenshot-import.mjs).
//
// SUBPROCESS MODEL:
//   The matrix MCP is stdio-based (started by the local daemon),
//   so we call it via `mavis mcp call matrix matrix_describe_images
//   --file <tmp>`. This adds ~200-500ms of subprocess startup
//   overhead per call. Acceptable for a once-per-upload admin
//   action. If this ever becomes hot (e.g. bulk ingestion), we'll
//   batch or hit the daemon HTTP endpoint directly.
//
// COST: matrix MCP bills through the user's mavis plan. We track
// each call's input tokens via the AI runs table so the admin
// can monitor usage from /admin/ai.

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export type VisionInput = {
  /** Local absolute path to the image. */
  file: string;
  /** Prompt — what to ask the vision model about the image. */
  prompt: string;
};

export type VisionResult = {
  ok: true;
  description: string;
} | {
  ok: false;
  error: string;
  message: string;
};

/**
 * Call matrix MCP's matrix_describe_images via the `mavis` CLI.
 *
 * The CLI signature is:
 *   mavis mcp call <server> <tool> --file <json-path>
 *     --file reads the tool's argument JSON from a file
 *     --stdin reads from stdin (alternative)
 *
 * Output: a JSON object with `results[].description` on success.
 *
 * Note: we DON'T use the `mavis` Node API directly because that
 * lives inside the daemon process — Next.js runs separately and
 * can't share the same in-process registry. Spawning the CLI
 * subprocess is the supported cross-process bridge.
 */
export async function describeImage(input: VisionInput): Promise<VisionResult> {
  const { file, prompt } = input;

  // Write the args JSON to a tmp file. Spawning with --file is
  // cleaner than passing a 100KB+ JSON string via argv (and
  // avoids OS-level argv length limits on some shells).
  const tmpDir = mkdtempSync(join(tmpdir(), "mcp-vision-"));
  const argsFile = join(tmpDir, "args.json");
  const args = {
    image_info: [{ file, prompt }],
  };
  writeFileSync(argsFile, JSON.stringify(args), "utf8");

  // Spawn the CLI. stdout carries the response JSON; stderr is
  // surfaced in error messages so we don't lose context.
  //
  // Retry policy: one automatic retry on timeout (the matrix MCP
  // subprocess can take 5-15s to start up + run, and the first
  // call after a long idle period sometimes hits our 90s budget).
  const MAX_ATTEMPTS = 2;
  let lastErr: VisionResult | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await runMcpCall(argsFile);
    if (result.ok) return result;
    lastErr = result;
    // Only retry on timeout; other failures (parse errors, model
    // rejections) won't get better with another try.
    if (result.error !== "vision_timeout") return result;
    if (attempt < MAX_ATTEMPTS) {
      // Small backoff so we don't hammer the daemon.
      await sleep(1500);
    }
  }
  return lastErr!;
}

async function runMcpCall(argsFile: string): Promise<VisionResult> {
  const child = spawn(
    "/Users/jahidabdullah/.mavis/bin/mavis",
    ["mcp", "call", "matrix", "matrix_describe_images", "--file", argsFile],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  // Collect stdout/stderr with timeouts so a hung daemon doesn't
  // pin the route handler.
  const stdoutP = drain(child.stdout);
  const stderrP = drain(child.stderr);
  const codeP = new Promise<number>((resolve) =>
    child.on("close", (c) => resolve(c ?? -1)),
  );

  // Race the response against a 90s timeout (vision calls usually
  // finish in 5-15s; 90s gives generous headroom for cold-start
  // of the matrix MCP subprocess + slow vision responses).
  const TIMEOUT_MS = 90_000;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("vision_call_timeout")), TIMEOUT_MS),
  );

  let stdout: string;
  let stderr: string;
  let code: number;
  try {
    [stdout, stderr, code] = await Promise.race([
      Promise.all([stdoutP, stderrP, codeP]),
      timeout,
    ]);
  } catch (e) {
    child.kill("SIGKILL");
    return {
      ok: false,
      error: "vision_timeout",
      message: `Vision MCP call timed out after ${TIMEOUT_MS}ms: ${(e as Error).message}`,
    };
  }

  if (code !== 0) {
    return {
      ok: false,
      error: "vision_failed",
      message: `Vision MCP exited with code ${code}. stderr: ${stderr.slice(0, 300)}`,
    };
  }

  // Parse the JSON response. The mavis CLI wraps MCP responses
  // in { results: [{ success, description, error }], base_resp: {...} }
  let parsed: {
    results?: Array<{ success?: boolean; description?: string; error?: string }>;
  };
  try {
    parsed = JSON.parse(stdout);
  } catch (e) {
    return {
      ok: false,
      error: "vision_parse_failed",
      message: `Could not parse MCP stdout as JSON: ${(e as Error).message}. First 200 chars: ${stdout.slice(0, 200)}`,
    };
  }

  const first = parsed.results?.[0];
  if (!first || first.success !== true || typeof first.description !== "string") {
    return {
      ok: false,
      error: first?.error || "vision_no_result",
      message: first?.error || "matrix_describe_images returned no description.",
    };
  }

  return {
    ok: true,
    description: first.description,
  };
}

function drain(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}