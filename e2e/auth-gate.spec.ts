import { expect, test } from "@playwright/test";

test.describe("Mandatory Google / Allowlist Auth Gate", () => {
  test("blocks studio access behind sign-in gate on desktop and mobile", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /INKED.*FIGURE.*STUDIO/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("google-signin-btn")).toBeVisible();
    await expect(page.getByTestId("email-auth-submit-btn")).toBeVisible();
    await expect(page.getByRole("button", { name: /3D Pose Studio/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Manga Panels/i })).toHaveCount(0);

    // Switch to mobile viewport cleanly with zero horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
});
