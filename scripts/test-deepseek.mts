// Quick connectivity test for the DeepSeek client.
// Run with:
//   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/test-deepseek.mts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local (tsx doesn't do this automatically for one-off scripts).
// MUST run before the dynamic import of deepseek.ts so process.env is set
// when the module reads DEEPSEEK_API_KEY at top level.
try {
  const envLocal = readFileSync(resolve(".env.local"), "utf8");
  for (const line of envLocal.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // no .env.local; rely on system env
}

const { deepseekChat, deepseekJson, sha256 } = await import(
  "../src/lib/deepseek"
);

(async () => {
  console.log("[1] Basic chat (V4-Flash)…");
  const r1 = await deepseekChat(
    [
      {
        role: "system",
        content: "You are a translator. Output only the translation.",
      },
      { role: "user", content: "Translate to English: 跨境新款Pro6蓝牙耳机真无线入耳式" },
    ],
    { maxTokens: 2048 },
  );
  console.log("    →", r1.content);
  console.log(
    `    in=${r1.inputTokens} out=${r1.outputTokens} cost=$${r1.costUsd.toFixed(6)}`,
  );

  console.log("\n[2] JSON mode…");
  const r2 = await deepseekJson<{ en: string; bn: string }>(
    [
      {
        role: "system",
        content:
          "Translate a Chinese product title to English and Bengali. Return JSON with fields en and bn.",
      },
      { role: "user", content: "跨境新款Pro6蓝牙耳机真无线入耳式" },
    ],
    { maxTokens: 2048 },
  );
  console.log("    en =", r2.en);
  console.log("    bn =", r2.bn);
  console.log(`    cost=$${r2.costUsd.toFixed(6)}`);

  console.log("\n[3] sha256…");
  const h = await sha256("test");
  console.log("    sha256('test') =", h.slice(0, 16) + "…");
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
