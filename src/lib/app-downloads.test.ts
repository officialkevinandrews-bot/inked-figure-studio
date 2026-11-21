import { afterEach, describe, expect, it } from "vitest";
import {
  APP_DOWNLOADS,
  APP_RELEASE_PAGE_URL,
  APP_RELEASE_TAG,
  APP_RELEASE_VERSION,
  getDesktopBridge,
  isWindowsDesktopApp,
} from "./app-downloads";

describe("app-downloads release manifest", () => {
  afterEach(() => {
    delete (window as unknown as { mangakaDesktop?: unknown }).mangakaDesktop;
  });

  it("includes only Android and Windows packages for v1.0.0", () => {
    expect(APP_RELEASE_VERSION).toBe("1.0.0");
    expect(APP_RELEASE_TAG).toBe("v1.0.0");
    expect(APP_RELEASE_PAGE_URL).toMatch(/^https:\/\/github\.com\/officialkevinandrews-bot\/inked-figure-studio\/releases\/tag\/v1\.0\.0$/);

    const ids = APP_DOWNLOADS.map((entry) => entry.id);
    expect(ids).toEqual(["android", "windows"]);
    expect(ids).not.toContain("ios");
  });

  it("defines valid HTTPS GitHub release URLs, filenames, sizes, and SHA-256 digests", () => {
    for (const entry of APP_DOWNLOADS) {
      expect(entry.downloadUrl.startsWith("https://github.com/officialkevinandrews-bot/inked-figure-studio/releases/download/v1.0.0/")).toBe(true);
      expect(entry.downloadUrl.endsWith(`/${entry.fileName}`)).toBe(true);
      expect(entry.sizeBytes).toBeGreaterThan(0);
      expect(entry.sha256).toMatch(/^[0-9A-F]{64}$/);
      expect(entry.installSteps.length).toBeGreaterThanOrEqual(3);
    }

    const android = APP_DOWNLOADS.find((e) => e.id === "android");
    const windows = APP_DOWNLOADS.find((e) => e.id === "windows");
    expect(android?.fileName).toBe("MangakaDesk-v1.0.0.apk");
    expect(windows?.fileName).toBe("MangakaDesk-Windows-v1.0.0.zip");
  });

  it("detects the Electron preload bridge only when running inside the Windows desktop wrapper", () => {
    expect(getDesktopBridge()).toBeNull();
    expect(isWindowsDesktopApp()).toBe(false);

    (window as unknown as { mangakaDesktop?: unknown }).mangakaDesktop = {
      platform: "windows",
      version: "1.0.0",
    };

    expect(getDesktopBridge()).toEqual({ platform: "windows", version: "1.0.0" });
    expect(isWindowsDesktopApp()).toBe(true);
  });
});
