import { expect, test } from "@playwright/test";
import { offlineApps } from "../paths.js";

for (const { language, storage, port } of offlineApps) {
  test(`the ${language} ${storage} production app reopens and works offline`, async ({
    page,
    context,
  }) => {
    const url = `http://127.0.0.1:${port}/`;
    await page.goto(url);
    await expect(page.locator(".todoItem")).toHaveCount(2);
    expect(
      await page.evaluate(
        "navigator.serviceWorker.ready.then(registration => registration.active.state)",
      ),
    ).toBe("activated");

    // Close the original page and take the whole browser context offline.
    // The new navigation must come from the installed service worker, not
    // merely keep using a database and application already in memory.
    await page.close();
    await context.setOffline(true);
    const offline = await context.newPage();
    const errors: string[] = [];
    offline.on("pageerror", (error) => errors.push(error.message));
    const response = await offline.goto(url);
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(offline.locator(".todoItem")).toHaveCount(2);

    await offline.locator("#todoInput input").fill("Made while offline");
    await offline.locator("#todoInput button.primary").click();
    const added = offline
      .locator(".todoItem")
      .filter({ hasText: "Made while offline" });
    await expect(added).toHaveCount(1);
    await added.locator('input[type="checkbox"]').check();
    await expect(added).toHaveClass(/completed/);
    await offline.reload();
    await expect(offline.locator("#todoInput input")).toBeVisible();
    if (storage === "opfs") {
      await expect(added).toHaveClass(/completed/);
      await added.getByRole("button", { name: "Delete" }).click();
      await expect(added).toHaveCount(0);
    } else {
      await expect(added).toHaveCount(0);
    }
    await expect(offline.locator(".todoItem")).toHaveCount(2);
    expect(errors).toEqual([]);
  });
}
