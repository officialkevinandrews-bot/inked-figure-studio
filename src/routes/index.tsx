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
      { title: "Inked Manga Studio — Panels, Characters & 3D Posing" },
      { name: "description", content: "Create manga pages with custom panels, speech balloons, tones, and 3D character posing." },
      { property: "og:title", content: "Inked Manga Studio — Panels, Characters & 3D Posing" },
      { property: "og:description", content: "Create manga pages with custom panels, speech balloons, tones, and 3D character posing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioEntry,
});
