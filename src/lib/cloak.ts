import { parse } from "node-html-parser";

export interface AppCloak {
  icon: string;
  title: string;
  url: string;
}

export const randomCloaks: (string | AppCloak)[] = [
  // LMS:
  // some of these are links to the product, not the actual LMS...
  "https://clever.com/oauth/district-picker",
  "https://kahoot.it/",
  "https://www.opensesame.com/user/login",
  "https://www.olivevle.com/contact-us/",
  "https://readingsohs.edvance360.com/",
  "https://suite.vairkko.com/APP/index.cfm/account/Login?reqEvent=main.index&qs=",
  "https://articulate.com/360",
  "https://www.blackboard.com/student-resources",
  "https://bridgelt.com/",
  {
    icon: "https://ssl.gstatic.com/classroom/ic_product_classroom_32.png",
    title: "Classes",
    url: "https://classroom.google.com/",
  },
  // etc:
  "about:blank",
  "https://www.bing.com/",
  "https://www.google.com/",
  "https://www.startpage.com/",
  "https://getfedora.org/",
  "https://www.debian.org/",
  "https://www.opensuse.org",
  "https://nodejs.org/",
  "https://www.microsoft.com/",
  "https://nextjs.org/docs/getting-started",
  "https://addons.mozilla.org/en-US/firefox/",
  "https://addons.mozilla.org/en-US/firefox/addon/fate-stay-night-trace-on/?utm_source=addons.mozilla.org&utm_medium=referral&utm_content=featured",
  "https://developer.mozilla.org/en-US/plus",
  "https://huggingface.co/",
  "https://huggingface.co/docs",
  "https://www.google.com/chromebook/",
  "https://workshop.premiumretail.io/external/landing/6b1c3d1225ebd/",
  "https://https://beta.reactjs.org/",
  "https://photomath.com/",
  "https://photomath.com/en/termsofuse",
  "https://www.mathway.com/Algebra",
  "https://monkeytype.com/security-policy",
  "https://www.bbcgoodfood.com/howto/guide/baking-beginners",
  "https://smallbusiness.withgoogle.com/",
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
      retries--;
      if (retries === 0) {
        console.error("Max retries exceeded for cloak");
        break;
      }
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
  const title = t
    ? t.textContent.slice(0, 32)
    : `${url.host}${url.pathname}${url.search}`;

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
