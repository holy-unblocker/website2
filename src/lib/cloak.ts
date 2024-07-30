import { parse } from "node-html-parser";

export interface AppCloak {
  icon: string;
  title: string;
  url: string;
}

export const randomCloaks: (string | AppCloak)[] = [
  {
    icon: "https://ssl.gstatic.com/classroom/ic_product_classroom_32.png",
    title: "Classes",
    url: "https://classroom.google.com/",
  },
  "about:blank",
  // LMS and educational sites:
  "https://canvas.instructure.com/",
  "https://www.edmodo.com/",
  "https://www.khanacademy.org/",
  "https://quizlet.com/",
  "https://www.turnitin.com/",
  "https://www.coursera.org/",
  // Search engines:
  "https://search.yahoo.com/",
  "https://www.duckduckgo.com/",
  // General information and news:
  "https://www.wikipedia.org/",
  "https://www.bbc.com/news",
  "https://edition.cnn.com/",
  "https://www.nytimes.com/",
  // Tech and development:
  "https://gitlab.com/",
  "https://github.com/",
  "https://stackoverflow.com/",
  "https://developer.apple.com/",
  "https://apple.com/",
  // Productivity and utilities:
  "https://docs.google.com/",
  "https://www.trello.com/",
  "https://evernote.com/",
  "https://www.asana.com/",
  "https://www.todoist.com/",
  "https://www.surveymonkey.com/",
  "https://www.typeform.com/",
  // Social media (if allowed):
  "https://www.linkedin.com/",
  // Shopping and entertainment:
  "https://www.goodreads.com/",
  // Others (casual and school-useful):
  "https://www.weather.com/",
  "https://translate.google.com/",
  "https://maps.google.com/",
  "https://www.reddit.com/",
  "https://answers.microsoft.com/en-us",
  "https://www.medium.com/",
  "https://www.wolframalpha.com/",
];

export async function getRandomCloak(): Promise<AppCloak | undefined> {
  let retries = 5;

  while (true) {
    let cloak = randomCloaks[~~(Math.random() * randomCloaks.length)];

    try {
      if (typeof cloak === "string") cloak = await extractCloakData(cloak);
      return cloak;
    } catch (err) {
      console.error("Error fetching random cloak:", cloak, err);
    }

    retries--;
    if (retries === 0) {
      console.error("Max retries exceeded for cloak");
      break;
    }
  }
}

export async function extractCloakData(address: string): Promise<AppCloak> {
  if (address === "about:blank")
    return {
      title: "about:blank",
      icon: "",
      url: "about:blank",
    };

  const res = await fetch(address);

  if (!res.ok) throw new Error(`Cloak address gave status code ${res.status}`);

  const root = parse(await res.text());

  const url = new URL(res.url);

  // try to find the title
  const t = root.querySelector("title");
  const title = t ? t.textContent : `${url.host}${url.pathname}${url.search}`;

  if (title.toLowerCase().includes("redirecting"))
    throw new Error(`Cloak was redirecting...`);

  // try to find a shortcut icon
  const iconSelector = root.querySelector("link[rel*='icon']");
  const href = iconSelector?.getAttribute("href");

  // fallback to /favicon.ico
  const icon =
    typeof href === "string"
      ? new URL(href, url).toString()
      : url.origin + "/favicon.ico";

  return { icon, title, url: res.url };
}
