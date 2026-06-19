// Fetches the hagezi DNS blocklist and saves it to public/assets/blacklist.txt
// for the service worker's adblock feature. Run with `npm run fetch-adblock`.
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const BLOCKLIST_URL =
  "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.txt";

const outFile = fileURLToPath(
  new URL("../public/assets/blacklist.txt", import.meta.url),
);

console.log("Fetching adblock blocklist from", BLOCKLIST_URL);

const res = await fetch(BLOCKLIST_URL);
if (!res.ok)
  throw new Error(`Failed to fetch blocklist: ${res.status} ${res.statusText}`);

const text = await res.text();

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, text);

console.log(`Saved ${text.length} bytes to ${outFile}`);
