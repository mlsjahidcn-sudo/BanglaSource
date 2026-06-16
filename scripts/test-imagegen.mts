import OpenAI from "openai";
import fs from "fs";

const client = new OpenAI({
  apiKey: "sk-sUkjXHvd2VELXl1BOTLNNrTWXiP1cR2D78z6qdl8PZclTSm1",
  baseURL: "https://apinebula.com/v1",
});

// 2 reference images
const dl1 = await fetch("https://picsum.photos/seed/bsimage1/600/600.jpg");
const dl2 = await fetch("https://picsum.photos/seed/bsimage2/600/600.jpg");
const buf1 = Buffer.from(await dl1.arrayBuffer());
const buf2 = Buffer.from(await dl2.arrayBuffer());

const f1 = new File([buf1], "ref1.png", { type: "image/png" });
const f2 = new File([buf2], "ref2.png", { type: "image/png" });

// Also try n=2
try {
  const r = await client.images.edit({
    model: "gpt-image-2-vip",
    image: [f1, f2],
    prompt: "Product photography, soft natural lighting, on a white marble surface, professional ecommerce listing, 4K, sharp focus",
    size: "1024x1024",
    n: 2,
    response_format: "b64_json",
  } as any);
  const items = (r as any).data ?? [];
  console.log("Got", items.length, "images");
  for (let i = 0; i < items.length; i++) {
    fs.writeFileSync(`/tmp/gptimg-multi-${i}.png`, Buffer.from(items[i].b64_json, "base64"));
    console.log(`  saved /tmp/gptimg-multi-${i}.png (${fs.statSync(`/tmp/gptimg-multi-${i}.png`).size} bytes)`);
  }
} catch (e) {
  console.log("ERR:", e instanceof Error ? e.message.slice(0, 300) : e);
  if (e instanceof Error && (e as any).error) {
    console.log("  body:", JSON.stringify((e as any).error).slice(0, 500));
  }
}
