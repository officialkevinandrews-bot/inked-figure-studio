import { describe, expect, it } from "vitest";
import {
  buildFeedbackItem,
  buildUpdatedFeedbackStatus,
  buildUpdatedFeedbackWithReply,
  canDeleteFeedbackItem,
  countFeedbackSummary,
  formatDeviceContext,
  isValidScreenshotDataUrl,
  MAX_SCREENSHOT_DATA_URL_LENGTH,
  normalizeFeedbackItem,
} from "./feedback";

const kevinMain = {
  uid: "uid-kevin-1",
  email: "officialkevinandrews@gmail.com",
  displayName: "Kevin",
};

const kevinAlt = {
  uid: "uid-kevin-2",
  email: "careerdrivenkevin@gmail.com",
  displayName: "Kevin Alt",
};

const craig = {
  uid: "uid-craig",
  email: "craigrees@hotmail.com",
  displayName: "Craig",
};

const guest = {
  uid: "uid-guest",
  email: "assistant@example.com",
  displayName: "Guest",
};

describe("feedback board helpers", () => {
  it("builds valid feedback items adhering to Firestore schema constraints", () => {
    const item = buildFeedbackItem(
      {
        type: "bug",
        priority: "high",
        area: "Manga Panels",
        title: "  Panel border overlaps balloon tail  ",
        description: "Happens on slanted panels after diagonal cut.",
        deviceInfo: formatDeviceContext({
          area: "Manga Panels",
          width: 1280,
          height: 800,
          tier: "desktop",
          isTouch: false,
        }),
        screenshotDataUrl: "data:image/jpeg;base64,/9j/4AAQ",
      },
      craig,
      1700000000000,
    );

    expect(item.id).toMatch(/^bug-/);
    expect(item.title).toBe("Panel border overlaps balloon tail");
    expect(item.status).toBe("open");
    expect(item.authorUid).toBe("uid-craig");
    expect(item.authorEmail).toBe("craigrees@hotmail.com");
    expect(item.deviceInfo).toBe("Manga Panels · 1280x800 · desktop · mouse");
    expect(item.replies).toEqual([]);
    expect(item.createdAt).toBe(1700000000000);
    expect(item.updatedAt).toBe(1700000000000);
  });

  it("rejects empty titles or oversized / non-image screenshot data URLs", () => {
    expect(() =>
      buildFeedbackItem(
        { type: "feedback", priority: "low", area: "Other", title: "   ", description: "" },
        kevinMain,
      ),
    ).toThrow(/title/i);

    const oversized = `data:image/jpeg;base64,${"A".repeat(MAX_SCREENSHOT_DATA_URL_LENGTH + 1)}`;
    expect(isValidScreenshotDataUrl(oversized)).toBe(false);
    expect(isValidScreenshotDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);

    expect(() =>
      buildFeedbackItem(
        {
          type: "bug",
          priority: "medium",
          area: "Manga Panels",
          title: "Broken screenshot",
          description: "",
          screenshotDataUrl: oversized,
        },
        kevinMain,
      ),
    ).toThrow(/Screenshot/i);
  });

  it("preserves immutable author/createdAt fields when updating status or adding replies", () => {
    const initial = buildFeedbackItem(
      {
        type: "feature",
        priority: "medium",
        area: "3D Pose Studio",
        title: "Add sword grip preset",
        description: "Would speed up action scenes.",
      },
      craig,
      1000,
    );

    const replied = buildUpdatedFeedbackWithReply(initial, "Working on this tonight!", kevinAlt, 2000);
    expect(replied.id).toBe(initial.id);
    expect(replied.authorUid).toBe(initial.authorUid);
    expect(replied.authorEmail).toBe(initial.authorEmail);
    expect(replied.createdAt).toBe(initial.createdAt);
    expect(replied.updatedAt).toBe(2000);
    expect(replied.replies).toHaveLength(1);
    expect(replied.replies[0].authorEmail).toBe("careerdrivenkevin@gmail.com");

    const done = buildUpdatedFeedbackStatus(replied, "done", 3000);
    expect(done.status).toBe("done");
    expect(done.authorUid).toBe(initial.authorUid);
    expect(done.updatedAt).toBe(3000);
  });

  it("applies delete permissions matching Firestore security rules", () => {
    const craigPost = buildFeedbackItem(
      { type: "bug", priority: "low", area: "Other", title: "Minor typo", description: "" },
      craig,
    );
    const guestPost = buildFeedbackItem(
      { type: "feedback", priority: "low", area: "Other", title: "Nice app", description: "" },
      guest,
    );

    expect(canDeleteFeedbackItem(craigPost, craig.email, craig.uid)).toBe(true);
    expect(canDeleteFeedbackItem(craigPost, kevinMain.email, kevinMain.uid)).toBe(true);
    expect(canDeleteFeedbackItem(craigPost, kevinAlt.email, kevinAlt.uid)).toBe(true);
    expect(canDeleteFeedbackItem(craigPost, guest.email, guest.uid)).toBe(false);
    expect(canDeleteFeedbackItem(guestPost, guest.email, guest.uid)).toBe(true);
  });

  it("computes open and unread counts accurately across collaborator profiles", () => {
    const fromCraig = buildFeedbackItem(
      { type: "bug", priority: "high", area: "Grid Importer", title: "Diagonal cut gap", description: "" },
      craig,
      5000,
    );
    const fromKevin = buildFeedbackItem(
      { type: "feature", priority: "low", area: "Manga Panels", title: "Add sepia tone", description: "" },
      kevinMain,
      6000,
    );
    const closedItem = buildUpdatedFeedbackStatus(
      buildFeedbackItem(
        { type: "feedback", priority: "low", area: "Other", title: "Fixed header", description: "" },
        craig,
        1000,
      ),
      "done",
      2000,
    );

    const summaryForKevin = countFeedbackSummary(
      [fromCraig, fromKevin, closedItem],
      3000,
      kevinMain.email,
    );
    expect(summaryForKevin.totalCount).toBe(3);
    expect(summaryForKevin.openCount).toBe(2);
    expect(summaryForKevin.doneCount).toBe(1);
    expect(summaryForKevin.unreadCount).toBe(1); // Only Craig's newer post counts as unread for Kevin

    const summaryForKevinAlt = countFeedbackSummary(
      [fromCraig, fromKevin, closedItem],
      3000,
      kevinAlt.email,
    );
    expect(summaryForKevinAlt.unreadCount).toBe(2); // Both posts are newer than 3000 and from other profile emails
  });

  it("normalizes Firestore payloads cleanly and drops malformed entries", () => {
    const valid = buildFeedbackItem(
      { type: "feedback", priority: "medium", area: "Mobile / Tablet", title: "Pinch zoom smooth", description: "Looks good" },
      kevinMain,
      4000,
    );
    const roundtrip = normalizeFeedbackItem({ ...valid, extraIgnored: true });
    expect(roundtrip).toEqual(valid);
    expect(normalizeFeedbackItem({ id: "bad" })).toBeNull();
  });
});
