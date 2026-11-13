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
  .inputValidator((d: { prompt: string }) => {
    const prompt = String(d?.prompt ?? "").trim().slice(0, 500);
    if (!prompt) throw new Error("Describe a pose first.");
    return { prompt };
  })
  .handler(async ({ data }): Promise<AiPoseResult | { error: string }> => {
    const { generateResponse, GatewayError, RateLimitError, PaymentRequiredError } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: SYSTEM,
        input: `Pose: ${data.prompt}`,
      });
      const raw = textOf(res);
      const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      return sanitizeAiPose(json);
    } catch (e) {
      console.error("ai pose failed", e);
      if (e instanceof RateLimitError) return { error: "Too many requests right now, try again in a moment." };
      if (e instanceof PaymentRequiredError) return { error: "AI credits have run out for this workspace." };
      if (e instanceof GatewayError) return { error: "The AI service couldn't make that pose. Try again." };
      return { error: "The AI reply couldn't be read as a pose. Try rewording." };
    }
  });
