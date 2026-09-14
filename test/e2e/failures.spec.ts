import { expect, test } from "@playwright/test";
import { e2eApps } from "../paths.js";

for (const { language, port, ext } of e2eApps) {
  test(`the ${language} app explains a second-tab lock and recovers on Retry`, async ({
    page,
    context,
  }) => {
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(page.locator("#todoInput input")).toBeVisible();
    const second = await context.newPage();
    const errors: string[] = [];
    second.on("pageerror", (error) => errors.push(error.message));
    await second.goto(`http://127.0.0.1:${port}/`);
    await expect(second.getByRole("alert")).toContainText(/another tab/i);
    await expect(second.locator("#loading")).toHaveCount(0);
    await expect(second.locator("#todoInput")).toHaveCount(0);
    await page.close();
    await second.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(second.locator("#todoInput input")).toBeVisible();
    await expect(second.locator(".todoItem")).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  test(`the ${language} app retains drafts and restores failed changes`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Inject rejected writes at the public client boundary, leaving reads and
    // the real Worker/database active so reconciliation is exercised too. The
    // Client is frozen, so wrap it in this test's served module after setup.
    await page.route(`**/src/database.${ext}`, async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      expect(source).toContain("return database;");
      await route.fulfill({
        response,
        body: source.replace("return database;", `
          const rejected = new Set(['INSERT', 'UPDATE', 'DELETE']);
          return {
            ...database,
            query(sql, ...args) {
              const command = sql.trim().split(/\\s+/)[0];
              if (rejected.delete(command)) {
                return Promise.reject(new Error('Injected ' + command + ' failure'));
              }
              return database.query(sql, ...args);
            },
          };
        `),
      });
    });
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(page.locator(".todoItem")).toHaveCount(2);

    const input = page.locator("#todoInput input");
    await input.fill("Keep this draft");
    await page.locator("#todoInput button.primary").click();
    await expect(page.getByRole("alert")).toContainText("Injected INSERT failure");
    await expect(input).toHaveValue("Keep this draft");
    await expect(input).toBeEnabled();
    await expect(page.locator(".todoItem")).toHaveCount(2);

    const todo = page.locator(".todoItem").filter({ hasText: "Learn TinyJoin" });
    await todo.locator('input[type="checkbox"]').click();
    await expect(page.getByRole("alert").filter({ hasText: "Injected UPDATE failure" })).toBeVisible();
    await expect(todo.locator('input[type="checkbox"]')).not.toBeChecked();
    await expect(todo).not.toHaveClass(/completed/);
    await todo.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Injected DELETE failure" })).toBeVisible();
    await expect(todo).toHaveCount(1);

    // A later deliberate submission works; failed operations were not replayed.
    await page.locator("#todoInput button.primary").click();
    await expect(page.locator(".todoItem").filter({ hasText: "Keep this draft" })).toHaveCount(1);
    await expect(input).toHaveValue("");
    expect(errors).toEqual([]);
  });
}
