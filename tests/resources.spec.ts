import { expect, test, type Page } from "@playwright/test";

type ResourceRecord = {
  id: string;
  title: string;
  url: string;
  category: string;
  tool_subcategory: "Dev tool" | "UX tool" | null;
  source: string;
  notes: string;
  saved_at: string;
};

async function mockResourceApi(page: Page, initialResources: ResourceRecord[]) {
  let resources = [...initialResources];

  await page.route("**/rest/v1/resources**", async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (method === "GET") {
      // Honor PostgREST's or=(title.ilike."*q*",notes.ilike."*q*",...) filter
      // so server-side search behaves the same as in production.
      let rows = resources;
      const orFilter = url.searchParams.get("or");
      if (orFilter) {
        const match = orFilter.match(/ilike\."\*([^"*]+)\*"/);
        if (match) {
          const q = match[1].toLowerCase();
          rows = rows.filter((row) =>
            [row.title, row.notes, row.source, row.category].some((field) =>
              field?.toLowerCase().includes(q),
            ),
          );
        }
      }
      const cursor = url.searchParams.get("saved_at");
      if (cursor?.startsWith("lt.")) {
        const value = cursor.slice(3);
        rows = rows.filter((row) => row.saved_at < value);
      }
      const limit = Number(url.searchParams.get("limit"));
      if (Number.isFinite(limit) && limit > 0) {
        rows = rows.slice(0, limit);
      }
      await route.fulfill({ json: rows });
      return;
    }

    if (method === "POST") {
      const payload = route.request().postDataJSON() as Omit<ResourceRecord, "id">;
      const created = { ...payload, id: String(resources.length + 1) };
      resources = [created, ...resources];
      await route.fulfill({ status: 201, json: [created] });
      return;
    }

    if (method === "PATCH") {
      const payload = route.request().postDataJSON() as Omit<ResourceRecord, "id">;
      const filter = url.searchParams.get("id") ?? "";
      const id = filter.replace(/^eq\./, "");
      const updated = { ...payload, id };
      resources = resources.map((resource) => (resource.id === id ? updated : resource));
      await route.fulfill({ json: [updated] });
      return;
    }

    if (method === "DELETE") {
      const filter = url.searchParams.get("id") ?? "";
      const id = filter.replace(/^eq\./, "");
      resources = resources.filter((resource) => resource.id !== id);
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fallback();
  });
}

test("creates the first saved resource", async ({ page }) => {
  await mockResourceApi(page, []);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Start your library with the next link you save." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save the first resource" }).click();

  const dialog = page.getByRole("dialog", { name: "Save resource" });
  await dialog.getByLabel("Title *").fill("Radix accessibility guide");
  await dialog.getByLabel("URL *").fill("radix-ui.com/primitives/docs/overview/accessibility");
  await dialog.getByLabel("Source").fill("Radix");
  await dialog.getByLabel("Notes").fill("Good reference for accessible interaction patterns.");
  await dialog.getByRole("button", { name: "Save resource" }).click();

  await expect(page.getByText("Radix accessibility guide")).toBeVisible();
  await expect(page.getByText("Good reference for accessible interaction patterns.")).toBeVisible();
});

test("filters, edits, and deletes resources", async ({ page }) => {
  await mockResourceApi(page, [
    {
      id: "1",
      title: "Aceternity components",
      url: "https://ui.aceternity.com",
      category: "Inspiration",
      tool_subcategory: null,
      source: "Aceternity",
      notes: "Useful visual reference ideas.",
      saved_at: "2026-03-20T10:00:00.000Z",
    },
    {
      id: "2",
      title: "React docs",
      url: "https://react.dev",
      category: "Docs",
      tool_subcategory: null,
      source: "React",
      notes: "Official docs and API references.",
      saved_at: "2026-03-19T10:00:00.000Z",
    },
  ]);
  await page.addInitScript(() => {
    const pageWindow = window as Window & { __openedResourceUrls: string[] };
    pageWindow.__openedResourceUrls = [];
    window.open = ((url?: string | URL) => {
      pageWindow.__openedResourceUrls.push(String(url ?? ""));
      return null;
    }) as typeof window.open;
  });

  await page.goto("/");

  // Search lives in a command-palette modal opened from the header button.
  await expect(page.getByRole("button", { name: "Search resources" })).toContainText("/");
  await page.keyboard.press("Alt+Space");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.keyboard.press("/");
  const searchDialog = page.getByRole("dialog");
  await expect(searchDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(searchDialog).not.toBeVisible();

  await page.getByRole("button", { name: "Search resources" }).click();
  await searchDialog.getByRole("textbox", { name: "Search resources" }).fill("Aceternity");
  await expect(searchDialog.getByText("Aceternity components")).toBeVisible();
  await expect(searchDialog.getByText("React docs")).not.toBeVisible();
  await page.keyboard.press("Enter");
  await expect(searchDialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __openedResourceUrls?: string[] }).__openedResourceUrls ?? [],
    ),
  ).toEqual([]);
  await expect(page.getByRole("button", { name: "Search resources" })).toContainText(
    "Aceternity",
  );
  await expect(page.getByRole("heading", { name: "Aceternity components" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "React docs" })).not.toBeVisible();

  await page.getByRole("button", { name: "Search resources" }).click();
  await expect(searchDialog.getByRole("textbox", { name: "Search resources" })).toHaveValue(
    "Aceternity",
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(searchDialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __openedResourceUrls?: string[] }).__openedResourceUrls ?? [],
    ),
  ).toEqual(["https://ui.aceternity.com"]);
  await page.getByRole("button", { name: "Search resources" }).click();
  await searchDialog.getByRole("textbox", { name: "Search resources" }).fill("");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "React docs" })).toBeVisible();

  // Edit / delete are admin-only (UI gate). Unlock with the in-app passcode.
  await page.getByRole("button", { name: "Admin settings" }).click();
  await page.getByLabel("Admin passcode").fill("0125k");
  await page.getByRole("button", { name: "Unlock" }).click();

  await page.getByLabel("Edit Aceternity components").click();
  const dialog = page.getByRole("dialog", { name: "Edit resource" });
  await dialog.getByLabel("Title *").fill("Aceternity UI");
  await dialog.getByRole("button", { name: "Update resource" }).click();
  await expect(page.getByText("Aceternity UI")).toBeVisible();

  await page.getByLabel("Delete Aceternity UI").click();
  await page.getByRole("button", { name: "Delete resource" }).click();
  await expect(page.getByRole("heading", { name: "Aceternity UI" })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "React docs" })).toBeVisible();
});
