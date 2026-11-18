import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";

function makeSolidPng(width: number, height: number): Buffer {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < width; x++) {
      const off = y * rowSize + 1 + x * 3;
      raw[off] = 40;
      raw[off + 1] = 120;
      raw[off + 2] = 220;
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

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

    // 1. Switch Base Model to Shonen Hero Base & test preview Skin Colour + RGB before saving character
    const baseSelect = page.getByLabel("Base model");
    await baseSelect.selectOption("builtin:shonen-base");
    await expect(page.getByText(/52\/52 bones · 5-finger · 1\.8m/)).toBeVisible({ timeout: 20000 });
    await expect(page.locator("[data-scene-ready]")).toBeVisible();

    await page.getByRole("button", { name: "Skin colour RGB sliders" }).click();
    await expect(page.getByLabel("Skin colour R", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Skin colour #dfa57d" }).click();

    await page.getByRole("button", { name: "+ New character" }).click();
    await expect(page.getByLabel("Character name")).toHaveValue("Character 1");
    await expect(page.getByLabel("Skin colour hex")).toHaveValue("#dfa57d");

    // 2. Apply custom hex/RGB skin & check Face Auto-Fit ran
    await page.getByLabel("Skin colour hex").fill("#d9a07a");
    await page.getByLabel("Skin colour hex").press("Enter");

    await page.getByRole("button", { name: /😠 Face/ }).click();
    await expect(page.getByTestId("face-panel")).toBeVisible();
    const forwardVal = await page.getByLabel("Forward / back").inputValue();
    expect(Number(forwardVal)).toBeGreaterThan(0.11);

    // 3. Stage X Bot alongside Shonen Hero Base & verify Muscle Definition Lines slider in Ink/Render
    await page.getByRole("button", { name: /Pose this character/ }).click();
    const muscleSlider = page.getByLabel(/Muscle Definition Lines/i);
    await expect(muscleSlider).toHaveValue("4.5");
    await muscleSlider.fill("6");
    await expect(muscleSlider).toHaveValue("6");

    await page.getByRole("button", { name: /👥 Cast/ }).click();
    await page.getByLabel("Character to stage").selectOption("__demo__");
    await page.getByRole("button", { name: /\+ Add$/i }).click();
    await expect(page.getByRole("button", { name: /👥 Cast \(2\)/ })).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("Manga Panels Master Upgrade: Dividers, Draw Panel, Merge Directions, Narration Caption & Custom Templates", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("dialog", (d) => d.accept());

    await page.goto("/");
    await expect(page.locator("[data-scene-ready]")).toBeVisible();
    await page.getByRole("button", { name: /Manga Panels/ }).click();
    await expect(page.locator("#manga-page-container")).toBeVisible();

    // 1. Template filtering by panel count & search -> apply Reference Stagger (5 panels)
    await page.getByRole("group", { name: "Panel count" }).getByRole("button", { name: "5", exact: true }).click();
    await page.getByLabel("Search grid templates").fill("Reference Stagger");
    await page.getByRole("button", { name: "Template Reference Stagger" }).click();
    await expect(page.getByTestId("divider-handle")).toHaveCount(4);

    // 2. Dividers tool: drag horizontal top banner divider down
    await page.getByRole("button", { name: /Dividers/ }).click();
    const divBox = await page.getByTestId("divider-handle").first().boundingBox();
    expect(divBox).not.toBeNull();
    if (divBox) {
      await page.mouse.move(divBox.x + divBox.width / 2, divBox.y + divBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(divBox.x + divBox.width / 2, divBox.y + divBox.height / 2 + 40, { steps: 5 });
      await page.mouse.up();
    }

    // 3. Quick 2x2 grid split + directional merge
    await page.getByRole("button", { name: /Select \(V\)/ }).click();
    await page.getByRole("button", { name: "2×2 Grid" }).click();
    await expect(page.getByTestId("merge-directions")).toBeVisible();
    await page.getByTestId("merge-directions").getByRole("button").first().click();

    // 4. Empty Canvas + Freehand Draw Panel tool
    await page.getByRole("button", { name: /Empty Canvas/ }).click();
    await expect(page.getByTestId("empty-canvas-hint")).toBeVisible();
    const drawOverlay = page.getByTestId("draw-panel-overlay");
    await expect(drawOverlay).toBeVisible();
    const box = await drawOverlay.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.45, { steps: 5 });
      await page.mouse.up();
    }
    await expect(page.getByTestId("empty-canvas-hint")).toBeHidden();

    // 5. Save custom template
    await page.getByRole("button", { name: "+ Save", exact: true }).click();
    await page.getByLabel("Custom template name").fill("Kitchen Custom Beat");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Template Kitchen Custom Beat" })).toBeVisible();

    // 6. Narration Caption Box with on-canvas resize handles
    await page.getByRole("button", { name: /💬 SFX/i }).click();
    await page.getByRole("button", { name: /Narration Caption/ }).click();
    await expect(page.getByRole("button", { name: "Resize balloon bottom-right" })).toBeVisible();
    await expect(page.getByRole("button", { name: "left", exact: true })).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("Upload Background Image: Auto-scale with panel, Deselect page mode, Whole-Page Layer ordering & Clear panel fill", async ({
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
    await page.getByRole("button", { name: /Manga Panels/ }).click();
    await expect(page.locator("#manga-page-container")).toBeVisible();

    // 1. Upload background with Panel 1 selected -> auto-fills Panel 1 and scales when divider moves
    await page.getByRole("button", { name: /Backs/ }).click();
    const uploadBtn = page.getByTestId("upload-background-btn");
    await expect(uploadBtn).toBeVisible();

    const pngBuf = makeSolidPng(120, 80);
    const [chooser1] = await Promise.all([
      page.waitForEvent("filechooser"),
      uploadBtn.click(),
    ]);
    await chooser1.setFiles({ name: "panel-bg.png", mimeType: "image/png", buffer: pngBuf });

    const bgImg = page.locator('#manga-page-container img[src^="data:image/png"]').first();
    await expect(bgImg).toBeVisible();
    const beforeBox = await bgImg.boundingBox();
    expect(beforeBox).not.toBeNull();

    const bgId = await bgImg.getAttribute("data-element-id");
    expect(bgId).toBeTruthy();

    // Drag a divider to change Panel 1's dimensions and confirm background auto-scales with it
    await page.getByTitle("Panels, Knife Cut & Grid Layouts").click();
    await page.getByRole("button", { name: /Dividers/ }).click();
    const divHandle = page.getByTestId("divider-handle").first();
    await expect(divHandle).toBeAttached();
    const divBox = await divHandle.boundingBox();
    expect(divBox).not.toBeNull();
    if (divBox) {
      await page.mouse.move(divBox.x + divBox.width / 2, divBox.y + divBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(divBox.x + divBox.width / 2 + 45, divBox.y + divBox.height / 2 + 45, {
        steps: 5,
      });
      await page.mouse.up();
    }
    const afterBox = await bgImg.boundingBox();
    expect(afterBox).not.toBeNull();
    if (beforeBox && afterBox) {
      const changed =
        Math.abs(afterBox.width - beforeBox.width) > 2 ||
        Math.abs(afterBox.height - beforeBox.height) > 2;
      expect(changed).toBe(true);
    }

    // 1b. Enable Breakout + resize Panel 1's background, then upload to Panel 2 -> Panel 1's custom size MUST stay untouched
    await page.getByRole("button", { name: /Select \(V\)/ }).click();
    const trackedBg = page.locator(`#manga-page-container img[data-element-id="${bgId}"]`);
    await trackedBg.click({ force: true });
    await page.getByLabel(/Breakout \(Pop-out of border\)/i).check();
    await expect(page.getByLabel(/Auto-scale with panel/i)).not.toBeChecked();

    const resizeHandle = page.getByRole("button", { name: "Resize bottom-right corner" });
    await expect(resizeHandle).toBeVisible();
    const rhBox = await resizeHandle.boundingBox();
    expect(rhBox).not.toBeNull();
    if (rhBox) {
      await page.mouse.move(rhBox.x + rhBox.width / 2, rhBox.y + rhBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(rhBox.x + rhBox.width / 2 + 50, rhBox.y + rhBox.height / 2 + 50, { steps: 5 });
      await page.mouse.up();
    }
    const poppedBox = await trackedBg.boundingBox();
    expect(poppedBox).not.toBeNull();

    // Switch to Panel 2 and upload another background -> must NOT resize Panel 1's popped-out background
    await page.locator("#manga-page-container svg path[data-panel-id]").nth(1).click();
    await page.getByRole("button", { name: /Backs/ }).click();
    await expect(page.getByText(/Auto-scales to fill Panel #2/)).toBeVisible();
    const [chooserPanel2] = await Promise.all([
      page.waitForEvent("filechooser"),
      uploadBtn.click(),
    ]);
    await chooserPanel2.setFiles({ name: "panel2-bg.png", mimeType: "image/png", buffer: pngBuf });

    // Confirm Panel 1 background kept its exact custom resized dimensions
    await expect(page.locator('#manga-page-container img[src^="data:image/png"]')).toHaveCount(2);
    const panel1BoxAfter = await trackedBg.boundingBox();
    if (poppedBox && panel1BoxAfter) {
      expect(Math.abs(panel1BoxAfter.width - poppedBox.width)).toBeLessThan(2);
      expect(Math.abs(panel1BoxAfter.height - poppedBox.height)).toBeLessThan(2);
    }

    // 2. Deselect panel -> upload whole-page background -> check Page Layer Ordering controls
    await page.getByTitle("Panels, Knife Cut & Grid Layouts").click();
    await page.getByRole("button", { name: /Select \(V\)/ }).click();
    await page.getByRole("button", { name: "Deselect", exact: true }).click();
    await page.getByRole("button", { name: /Backs/ }).click();
    await expect(page.getByText(/No panel selected/)).toBeVisible();

    const [chooser2] = await Promise.all([
      page.waitForEvent("filechooser"),
      uploadBtn.click(),
    ]);
    await chooser2.setFiles({ name: "whole-page-bg.png", mimeType: "image/png", buffer: pngBuf });

    const pageLayerList = page.getByTestId("page-layer-list");
    await expect(pageLayerList).toBeVisible();
    await expect(pageLayerList).toContainText("Behind all");

    const layerSelect = page.getByLabel("Page element layer relative to panel");
    await expect(layerSelect).toBeVisible();

    const optionValues = await layerSelect
      .locator("option")
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
    const abovePanelOpt = optionValues.find((v) => v.startsWith("above:"));
    const belowPanel2Opt = optionValues.filter((v) => v.startsWith("below:"))[1];
    expect(abovePanelOpt).toBeTruthy();

    if (abovePanelOpt) {
      await layerSelect.selectOption(abovePanelOpt);
      await expect(pageLayerList).toContainText("Above P1");
    }
    if (belowPanel2Opt) {
      await layerSelect.selectOption(belowPanel2Opt);
      await expect(pageLayerList).toContainText("Below P2");
    }

    // 3. Re-select Panel 1 on canvas and set Background Fill -> Clear (transparent)
    await page.getByRole("button", { name: "Behind All Panels" }).click();
    await expect(pageLayerList).toContainText("Behind all");
    const firstPanelPath = page.locator("#manga-page-container svg path[fill]").first();
    await firstPanelPath.click({ force: true });
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(firstPanelPath).toHaveAttribute("fill", "none");

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("Multi-Series & Multi-Chapter Library: Create series, add chapters, duplicate, export/import & persist across reload", async ({
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

    // 1. Confirm NO project library button appears in 3D Pose Studio header
    await page.getByRole("button", { name: "3D Pose Studio" }).click();
    await expect(page.getByTestId("projects-library-btn")).toHaveCount(0);

    // 2. Enter Manga Panels -> add a 2nd page to My Manga / Chapter 1
    await page.getByRole("button", { name: /Manga Panels/ }).click();
    await expect(page.locator("#manga-page-container")).toBeVisible();
    await expect(page.getByTestId("projects-library-btn")).toContainText("My Manga");

    await page.getByRole("button", { name: "Add Page" }).click();
    await expect(page.getByTestId("chapter-switcher")).toContainText("Chapter 1 (2p)");

    // 3. Quick-add Chapter 2 to the same series and review chapters separately
    await page.getByTestId("quick-add-chapter-btn").click();
    await expect(page.getByTestId("chapter-switcher").locator("option")).toHaveCount(2);
    await expect(page.getByTestId("chapter-switcher")).toContainText("Chapter 2 (1p)");

    // Switch back to Chapter 1 via chapter dropdown -> still has 2 pages
    const ch1Opt = await page
      .getByTestId("chapter-switcher")
      .locator("option")
      .first()
      .getAttribute("value");
    await page.getByTestId("chapter-switcher").selectOption(ch1Opt!);
    await expect(page.getByTestId("chapter-switcher")).toContainText("Chapter 1 (2p)");

    // 4. Open Manga Projects modal -> create a new separate Manga Series "Tokyo Blades"
    await page.getByTestId("projects-library-btn").click();
    const modal = page.getByTestId("manga-projects-modal");
    await expect(modal).toBeVisible();
    await page.getByTestId("new-manga-series-btn").click();
    await page.getByLabel("New series title").fill("Tokyo Blades");
    await page.getByRole("button", { name: /Create & Open/i }).click();

    await expect(modal).toBeHidden();
    await expect(page.getByTestId("projects-library-btn")).toContainText("Tokyo Blades");
    await expect(page.getByTestId("chapter-switcher")).toContainText("Chapter 1 (1p)");

    // 5. Re-open modal -> Duplicate "Tokyo Blades", Export & Import single project, then switch back to My Manga Chapter 1
    await page.getByTestId("projects-library-btn").click();
    await expect(modal).toBeVisible();
    await page.getByRole("button", { name: "Duplicate Tokyo Blades" }).click();
    await expect(modal).toContainText("Tokyo Blades (Copy)");

    const [projDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Tokyo Blades", exact: true }).click(),
    ]);
    const dlPath = await projDownload.path();
    expect(dlPath).toBeTruthy();
    if (dlPath) {
      const [impChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByTestId("import-manga-project-btn").click(),
      ]);
      await impChooser.setFiles(dlPath);
      await expect(modal.locator('[data-testid^="project-card-"]')).toHaveCount(4);
    }

    // Switch back to "My Manga" -> Chapter 1 (2p) and close modal
    await modal
      .locator('[data-testid^="project-card-"]')
      .filter({ hasText: "My Manga" })
      .getByRole("button", { name: /Open & Review/ })
      .first()
      .click();
    await expect(modal).toBeHidden();
    await expect(page.getByTestId("projects-library-btn")).toContainText("My Manga");
    await expect(page.getByTestId("chapter-switcher")).toContainText("Chapter 1 (2p)");

    // 6. Wait briefly for IndexedDB save & reload browser -> verify series, chapters, and pages survive reload
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.locator("[data-scene-ready]")).toBeVisible();
    await page.getByRole("button", { name: /Manga Panels/ }).click();
    await expect(page.getByTestId("projects-library-btn")).toContainText("My Manga");
    await expect(page.getByTestId("chapter-switcher")).toContainText("Chapter 1 (2p)");
    await page.getByTestId("projects-library-btn").click();
    await expect(page.getByTestId("manga-projects-modal")).toContainText("Tokyo Blades");
    await expect(page.getByTestId("manga-projects-modal")).toContainText("Tokyo Blades (Copy)");

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
