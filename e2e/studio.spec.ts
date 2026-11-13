import { expect, test } from "@playwright/test";

test.describe("Inked Figure Studio End-to-End Regression", () => {
  test("Create/3D Pose -> Cast/Hands/Lighting -> 2D Snapshot -> Panels/Webtoon -> Reload Persistence", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    await page.goto("/");
    await expect(page.locator("[data-scene-ready]")).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();

    // Enter 3D Pose Studio workspace and select Poses tab
    await page.getByRole("button", { name: "3D Pose Studio" }).click();
    await page.getByRole("button", { name: /🥋 Poses/ }).click();

    // 1. Hand Presets & Undo
    await page.getByRole("button", { name: "Fist", exact: true }).click();
    await page.getByRole("button", { name: "Undo Pose" }).click();

    // 2. Manga Cel-Shading & Light Presets + Print Hatching
    await page.getByRole("button", { name: "Rim Backlight" }).click();
    const hatchBox = page.getByLabel("Print Hatching");
    await hatchBox.check();
    await expect(hatchBox).toBeChecked();

    // 3. Stage Multi-Character Cast (Cast tab)
    await page.getByRole("button", { name: /👥 Cast \(1\)/ }).click();
    await page.getByRole("button", { name: /\+ Add$/i }).click();
    await expect(page.getByRole("button", { name: /👥 Cast \(2\)/ })).toBeVisible();

    // 4. Smart Prop Grip Snapping
    await page.getByRole("button", { name: /🗡️ Props/ }).click();
    await page.getByRole("button", { name: /Katana/i }).first().click();
    await page.getByRole("button", { name: /✋ Snap Right Grip/ }).click();

    // 5. Capture 2D Render -> Add to Manga Panel
    await page.getByRole("button", { name: /Capture 2D Render/ }).click();
    await page.getByRole("button", { name: /Add to Manga Panel/ }).click();
    await expect(page.locator("#manga-page-container")).toBeVisible();

    // Verify 3D element stamped into panel
    await expect(page.locator('[data-testid="panel-layer-list"]')).toBeVisible();

    // 6. Phase 4 Panel Geometry: Corner Radius & Scalloped Border
    const cornerSlider = page.getByLabel(/Corner Radius/i);
    await cornerSlider.fill("20");
    await page.getByLabel(/Scalloped Memory Border/i).check();
    await page.getByLabel(/Scalloped Memory Border/i).uncheck();

    // 7. Curved & Dual Speech Balloon
    await page.getByRole("button", { name: /💬 SFX/i }).click();
    await page.getByRole("button", { name: /💬 Dialogue/ }).click();
    await page.getByLabel("Curved Tail").check();
    await page.getByLabel("Dual Tail").check();
    await expect(page.getByRole("button", { name: "Drag curved tail bend" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Drag secondary speech tail" })).toBeVisible();

    // 8. Canvas Keyboard Shortcuts: Ctrl+D duplicate -> Delete
    const layerButtons = page.locator('[data-testid="panel-layer-list"] button');
    await layerButtons.first().click();
    const layersBefore = await layerButtons.count();
    await page.getByRole("button", { name: "Resize right edge" }).first().focus();
    await page.keyboard.press("Control+d");
    await expect.poll(() => layerButtons.count()).toBeGreaterThan(layersBefore);
    await page.keyboard.press("Delete");
    await expect.poll(() => layerButtons.count()).toBe(layersBefore);

    // 9. Phase 5 Webtoon Scroll Mode & Mobile 9:16 Preview & Slice Export
    await page.getByTestId("mode-webtoon").click();
    await expect(page.getByTestId("webtoon-scroll-canvas")).toBeVisible();
    await page.getByTestId("append-webtoon-beat").click();
    await expect(page.getByTestId("webtoon-seam-line").first()).toBeVisible();

    await page.getByTestId("mobile-preview-toggle").click();
    await expect(page.getByTestId("mobile-preview-drawer")).toBeVisible();
    await page.getByRole("button", { name: "Export Slices" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Slice & Download Webtoon/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/webtoon-strip-\d+\.png/);
    await expect(page.getByText(/Sliced and downloaded \d+ Webtoon strips/)).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();

    // Switch back to Print Page before reload check
    await page.getByTestId("mode-page").click();
    await expect(page.locator("#manga-page-container")).toBeVisible();

    // 10. Reload Persistence via IndexedDB
    await page.reload();
    await expect(page.locator("[data-scene-ready]")).toBeVisible();
    await page.getByRole("button", { name: /Manga Panels/ }).click();
    await expect(page.getByText("Chapter Pages (2):")).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("Universal Base Model Pipeline: Shonen Hero Base, auto-calibration, skin tint, and Scene Cast", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    await page.goto("/");
    await expect(page.locator("[data-scene-ready]")).toBeVisible();

    // 1. Switch Base Model to Shonen Hero Base & create a character
    const baseSelect = page.getByLabel("Base model");
    await baseSelect.selectOption("builtin:shonen-base");
    await expect(page.getByText(/52\/52 bones · 5-finger · 1\.8m/)).toBeVisible({ timeout: 20000 });
    await expect(page.locator("[data-scene-ready]")).toBeVisible();

    await page.getByRole("button", { name: "+ New character" }).click();
    await expect(page.getByLabel("Character name")).toHaveValue("Character 1");

    // 2. Apply skin color swatch & check Face Auto-Fit ran
    await page.getByLabel("Skin colour hex").fill("#d9a07a");
    await page.getByLabel("Skin colour hex").press("Enter");

    await page.getByRole("button", { name: /😠 Face/ }).click();
    await expect(page.getByTestId("face-panel")).toBeVisible();
    const forwardVal = await page.getByLabel("Forward / back").inputValue();
    expect(Number(forwardVal)).toBeGreaterThan(0.11);

    // 3. Stage X Bot alongside Shonen Hero Base in Pose Studio -> Cast
    await page.getByRole("button", { name: /Pose this character/ }).click();
    await page.getByRole("button", { name: /👥 Cast/ }).click();
    await page.getByLabel("Character to stage").selectOption("__demo__");
    await page.getByRole("button", { name: /\+ Add$/i }).click();
    await expect(page.getByRole("button", { name: /👥 Cast \(2\)/ })).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
