import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { Studio } from "@/components/studio/Studio";

function AuthenticatedStudio() {
  const { user, hydrationVersion } = useAuth();
  return <Studio key={`${user?.uid ?? "signed-out"}:${hydrationVersion}`} />;
}

function StudioEntry() {
  return (
    <AuthProvider>
      <AuthGate>
        <FeedbackProvider>
          <AuthenticatedStudio />
          <FeedbackModal />
        </FeedbackProvider>
      </AuthGate>
    </AuthProvider>
  );
}

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MangakaDesk — Manga Panels, Webtoons & Page Layout Studio" },
      { name: "description", content: "Create manga pages with custom panel grids, speech balloons, SFX, screentones, and webtoon scroll." },
      { property: "og:title", content: "MangakaDesk — Manga Panels, Webtoons & Page Layout Studio" },
      { property: "og:description", content: "Create manga pages with custom panel grids, speech balloons, SFX, screentones, and webtoon scroll." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioEntry,
});
