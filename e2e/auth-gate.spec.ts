import { expect, test } from "@playwright/test";

test.describe("Mandatory Google / Allowlist Auth Gate & Public Landing Page", () => {
  test("shows full MangakaDesk landing showcase, blocks studio behind sign-in gate on desktop and mobile", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Primary MangakaDesk landing hero
    await expect(page.getByRole("heading", { name: /MANGAKA.*DESK/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("navigation", { name: "Workspace views" })).toHaveCount(0);
    await expect(page.locator("#manga-page-container")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /3D Pose Studio/i })).toHaveCount(0);

    // Switch through all 4 gallery tabs and verify every rendered landing screenshot loads cleanly
    for (const tabId of ["panels", "importer", "webtoon", "export"]) {
      await page.getByTestId(`gallery-tab-${tabId}`).click();
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              Array.from(document.querySelectorAll("img")).every(
                (img) => img.complete && img.naturalWidth > 0,
              ),
            ),
          { timeout: 10_000 },
        )
        .toBe(true);
    }

    // Confirm upcoming 3D section says Coming Soon with zero 3D showcase images
    const upcomingSection = page.locator("#upcoming-3d");
    await expect(upcomingSection).toContainText(/Coming Soon/i);
    await expect(upcomingSection.locator("img")).toHaveCount(0);

    // Confirm informational multi-platform Coming Soon badges (no app store dead links)
    const platformsSection = page.locator("#platforms");
    await expect(platformsSection).toContainText(/Google Play/i);
    await expect(platformsSection).toContainText(/Apple App Store/i);
    await expect(platformsSection).toContainText(/Windows/i);

    // Desktop zero horizontal overflow
    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desktopOverflow).toBeLessThanOrEqual(1);

    // Switch to mobile viewport cleanly with zero horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(mobileOverflow).toBeLessThanOrEqual(1);

    // Open Sign-In modal from header CTA and confirm auth controls are rendered
    await page.getByTestId("landing-signin-btn").click();
    await expect(page.getByTestId("signin-modal")).toBeVisible();
    await expect(page.getByTestId("google-signin-btn")).toBeVisible();
    await expect(page.getByTestId("email-auth-submit-btn")).toBeVisible();

    // Ensure direct binary download links (.apk / .zip) never appear on the public landing page
    await expect(page.locator('a[href$=".apk"], a[href$=".zip"]')).toHaveCount(0);

    // Landscape phone viewport: ensure Sign-In modal remains inside viewport and scrollable
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(150);
    const modalBox = await page.getByTestId("signin-modal").boundingBox();
    expect(modalBox).not.toBeNull();
    expect(modalBox!.height).toBeLessThanOrEqual(390);
    expect(modalBox!.y).toBeGreaterThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
