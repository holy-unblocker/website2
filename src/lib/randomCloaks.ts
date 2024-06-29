export interface CloakData {
  title: string;
  icon: string;
  url: string;
}

export const randomCloaks: (string | CloakData)[] = [
  // LMS:
  // // some  of these are links to the product, not the actual LMS...
  "https://clever.com/oauth/district-picker",
  "https://kahoot.it/",
  "https://moodle.com/login/",
  // 'https://www.opensesame.com/',
  "https://www.opensesame.com/user/login",
  // 'https://www.instructure.com/en-au/canvas',
  "https://www.olivevle.com/contact-us/",
  "https://readingsohs.edvance360.com/",
  // 'https://www.absorblms.com/myabsorb-lms-login-help',
  "https://suite.vairkko.com/APP/index.cfm/account/Login?reqEvent=main.index&qs=",
  "https://articulate.com/360",
  "https://www.blackboard.com/student-resources",
  // 'https://www.sap.com/products/hcm/hxm-suite.html',
  // 'https://www.cornerstoneondemand.com/solutions/learning-and-development-lms/',
  "https://bridgelt.com/lms",
  {
    icon: "https://ssl.gstatic.com/classroom/ic_product_classroom_32.png",
    title: "Classes",
    url: "https://classroom.google.com/",
  },
  {
    icon: "https:////ssl.gstatic.com/classroom/ic_product_classroom_32.png",
    title: "Classes",
    url: "https://classroom.google.com/",
  },
  // ETC:
  "about:blank",
  // 'https://openai.com/',
  "https://getfedora.org/",
  "https://www.debian.org/",
  "https://www.opensuse.org",
  // 'https://nodejs.org/en/',
  "https://www.microsoft.com/en-us/",
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

export function randomCloak() {
  return randomCloaks[~~(Math.random() * randomCloaks.length)];
}
