import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { Studio } from "@/components/studio/Studio";

function AuthenticatedStudio() {
  const { user, hydrationVersion } = useAuth();
  return <Studio key={`${user?.uid ?? "signed-out"}:${hydrationVersion}`} />;
}

function StudioEntry() {
  return (
    <AuthProvider>
      <AuthGate>
        <AuthenticatedStudio />
      </AuthGate>
    </AuthProvider>
  );
}

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Koma Studio — 3D Manga Posing" },
      { name: "description", content: "Pose Mixamo 3D characters with a manga pose library and cel-shaded ink rendering." },
      { property: "og:title", content: "Koma Studio — 3D Manga Posing" },
      { property: "og:description", content: "Pose Mixamo 3D characters with a manga pose library and cel-shaded ink rendering." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioEntry,
});
