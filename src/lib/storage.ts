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
  proxyMode: string;
  favorites: string[];
  seenGames: string[];
}

// dont access localStorage that way SSR works

export const getGlobalSettings = () =>
  new Settings<GlobalSettings>("global settings", {
    proxyMode: "embedded",
    favorites: [],
    seenGames: [],
  });

export const getGlobalCloakSettings = () =>
  new Settings<CloakSettings>("cloak settings", {
    url: "",
    title: "",
    icon: "",
  });

export const useGlobalSettings = () => useSettings(getGlobalSettings());

export const useGlobalCloakSettings = () =>
  useSettings(getGlobalCloakSettings());
