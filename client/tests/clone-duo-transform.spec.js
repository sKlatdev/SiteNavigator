import { expect, test } from "@playwright/test";

function createContentResponse() {
  const sourceHtml = `
    <html>
      <body>
        <main>
          <h1>Configure Zoom with SAML 2.0</h1>
          <p>Use these values when configuring your identity provider.</p>
          <h2>Application Configuration</h2>
          <p>Assertion Consumer Service (ACS) URL: https://service.example.com/saml/acs</p>
          <p>Audience URI (SP Entity ID): https://service.example.com/saml/metadata</p>
          <p>Default RelayState: leave blank</p>
          <table>
            <tr><th>Field</th><th>Value</th></tr>
            <tr><td>NameID format</td><td>EmailAddress</td></tr>
            <tr><td>Email</td><td>user.email</td></tr>
          </table>
          <ol>
            <li>Open the Zoom admin portal.</li>
            <li>Paste the identity provider SSO URL.</li>
          </ol>
          <img src="https://example.com/zoom-settings.png" alt="Zoom SAML settings panel" />
        </main>
      </body>
    </html>
  `;

  return {
    ok: true,
    recentDays: 14,
    count: 1,
    returnedCount: 1,
    page: 1,
    pageSize: 5000,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    signals: {
      newlyDiscovered: 0,
      recentlyUpdated: 1,
    },
    counts: {
      other: 0,
      docs: 0,
      release_notes: 0,
      guides: 0,
      blog: 0,
      resources: 0,
      help_kb: 0,
      demos: 0,
      competitor_docs: 1,
    },
    items: [
      {
        id: "okta_zoom_clone_source",
        url: `data:text/html,${encodeURIComponent(sourceHtml)}`,
        title: "How to Configure SAML 2.0 for Zoom",
        category: "competitor_docs",
        vendor: "Okta",
        tags: ["Okta"],
        pathSummary: "Applications > Zoom > Sign On",
        summary: "Configure Zoom SAML settings in Okta.",
        pageLastUpdated: "2026-03-26T00:00:00.000Z",
        contentHash: "zoom-clone-source",
        firstSeenAt: "2026-03-26T00:00:00.000Z",
        updatedAt: "2026-03-26T00:00:00.000Z",
        recentlyUpdated: true,
        recentReason: "changed_content",
      },
    ],
  };
}

test("clone to duo workspace can generate a review draft from a staged competitor page", async ({ page }) => {
  await page.route("**/api/content**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createContentResponse()),
    });
  });

  await page.goto("/");
  await page.getByLabel("Open Explorer").click();
  await expect(page.getByText("How to Configure SAML 2.0 for Zoom")).toBeVisible();

  await page.getByRole("button", { name: /Stage Clone/ }).click();
  await page.getByRole("button", { name: "Tools" }).click();
  await page.getByLabel("Open Clone to Duo Template").click();

  await expect(page.getByText("How to Configure SAML 2.0 for Zoom")).toBeVisible();
  await page.getByRole("button", { name: "Generate Review Draft" }).click();

  await expect(page.getByText("Update Your Cloud Application in Duo")).toBeVisible();
  await page.getByLabel("Open section Update Your Cloud Application in Duo").click();
  await expect(page.getByLabel("Fill Assertion Consumer Service (ACS) URL")).toBeVisible();
  await expect(page.getByText("Blocking Issues")).toBeVisible();
});