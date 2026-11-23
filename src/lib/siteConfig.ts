import { holyDecryptJson } from "@sysce/estrogen/cloak";
import styles from "@styles/UVScripts.module.scss";

export type SiteConfig = {
  transport: string;
  engine: string;
  adblock: "0" | "1";
  noscript: "0" | "1";
  bare: string;
  wisp: string;
  defaultBare: string;
  defaultWisp: string;
  torAvailable: "0" | "1";
  tor: "0" | "1";
  routes: string;
};

let cachedText: string | undefined;
let cachedConfig: SiteConfig | undefined;

export function getSiteConfig(): SiteConfig {
  const ele = document.getElementsByClassName(styles.siteConfig)[0];
  const text = ele?.textContent;
  if (!text) throw new Error("Missing config data.");

  if (cachedConfig && text === cachedText) return cachedConfig;

  cachedText = text;
  const config = holyDecryptJson<SiteConfig>(decodeURIComponent(text));
  if (!config) throw new Error("Invalid encrypted config data.");
  cachedConfig = config;
  return cachedConfig;
}

export function setSiteConfig<K extends keyof SiteConfig>(
  key: K,
  value: SiteConfig[K],
) {
  getSiteConfig()[key] = value;
}
