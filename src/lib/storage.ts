// import NotificationsManager from "./Notifications";
// import type { NotificationsManagerRef } from "./Notifications";
import Settings, { useSettings } from "@lib/Settings";

export class Scroll {
  x: number;
  y: number;
  constructor(
    x = document.documentElement.scrollLeft,
    y = document.documentElement.scrollTop
  ) {
    this.x = x;
    this.y = y;
  }
  scroll() {
    document.documentElement.scrollTo(this.x, this.y);
  }
}

export interface CloakSettings {
  url: string;
  title: string;
  icon: string;
}

export interface GlobalSettings {
  proxy: string;
  proxyMode: string;
  favorites: string[];
  seenGames: string[];
}

export const globalSettings = new Settings<GlobalSettings>("global settings", {
  proxy: "automatic",
  proxyMode: "embedded",
  favorites: [],
  seenGames: [],
});

export const globalCloakSettings = new Settings<CloakSettings>(
  "cloak settings",
  {
    url: "",
    title: "",
    icon: "",
  }
);

export const useGlobalSettings = () => useSettings(globalSettings);

export const useGlobalCloakSettings = () => useSettings(globalCloakSettings);
