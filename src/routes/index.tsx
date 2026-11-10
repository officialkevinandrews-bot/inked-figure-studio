import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/studio/Studio";

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
  component: Studio,
});
