import { expect, test } from "@playwright/test";

test("the generated app adds, updates, deletes, and reloads saved todos", async ({
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

  await page.goto("/");
  await expect(page.getByTestId("status")).toHaveText("Ready");
  await expect(page.getByTestId("error")).toBeHidden();

  const title = `Ship a tiny starter ${Date.now()}`;
  await page.getByTestId("todo-title").fill(title);
  await page
    .getByTestId("todo-form")
    .getByRole("button", { name: "Add" })
    .click();

  const todo = page.locator("li.todo").filter({ hasText: title });
  await expect(todo).toHaveCount(1);
  await expect(todo).not.toHaveClass(/is-done/);

  await todo.locator('input[data-action="toggle"]').check();
  await expect(todo).toHaveClass(/is-done/);

  await page.reload();
  await expect(page.getByTestId("status")).toHaveText("Ready");
  const reopenedTodo = page.locator("li.todo").filter({ hasText: title });
  await expect(reopenedTodo).toHaveCount(1);
  await expect(reopenedTodo).toHaveClass(/is-done/);

  await reopenedTodo.getByRole("button", { name: `Delete ${title}` }).click();
  await expect(page.locator("li.todo").filter({ hasText: title })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("No todos yet. Add your first one above."),
  ).toBeVisible();
  await expect(page.getByTestId("error")).toBeHidden();
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
