/**
 * @type {import("./config").AppConfig}
 */
export const appConfig = {
  host: "127.0.0.1",
  port: 4321,
  db: {
    user: "user",
    password: "password",
    host: "127.0.0.1",
    port: 5432,
    database: "theatre",
  },
  apis: {
    db: "%{location.protocol}//%{location.host}/api/",
    theatre: "%{location.protocol}//%{location.host}/cdn/",
    wisp: "%{location.wsprotocol}//api.%{location.host}/",
  },
  emails: {
    support: "support@example.com",
  },
  links: {
    patreon: "https://www.patreon.com/holyunblocker",
    github: {
      org: "https://github.com/holy-unblocker",
      website: "https://github.com/holy-unblocker/website",
      websiteaio: "https://github.com/holy-unblocker/website-aio",
    },
    discord: {
      titaniumnetwork: "https://discord.gg/unblock",
      holyunblocker: "https://discord.gg/JFDCJzFana",
    },
  },
};
