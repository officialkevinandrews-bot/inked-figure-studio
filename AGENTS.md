<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Pose offsets are Euler degrees in the character's model frame (Y up, faces +Z, left = +X) applied over the rest pose via `src/lib/rig.ts`; this keeps presets rig-agnostic across Mixamo bone rolls and makes mirroring a simple (x,-y,-z) swap.
- The viewport renders through three's OutlineEffect in a priority-1 useFrame (with manual clear); don't add a second renderer or EffectComposer without replacing it.
- Facial expressions are one procedurally drawn 512px canvas decal (`src/lib/face-draw.ts`) on a bent plane that follows the Head bone with its rest rotation removed (`FaceRig.tsx`); expressions map to per-part states in `src/lib/face-library.ts`, so single-mesh models need no face bones or blendshapes.
- Hair, clothes and accessories are pure-data pieces in `src/lib/wardrobe.ts` (`seg` = tapered capsule stretched between two bones, `shape` = primitive riding one bone's rest-removed frame), built each frame by `WardrobeRig.tsx`; imported skinned .glb/.fbx clothing is rebound to the character's bones by Mixamo name (AttachedBindMode), rigid imports anchor to the slot's bone. This keeps items rig-agnostic and pose-following without per-model setup.
- Custom face packs: a neutral face on the 1024px template (`TEMPLATE_BOXES` in `src/lib/face-parts.ts`) is sliced into six part sprites stored in localStorage; `drawPackParts` bends them per expression state via the EYE/BROW/MOUTH_MORPH tables, so artists only draw the neutral face.
- Outfit extraction (`src/lib/outfit-extract.ts`) splits a dressed Mixamo model into islands or bone regions, drops body skin via an optional undressed base model (spatial-hash proximity), and emits SkinnedMeshes that keep the source skeleton so the wardrobe rebinds them by bone name; call `prepSkin` before reading rest-pose vertex positions.
- Characters (`src/lib/characters.ts`) own body, neutral face and numbered outfits (clothes + props); Create Character edits save straight into the character, while Pose Studio changes are temporary and reset when returning to the creator. Uploaded bodies and clothing files live in IndexedDB (`src/lib/file-store.ts`) because localStorage is too small for meshes.
- AI poses go through `generateAiPose` (src/lib/ai-pose.functions.ts) and are always passed through `sanitizeAiPose` so model output can never reach the rig with unknown bones or wild angles.
- Studio backups are one JSON file (characters + face packs + base64 of every referenced IndexedDB file, `src/lib/backup.ts`); restore merges by id and reloads so custom assets rebind.
