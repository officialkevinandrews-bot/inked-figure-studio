import { describe, expect, it } from "vitest";
import {
  DEFAULT_TAIL_WIDTH,
  MAX_BALLOON_TAILS,
  addBalloonTail,
  balloonPatchWithTails,
  balloonPathFromSpec,
  buildBalloonRenderGeometry,
  buildThoughtCirclesForTail,
  defaultCurveControlForTail,
  getBalloonTails,
  supportsBalloonTails,
  type SpeechBalloon,
} from "./manga-effects";

function makeBaseBalloon(overrides: Partial<SpeechBalloon> = {}): SpeechBalloon {
  return {
    id: "balloon-test",
    panelId: "p-1",
    shape: "oval",
    text: "Together!",
    x: 100,
    y: 120,
    width: 180,
    height: 110,
    hasTail: true,
    tailX: -36,
    tailY: 94,
    fontSize: 16,
    backgroundColor: "#ffffff",
    zIndex: 100,
    ...overrides,
  };
}

describe("Multi-tail speech & thought balloons", () => {
  it("migrates legacy single and secondary tails and lets explicit tails[] take precedence", () => {
    const legacyDual = makeBaseBalloon({
      tailCurved: true,
      tailCurveX: -12,
      tailCurveY: 50,
      hasSecondaryTail: true,
      secondaryTail: { x: 48, y: 92, curved: false },
    });
    const migrated = getBalloonTails(legacyDual);
    expect(migrated).toHaveLength(2);
    expect(migrated[0]).toMatchObject({ x: -36, y: 94, curved: true, curveX: -12, curveY: 50 });
    expect(migrated[1]).toMatchObject({ x: 48, y: 92, curved: false });

    const withExplicitEmpty = makeBaseBalloon({
      hasTail: true,
      tails: [],
    });
    expect(getBalloonTails(withExplicitEmpty)).toEqual([]);

    const withExplicitThree = makeBaseBalloon({
      tails: [
        { id: "a", x: -40, y: 80, curved: false, width: 24 },
        { id: "b", x: 40, y: 80, curved: true, width: 18 },
        { id: "c", x: 95, y: 10, curved: false, width: 20 },
      ],
    });
    expect(getBalloonTails(withExplicitThree).map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("fans new tails outward in distinct directions and enforces the 6-tail cap", () => {
    let balloon = makeBaseBalloon({
      tails: [{ id: "t-0", x: -45, y: 85, curved: false, width: DEFAULT_TAIL_WIDTH }],
    });

    const angles = [Math.atan2(85, -45)];
    for (let step = 1; step < MAX_BALLOON_TAILS; step++) {
      const patch = addBalloonTail(balloon);
      expect(patch).not.toBeNull();
      balloon = { ...balloon, ...patch! };
      const tails = getBalloonTails(balloon);
      expect(tails).toHaveLength(step + 1);
      const newest = tails[tails.length - 1];
      const newestAngle = Math.atan2(newest.y, newest.x);
      // Every newly fanned tail must avoid stacking closely on top of existing ones
      for (const prevAngle of angles) {
        let diff = Math.abs(newestAngle - prevAngle) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        expect(diff).toBeGreaterThan(0.35);
      }
      angles.push(newestAngle);
    }

    expect(getBalloonTails(balloon)).toHaveLength(6);
    expect(addBalloonTail(balloon)).toBeNull();
    expect(supportsBalloonTails("narration")).toBe(false);
    expect(supportsBalloonTails("box")).toBe(false);
    expect(supportsBalloonTails("icy")).toBe(false);
    expect(addBalloonTail(makeBaseBalloon({ shape: "narration" }))).toBeNull();
  });

  it("supports per-tail curve toggles, custom width, and deletes individual tails cleanly", () => {
    const balloon = makeBaseBalloon({
      tails: [
        { id: "t1", x: -50, y: 90, curved: true, curveX: -10, curveY: 55, width: 32 },
        { id: "t2", x: 55, y: 88, curved: false, width: 16 },
        { id: "t3", x: 110, y: 5, curved: true, width: 20 },
      ],
    });

    const autoCtrl = defaultCurveControlForTail({ x: 110, y: 5 });
    expect(Math.hypot(autoCtrl.x - 110 * 0.55, autoCtrl.y - 5 * 0.55)).toBeGreaterThanOrEqual(21);

    const geom = buildBalloonRenderGeometry(balloon);
    expect(geom.pointedTailPaths).toHaveLength(3);
    expect(geom.thoughtCircles).toHaveLength(0);
    // Custom tail widths produce distinct root geometry widths between t1 (32px) and t2 (16px)
    expect(geom.pointedTailPaths[0]).not.toEqual(geom.pointedTailPaths[1]);

    // Deleting middle tail preserves first and third intact and syncs legacy fields
    const afterDelete = {
      ...balloon,
      ...balloonPatchWithTails(
        balloon,
        getBalloonTails(balloon).filter((t) => t.id !== "t2"),
      ),
    };
    const remaining = getBalloonTails(afterDelete);
    expect(remaining.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(afterDelete.hasTail).toBe(true);
    expect(afterDelete.hasSecondaryTail).toBe(true);
    expect(afterDelete.secondaryTail?.id).toBe("t3");

    // Removing all tails clears hasTail cleanly
    const noTailsPatch = balloonPatchWithTails(afterDelete, []);
    expect(noTailsPatch.hasTail).toBe(false);
    expect(noTailsPatch.hasSecondaryTail).toBe(false);
    expect(noTailsPatch.tails).toEqual([]);
  });

  it("renders descending trailing thought circles for multi-tail cloud balloons", () => {
    const cloudBalloon = makeBaseBalloon({
      shape: "cloud",
      tails: [
        { id: "c1", x: -65, y: 95, curved: false, width: 24 },
        { id: "c2", x: 70, y: 92, curved: true, curveX: 48, curveY: 72, width: 30 },
      ],
    });

    const geom = buildBalloonRenderGeometry(cloudBalloon);
    expect(geom.pointedTailPaths).toHaveLength(0);
    expect(geom.thoughtCircles).toHaveLength(6);

    const circlesTail1 = buildThoughtCirclesForTail(180, 110, cloudBalloon.tails![0]);
    expect(circlesTail1).toHaveLength(3);
    // Strictly descending circle sizes from cloud toward speaker
    expect(circlesTail1[0].r).toBeGreaterThan(circlesTail1[1].r);
    expect(circlesTail1[1].r).toBeGreaterThan(circlesTail1[2].r);

    const fullPath = balloonPathFromSpec(cloudBalloon);
    // 1 body + 6 thought circles = 7 M commands
    expect((fullPath.match(/\bM /g) ?? []).length).toBe(7);
  });
});
