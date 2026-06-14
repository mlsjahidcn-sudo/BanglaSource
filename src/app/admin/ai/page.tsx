import { AdminPage, AdminPageHeader } from "@/components/admin-page";
import { AiChatClient } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "AI Ops Chat · Admin",
};

export default function AdminAiPage() {
  return (
    <AdminPage size="narrow">
      <AdminPageHeader
        eyebrow="Intelligence"
        title="AI Ops Chat"
        dotColor="emerald"
        subtitle="Ask questions about the catalog, traffic, and AI usage in plain English. The assistant calls live database tools and reasons over the results. Powered by DeepSeek V4-Pro."
      />
      <AiChatClient />
    </AdminPage>
  );
}
