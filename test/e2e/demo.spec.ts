import { expect, test } from "@playwright/test";
import { e2eApps } from "../paths.js";

for (const { language, port } of e2eApps) {
  test(`the generated ${language} app adds, toggles, deletes, and reloads saved todos`, async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(`http://127.0.0.1:${port}/`);

    await expect(page).toHaveTitle("TinyJoin Todos");
    await expect(page.locator("#todoInput input")).toBeVisible();
    await expect(page.locator("#loading")).toHaveCount(0);
    await expect(page.locator("#topBarTitle")).toContainText("TinyJoin Todos");
    await expect(page.locator("#infoTooltip")).toContainText("TinyJoin's");
    await expect(page.locator(".infoTechIcon")).toHaveAttribute(
      "src",
      language === "typescript" ? "/ts.svg" : "/js.svg",
    );

    const todoItems = page.locator(".todoItem");
    await expect(todoItems).toHaveText([/Learn TinyJoin/, /Build an app/]);

    const text = `Ship a tiny starter ${Date.now()}`;
    await page.locator("#todoInput input").fill(text);
    await page.locator("#todoInput button.primary").click();

    const todo = todoItems.filter({ hasText: text });
    await expect(todo).toHaveCount(1);
    await expect(todoItems.last()).toContainText(text);
    await expect(todo).not.toHaveClass(/completed/);
    await expect(page.locator("#todoInput input")).toHaveValue("");

    await todo.locator('input[type="checkbox"]').check();
    await expect(todo).toHaveClass(/completed/);

    await page.reload();
    await expect(page.locator("#todoInput input")).toBeVisible();
    const reopenedTodo = todoItems.filter({ hasText: text });
    await expect(reopenedTodo).toHaveCount(1);
    await expect(reopenedTodo).toHaveClass(/completed/);
    await expect(reopenedTodo.locator('input[type="checkbox"]')).toBeChecked();

    await reopenedTodo.getByRole("button", { name: "Delete" }).click();
    await expect(todoItems.filter({ hasText: text })).toHaveCount(0);

    for (const starter of ["Learn TinyJoin", "Build an app"]) {
      const starterTodo = todoItems.filter({ hasText: starter });
      await starterTodo.getByRole("button", { name: "Delete" }).click();
      await expect(starterTodo).toHaveCount(0);
    }
    await expect(todoItems).toHaveCount(0);
    await expect(page.locator("#todoList")).toBeEmpty();

    await page.reload();
    await expect(page.locator("#todoInput input")).toBeVisible();
    await expect(todoItems).toHaveCount(0);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
