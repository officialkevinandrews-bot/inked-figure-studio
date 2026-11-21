import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "Phone Portrait (390x844)", width: 390, height: 844, isPhone: true, isTabletLand: false },
  { name: "Phone Landscape (844x390)", width: 844, height: 390, isPhone: true, isTabletLand: false },
  { name: "Tablet Portrait (768x1024)", width: 768, height: 1024, isPhone: false, isTabletLand: false },
  { name: "Tablet Landscape (1024x768)", width: 1024, height: 768, isPhone: false, isTabletLand: true },
] as const;

test.describe("Responsive Tablet & Mobile Layouts (All Orientations)", () => {
  test.use({ hasTouch: true });

  for (const vp of VIEWPORTS) {
    test(`${vp.name}: zero overflow, accessible drawers/sheets, 3D orbit toggle & full panel tools`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => pageErrors.push(String(err)));

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");

      // 1. Default opens to Manga Panels first with zero horizontal page overflow
      await expect(page.locator("#manga-page-container")).toBeVisible();
      const panelsOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(panelsOverflow).toBeLessThanOrEqual(2);

      // Verify Photo Filter, + Sprite & Mobile 9:16 are reachable (via More menu on <1024px, inline on 1024px+)
      if (!vp.isTabletLand) {
        await page.getByTestId("panels-more-btn").click();
        const moreMenu = page.getByTestId("panels-more-menu");
        await expect(moreMenu).toBeVisible();
        await expect(moreMenu.getByRole("button", { name: /Photo Filter/i })).toBeVisible();
        await expect(moreMenu.getByRole("button", { name: /\+ Upload Sprite/i })).toBeVisible();
        await expect(moreMenu.getByRole("button", { name: /Mobile 9:16 Reader/i })).toBeVisible();
        await moreMenu.getByRole("button", { name: /Photo Filter/i }).click();
      } else {
        await expect(page.getByRole("button", { name: /Photo Filter/i })).toBeVisible();
        await expect(page.getByRole("button", { name: /\+ Sprite/i })).toBeVisible();
        await expect(page.getByTestId("mobile-preview-toggle")).toBeVisible();
        await page.getByRole("button", { name: /Photo Filter/i }).click();
      }
      await expect(page.getByRole("heading", { name: /PHOTO-TO-MANGA/i })).toBeVisible();
      await page.getByRole("button", { name: "Close photo filter" }).click();

      // Verify Tools drawer auto-closes when picking an interactive drawing tool on phone / tablet portrait
      if (!vp.isTabletLand) {
        await page.getByTestId("panels-dock-tools").click();
        await expect(page.getByTestId("panels-left-drawer")).toBeVisible();
        await page.getByRole("button", { name: /Line Pen/i }).click();
        await expect(page.getByTestId("panels-left-drawer")).toBeHidden();
        await expect(page.getByTestId("line-pen-overlay")).toBeVisible();
        await page.getByRole("button", { name: "Done", exact: true }).click();
      }

      // Verify Right Inspector opens from bottom dock & Pages drawer toggles cleanly on portrait/phone
      await page.getByTestId("panels-dock-inspector").click();
      await expect(page.getByTestId("panels-right-drawer")).toBeVisible();
      await page.getByRole("button", { name: /Close Panel & Element Inspector/i }).click();

      if (!vp.isTabletLand) {
        await page.getByTestId("panels-dock-pages").click();
        await expect(page.getByTestId("mobile-pages-drawer")).toBeVisible();
        await page.getByRole("button", { name: "Close pages strip" }).click();
      }

      // 2. Switch to 3D Pose Studio and verify lazy mount + zero horizontal page overflow
      await page.getByRole("button", { name: /3D Pose/ }).click();
      await expect(page.locator("[data-scene-ready]")).toBeVisible();
      await expect(page.getByTestId("touch-orbit-toggle")).toBeVisible();
      const studioOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(studioOverflow).toBeLessThanOrEqual(2);

      // Toggle Orbit Only pill cleanly
      await page.getByTestId("touch-orbit-toggle").click();
      await expect(page.getByTestId("touch-orbit-toggle")).toHaveAttribute("aria-pressed", "true");

      // Open 3D Inspector drawer/sheet from dock (all 4 compact viewports unpin right inspector)
      await page.getByTestId("studio-dock-inspector").click();
      await expect(page.getByTestId("studio-right-drawer")).toBeVisible();
      await page.getByRole("button", { name: /Close Joints, Lighting & Ink Render/i }).click();
      await expect(page.getByTestId("studio-right-drawer")).toBeHidden();

      if (!vp.isTabletLand) {
        await page.getByTestId("studio-dock-tools").click();
        await expect(page.getByTestId("studio-left-drawer")).toBeVisible();
        await page.getByRole("button", { name: /Close Poses, Props & Scene/i }).click();
      } else {
        await expect(page.getByTestId("studio-left-drawer")).toBeVisible();
      }

      // Return to Manga Panels
      await page.getByRole("button", { name: /Manga Panels/ }).click();
      await expect(page.locator("#manga-page-container")).toBeVisible();

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }
});
