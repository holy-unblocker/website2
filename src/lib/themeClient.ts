import { setTheme } from "@lib/cookies";

// set the initial theme to the user's preference
if (!document.cookie.includes("theme=")) {
  const preference = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "night"
    : "day";
  setTheme(preference);
}

/*
const themeSwitcher = document.querySelector<HTMLDivElement>(".theme");

if (themeSwitcher)
  themeSwitcher.addEventListener("click", () => {
    setTheme(
      document.documentElement.getAttribute("data-theme") === "light"
        ? "dark"
        : "light"
    );
  });
*/
