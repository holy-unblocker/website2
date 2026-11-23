import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const origin = process.env.WEBSITE2_TEST_URL ?? "http://127.0.0.1:4433";
const browser = process.env.WEBSITE2_CDP
  ? await chromium.connectOverCDP(process.env.WEBSITE2_CDP)
  : await chromium.launch({
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
      headless: true,
      args: ["--no-sandbox"],
    });
const ownsBrowser = !process.env.WEBSITE2_CDP;
let passed = false;
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
// The cloak deliberately withholds plaintext when navigator.webdriver is true.
// Exercise the ordinary user branch in an automated browser.
await context.addInitScript(() =>
  Object.defineProperty(navigator, "webdriver", { get: () => false }),
);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function keyAndConfig() {
  return await page.evaluate(async () => {
    const key = document.querySelector("#eckey")?.textContent;
    const configNode = document.querySelector('[class*="siteConfig"]');
    const data = configNode?.textContent;
    if (!key || !data) return { key, hasConfig: false };
    const bytes = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(decodeURIComponent(data)), (c) =>
      c.charCodeAt(0),
    );
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      bytes.slice(16),
      "AES-CBC",
      false,
      ["decrypt"],
    );
    const decoded = JSON.parse(
      new TextDecoder().decode(
        await crypto.subtle.decrypt(
          { name: "AES-CBC", iv: bytes.slice(0, 16) },
          cryptoKey,
          ciphertext,
        ),
      ),
    );
    return { key, hasConfig: true, config: decoded };
  });
}

try {
  const response = await page.goto(origin + "/uv", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.locator("#eckey").waitFor({ state: "attached" });
  assert.equal(response?.status(), 200);
  await page.waitForTimeout(650);
  const first = await keyAndConfig();
  assert.equal(first.key?.length, 64, "key must contain base64(iv+key)");
  assert.equal(first.hasConfig, true, "siteConfig must decrypt");
  assert.ok(first.config.transport, "transport should be present");
  console.log(
    "initial SSR config:",
    first.config.transport,
    first.config.engine,
  );

  const ax = await page.context().newCDPSession(page);
  const tree = await ax.send("Accessibility.getFullAXTree");
  const names = tree.nodes
    .filter((node) => !node.ignored)
    .map((node) => node.name?.value ?? "")
    .filter(Boolean);
  assert.ok(
    names.some((name) => name.includes("Holy Unblocker")),
    "closed shadow text should be visible to accessibility tree",
  );
  console.log(
    "closed shadow text accessible:",
    names.filter((name) => name.includes("Holy Unblocker")).slice(0, 4),
  );

  const nativeLink = page.locator('nav > span[class*="_title_"]');
  assert.equal(
    await nativeLink.count(),
    1,
    "native HolyLink should render as a span",
  );
  assert.ok(
    (await nativeLink.boundingBox())?.width > 0,
    "native HolyLink must be visible",
  );

  // The /uv FAQ link is a real HolyLink, and /faq renders without Theatre API.
  const faqLink = page.locator('span[class*="_themeLink_"]').first();
  assert.ok(
    (await faqLink.boundingBox())?.width > 0,
    "FAQ HolyLink must be visible",
  );

  const [middleTab] = await Promise.all([
    context.waitForEvent("page", { timeout: 6000 }),
    faqLink.click({ button: "middle" }),
  ]);
  await middleTab.waitForLoadState("domcontentloaded");
  assert.equal(
    new URL(middleTab.url()).pathname,
    "/faq",
    "middle-click opens FAQ in another tab",
  );
  assert.equal(new URL(page.url()).pathname, "/uv");
  await middleTab.close();

  // Ctrl+click must open a new browser tab and leave the active route alone.
  const currentRoute = page.url();
  const [tab] = await Promise.all([
    context.waitForEvent("page", { timeout: 6000 }),
    faqLink.click({ modifiers: ["Control"] }),
  ]);
  await tab.waitForLoadState("domcontentloaded");
  assert.equal(
    new URL(tab.url()).pathname,
    "/faq",
    "Ctrl+click opens FAQ in another tab",
  );
  assert.equal(
    page.url(),
    currentRoute,
    "Ctrl+click leaves original page unchanged",
  );
  await tab.close();

  await faqLink.click();
  await page.waitForURL((url) => url.pathname === "/faq", { timeout: 15000 });
  console.log(
    "route after native HolyLink click:",
    new URL(page.url()).pathname,
  );
  const second = await keyAndConfig();
  assert.notEqual(second.key, first.key, "key rotates between SSR pages");
  assert.equal(second.hasConfig, true, "siteConfig decrypts after navigation");
  assert.ok(second.config.engine);
  // Astro can update the URL before the new page's client text has revealed
  // inside closed shadow roots. Poll accessibility rather than sampling it
  // in the same tick as the route change.
  let faqVisible = false;
  for (let attempt = 0; attempt < 20 && !faqVisible; attempt++) {
    const faqTree = await ax.send("Accessibility.getFullAXTree");
    faqVisible = faqTree.nodes.some(
      (node) => !node.ignored && String(node.name?.value ?? "").includes("FAQ"),
    );
    if (!faqVisible) await page.waitForTimeout(200);
  }
  assert.ok(faqVisible, "FAQ text should be rendered after navigation");
  assert.deepEqual(errors, [], "no JavaScript exceptions");
  console.log("browser smoke PASS");
  passed = true;
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await context.close();
  if (ownsBrowser) await browser.close();
  // The CDP connection stays open after context.close(). Only end the
  // standalone smoke process, not the shared Chrome instance.
  else process.exit(passed ? 0 : 1);
}
