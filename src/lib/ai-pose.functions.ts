import { createServerFn } from "@tanstack/react-start";
import { sanitizeAiPose, AI_POSE_BONES, type AiPoseResult } from "./ai-pose";

const SYSTEM = `You pose a Mixamo humanoid for manga panels. Output ONLY JSON: {"bones":{"BoneName":[x,y,z],...},"hipsDrop":number,"note":"short text"}.
Rotations are Euler DEGREES offsets over a T-pose, in the character's model frame: Y up, character faces +Z, character's LEFT is +X.
Conventions (left side; mirror right side by negating y and z):
- LeftArm z=-75 lowers arm to side; z=+20 raises above shoulder; x=+60 swings arm forward, x=-25 back.
- LeftForeArm y=-110 bends elbow forward (fists to chest); z=70 bends elbow up.
- RightArm z=+75 lowers right arm; RightForeArm y=+110 bends right elbow.
- LeftUpLeg x=-70 lifts thigh forward; x=+25 swings leg back. LeftLeg x=+90 bends knee.
- Spine/Spine1/Spine2 x=+15 leans forward, y twists, z side-bend. Head x=-25 looks up, +x looks down, y turns head.
- Fingers: LeftHandIndex1..3 z=-85 curls to fist (right side z=+85). Thumb: LeftHandThumb1 [0,30,-40].
- hipsDrop: metres to lower hips on 1.8m body (0.4 crouch, 0.9 sitting on floor, negative = jump).
Allowed bones: ${AI_POSE_BONES.join(", ")}. Keep values within -180..180 and anatomically plausible. Include fingers when hands matter.`;

function textOf(r: unknown): string {
  const o = r as { output_text?: string; output?: { content?: { text?: string }[] }[] };
  if (typeof o.output_text === "string" && o.output_text) return o.output_text;
  return (o.output ?? []).flatMap((i) => i.content ?? []).map((c) => c.text ?? "").join("");
}

export const generateAiPose = createServerFn({ method: "POST" })
  .inputValidator((d: { prompt: string; current?: { bones: Record<string, unknown>; hipsDrop: number } | null }) => {
    const prompt = String(d?.prompt ?? "").trim().slice(0, 500);
    if (!prompt) throw new Error("Describe a pose first.");
    const current = d?.current ? sanitizeAiPose({ bones: d.current.bones, hipsDrop: d.current.hipsDrop }) : null;
    return { prompt, current };
  })
  .handler(async ({ data }): Promise<{ variations: AiPoseResult[] } | { error: string }> => {
    const { generateResponse, GatewayError, RateLimitError, PaymentRequiredError } = await import("@lovable.dev/ai-gateway");
    const flavours = ["the most natural reading", "a more dramatic, exaggerated manga version", "a distinct alternative interpretation"];
    const base = data.current
      ? `CURRENT POSE (keep everything not mentioned exactly as is; return only bones you change plus hipsDrop): ${JSON.stringify({ bones: data.current.bones, hipsDrop: data.current.hipsDrop })}\nEdit: ${data.prompt}`
      : `Pose: ${data.prompt}`;
    try {
      const results = await Promise.allSettled(flavours.map(async (f) => {
        const res = await generateResponse({ model: "openai/gpt-6-astra", instructions: SYSTEM, input: `${base}\nVariation style: ${f}.` });
        const raw = textOf(res);
        const r = sanitizeAiPose(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
        if (data.current) {
          const o = raw.includes('"hipsDrop"') ? r.hipsDrop : data.current.hipsDrop;
          return { ...r, bones: { ...data.current.bones, ...r.bones }, hipsDrop: o };
        }
        return r;
      }));
      const ok = results.filter((r): r is PromiseFulfilledResult<AiPoseResult> => r.status === "fulfilled" && Object.keys(r.value.bones).length > 0).map((r) => r.value);
      if (!ok.length) { const bad = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined; throw bad?.reason ?? new Error("empty"); }
      return { variations: ok };
    } catch (e) {
      console.error("ai pose failed", e);
      if (e instanceof RateLimitError) return { error: "Too many requests right now, try again in a moment." };
      if (e instanceof PaymentRequiredError) return { error: "AI credits have run out for this workspace." };
      if (e instanceof GatewayError) return { error: "The AI service couldn't make that pose. Try again." };
      return { error: "The AI reply couldn't be read as a pose. Try rewording." };
    }
  });
