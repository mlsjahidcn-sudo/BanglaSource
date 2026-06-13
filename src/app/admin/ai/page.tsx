import { Container } from "@/components/ui/container";
import { AiChatClient } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "AI Ops Chat · Admin",
};

export default function AdminAiPage() {
  return (
    <Container className="py-8 max-w-4xl">
      <div className="mb-6">
        <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
          Intelligence
        </p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.01em]">
          AI Ops Chat
        </h1>
        <p className="mt-1.5 text-[13px] text-fg-muted max-w-2xl">
          Ask questions about the catalog, traffic, and AI usage in plain
          English. The assistant calls live database tools and reasons over the
          results. Powered by DeepSeek V4-Pro.
        </p>
      </div>

      <AiChatClient />
    </Container>
  );
}
