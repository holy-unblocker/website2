// Browser smoke test of /settings/uv and the proxy cookies (src/lib/proxyCookies.js).
//
// Against a running build: WEBSITE2_TEST_URL is its origin. WEBSITE2_CDP points
// at an existing Chrome to reuse; without it a headless Chromium is launched.
// Checks that cookies written before the rename are migrated by the browser,
// that the renamed settings controls save encoded values, and that no cookie
// name or value names the proxy.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { decodeRelay } from "../src/lib/proxyCookies.js";

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
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

const leakWords =
  /wisp|bare|epoxy|libcurl|scramjet|ultraviolet|engine=(?:uv|sj)/i;
const settle = () => page.waitForTimeout(500);
const cookies = async () =>
  Object.fromEntries(
    (await context.cookies(origin)).map(({ name, value }) => [name, value]),
  );

try {
  // 1. A visitor whose browser wrote the old cookies itself: host-only, raw.
  await page.goto(`${origin}/settings/uv`, { waitUntil: "load" });
  await page.evaluate(() => {
    const attributes = "; max-age=99999; samesite=strict; path=/";
    document.cookie = `bareServer=https://legacy-a.invalid/r/${attributes}`;
    document.cookie = `wispServer=wss://legacy-b.invalid/r/${attributes}`;
    document.cookie = `trans=bare${attributes}`;
    document.cookie = `engine=sj${attributes}`;
  });
  await page.reload({ waitUntil: "load" });
  await settle();
  let jar = await cookies();
  assert.equal(jar.bareServer, undefined, "old bare server cookie dropped");
  assert.equal(jar.wispServer, undefined, "old wisp server cookie dropped");
  assert.equal(decodeRelay(jar.ra), "https://legacy-a.invalid/r/");
  assert.equal(decodeRelay(jar.rb), "wss://legacy-b.invalid/r/");
  assert.equal(jar.trans, "b");
  assert.equal(jar.engine, "2");
  assert.equal(
    await page.inputValue("#relayUrlA"),
    "https://legacy-a.invalid/r/",
  );
  assert.equal(
    await page.inputValue("#relayUrlB"),
    "wss://legacy-b.invalid/r/",
  );
  console.log("old cookies migrated, values shown in the settings");

  // 2. The transport selector, through real clicks.
  await page.click("#routeVia [data-ts-toggle]");
  await page.click("#routeVia [data-ts-list] > :nth-child(1)");
  await settle();
  assert.equal((await cookies()).trans, "e", "first transport saved as e");
  await page.click("#routeVia [data-ts-toggle]");
  await page.click("#routeVia [data-ts-list] > :nth-child(2)");
  await settle();
  assert.equal((await cookies()).trans, "b", "second transport saved as b");
  console.log("transport selector saves encoded values");

  // 3. The relay forms: save one, reset the other.
  await page.fill("#relayUrlB", "wss://relay-b.invalid/new/");
  await page.press("#relayUrlB", "Enter");
  await settle();
  assert.equal(decodeRelay((await cookies()).rb), "wss://relay-b.invalid/new/");
  await page.fill("#relayUrlA", "");
  await page.press("#relayUrlA", "Enter");
  await page.waitForLoadState("load");
  await settle();
  jar = await cookies();
  assert.equal(jar.ra, undefined, "an empty relay resets to the default");
  assert.equal(jar.bareServer, undefined);
  console.log("relay forms save encoded values and reset");

  // 4. Nothing a filter or extension can read off the cookies names the proxy.
  const text = `${await page.evaluate(() => document.cookie)}\n${JSON.stringify(jar)}`;
  assert.ok(!leakWords.test(text), `a cookie names the proxy: ${text}`);
  assert.deepEqual(errors, [], "no JavaScript exceptions");
  console.log("settings browser smoke PASS");
  passed = true;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await context.close();
  if (ownsBrowser) await browser.close();
  // The CDP connection stays open after context.close(). Only end this
  // process, never the shared Chrome instance.
  else process.exit(passed ? 0 : 1);
}
