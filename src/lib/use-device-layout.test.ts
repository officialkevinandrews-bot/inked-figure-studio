import { describe, expect, it } from "vitest";
import { classifyViewport } from "./use-device-layout";

describe("classifyViewport device & orientation tiers", () => {
  it("keeps standard desktop & Playwright 1280x720 in full 3-column workstation mode", () => {
    const d1 = classifyViewport(1280, 720, false);
    expect(d1.tier).toBe("desktop");
    expect(d1.pinLeftByDefault).toBe(true);
    expect(d1.pinRightByDefault).toBe(true);
    expect(d1.showPagesBarPinned).toBe(true);
    expect(d1.isCompact).toBe(false);

    const d2 = classifyViewport(1440, 900, false);
    expect(d2.tier).toBe("desktop");
  });

  it("pins left tools only and uses overlay inspector on tablet landscape", () => {
    const ipadLand = classifyViewport(1024, 768, true);
    expect(ipadLand.tier).toBe("tablet-landscape");
    expect(ipadLand.orientation).toBe("landscape");
    expect(ipadLand.pinLeftByDefault).toBe(true);
    expect(ipadLand.pinRightByDefault).toBe(false);
    expect(ipadLand.useBottomSheet).toBe(false);
    expect(ipadLand.showPagesBarPinned).toBe(true);
  });

  it("uses slide-over side drawers on tablet portrait", () => {
    const ipadPort = classifyViewport(768, 1024, true);
    expect(ipadPort.tier).toBe("tablet-portrait");
    expect(ipadPort.orientation).toBe("portrait");
    expect(ipadPort.pinLeftByDefault).toBe(false);
    expect(ipadPort.pinRightByDefault).toBe(false);
    expect(ipadPort.useBottomSheet).toBe(false);
    expect(ipadPort.showPagesBarPinned).toBe(false);
  });

  it("uses bottom sheets & collapsible page strip on phone portrait", () => {
    const phonePort = classifyViewport(390, 844, true);
    expect(phonePort.tier).toBe("phone-portrait");
    expect(phonePort.orientation).toBe("portrait");
    expect(phonePort.isPhone).toBe(true);
    expect(phonePort.useBottomSheet).toBe(true);
    expect(phonePort.pinLeftByDefault).toBe(false);
    expect(phonePort.pinRightByDefault).toBe(false);
    expect(phonePort.showPagesBarPinned).toBe(false);
  });

  it("uses slim side drawers instead of bottom sheets on short phone landscape", () => {
    const phoneLand = classifyViewport(844, 390, true);
    expect(phoneLand.tier).toBe("phone-landscape");
    expect(phoneLand.orientation).toBe("landscape");
    expect(phoneLand.isPhone).toBe(true);
    expect(phoneLand.useBottomSheet).toBe(false);
    expect(phoneLand.pinLeftByDefault).toBe(false);
    expect(phoneLand.pinRightByDefault).toBe(false);
  });
});
