import { expect, test } from "@playwright/test";

test("the generated app writes, joins, subscribes, transacts, and reopens OPFS", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("state")).toHaveText("Ready");
  await expect(page.getByTestId("storage")).toContainText("OPFS");
  await expect(page.getByTestId("total-count")).toHaveText("3");
  await expect(page.getByTestId("open-count")).toHaveText("2");
  await expect(page.getByTestId("done-count")).toHaveText("1");
  await expect(
    page.locator('[data-testid="tasks"] > [data-task-id]'),
  ).toHaveCount(3);
  const multiTaggedTask = page.locator('li[data-task-id="2"]');
  await expect(multiTaggedTask.locator("[data-tag]")).toHaveCount(2);
  await expect(multiTaggedTask).toContainText("demo");
  await expect(multiTaggedTask).toContainText("storage");
  await expect(page.getByTestId("query-latency")).toContainText(
    "4 joined rows grouped into 3 tasks",
  );
  await expect(page.getByTestId("invalidations")).toHaveText("0");
  await expect(page.getByTestId("error")).toBeHidden();

  const initialRevision = Number(
    await page.getByTestId("revision").textContent(),
  );
  expect(Number.isSafeInteger(initialRevision) && initialRevision > 0).toBe(
    true,
  );

  const benchmark = await page.evaluate(() =>
    (
      globalThis as typeof globalThis & {
        __tinygresDemo: { benchmark(iterations: number): Promise<number[]> };
      }
    ).__tinygresDemo.benchmark(2),
  );
  expect(benchmark).toHaveLength(2);
  expect(
    benchmark.every((sample) => Number.isFinite(sample) && sample >= 0),
  ).toBe(true);

  await page.getByTestId("task-title").fill("Prove generated transactions");
  await page.getByTestId("task-tag").selectOption({ label: "storage" });
  await page.getByTestId("add-task").click();

  await expect(page.getByTestId("invalidations")).toHaveText("1");
  await expect(page.getByTestId("revision")).toHaveText(
    String(initialRevision + 1),
  );
  await expect(page.getByTestId("total-count")).toHaveText("4");
  await expect(page.getByTestId("open-count")).toHaveText("3");
  await expect(page.getByTestId("done-count")).toHaveText("1");
  const insertedTask = page.locator('li[data-task-id="4"]');
  await expect(insertedTask).toContainText("Prove generated transactions");
  await expect(insertedTask).toContainText("storage");
  await expect(page.getByTestId("query-latency")).toContainText(
    "5 joined rows grouped into 4 tasks",
  );
  await expect(page.getByTestId("status")).toContainText(
    "The join and aggregate were re-run locally",
  );

  await insertedTask.getByTestId("toggle-task").click();
  await expect(page.getByTestId("invalidations")).toHaveText("2");
  await expect(page.getByTestId("revision")).toHaveText(
    String(initialRevision + 2),
  );
  await expect(page.getByTestId("open-count")).toHaveText("2");
  await expect(page.getByTestId("done-count")).toHaveText("2");
  await expect(insertedTask).toHaveClass(/is-done/);

  await page.getByTestId("reload").click();

  await expect(page.getByTestId("state")).toHaveText("Ready");
  await expect(page.getByTestId("revision")).toHaveText(
    String(initialRevision + 2),
  );
  await expect(page.getByTestId("invalidations")).toHaveText("0");
  await expect(page.getByTestId("total-count")).toHaveText("4");
  await expect(page.getByTestId("open-count")).toHaveText("2");
  await expect(page.getByTestId("done-count")).toHaveText("2");
  await expect(page.locator('li[data-task-id="4"]')).toContainText(
    "Prove generated transactions",
  );
  await expect(page.locator('li[data-task-id="4"]')).toHaveClass(/is-done/);
  await expect(page.getByTestId("status")).toContainText(
    "OPFS database keeps it",
  );
  await expect(page.getByTestId("error")).toBeHidden();
});
