// This config is only loaded on the serverside and should never be used on the client.

// Example configuration:
// - no local db operations, mirrors holyubofficial.net for game database
// - not hosting theatre files locally, mirrors holyubofficial.net for thumbnails and game files
// - hosts wisp-server-node

/**
 * @type {import("./config").AppConfig}
 */
export const appConfig = {
  // name of this config file, eg "my website", "development", "production"
  // for troubleshooting
  configName: "example config",

  // flavor of HU hat icon to display
  // accepted values are "normal", "beta", "dev" (default is "dev")
  hatBadge: "dev",

  // FRONTEND LISTENING ADDRESS
  // an http server will be created on this host & port
  host: "localhost",
  port: 8080,

  // specifies a mirror for the theatre api
  // this mirror is used if there are no database credentials
  theatreApiMirror: "https://holyubofficial.net/api/theatre/",
  // specifies a holy unblocker theatre mirror
  theatreFilesMirror: "https://holyubofficial.net/cdn/",

  // specifies the path to where theatre files are hosted.
  // See https://github.com/holy-unblocker/theatre/
  // If not specified, it will proxy the mirror
  //theatreFilesPath: "/home/ubuntu/theatre/public/",

  // wisp server url
  // If not specified, it will host wisp locally on /api/wisp
  // holyubofficial.net hosts wisp on the `api.` subdomain
  // string vars are calculated on the client-side, not by astro!!
  // - %{ws} - `ws:` or `wss:` depending on whether the location is http: or https:
  // - %{host} - the website host with the port appended, eg `127.0.0.1:4321`
  // - %{hostname} - the website host WITHOUT the port appended - *why would you ever use this?*
  // - %{ws} - `ws:` or `wss:` depending on whether the location is http: or https:
  //separateWispServer: "%{ws}//api.%{host}/",

  // SUPPORT EMAIL
  // shown on /contact
  //supportEmail: "support@holyubofficial.net",

  // a link to the main Holy Unblocker website
  // - is a hostname, doesn't include the port
  // - shown in emails
  // - used to not automatically set a cloak
  // - used to determine if metadata should be inserted
  // - used to determine if x-robots-tag should be set
  mainWebsite: "holyubofficial.net",

  // POSTGRES DATABASE CONFIG
  // if no credentials are specified, it will proxy the mirror
  // optionally string
  // strings are also acceptable

  // local postgresql server:
  //db: "postgresql://user:secret@127.0.0.1/dbname",

  //db: {
  //  user: "user",
  //  password: "secret",
  //  host: "127.0.0.1",
  //  port: 5432,
  //  database: "dbname",
  //},

  /// STRIPE CONFIG
  // - ASSIGN A STRIPE CUSTOMER ID TO EACH USER
  // - CREATE INVOICES FOR SUBSCRIPTIONS

  //stripe: {
  //  secret: "API secret",
  //  webhookEndpointSecret: "webhook secret",
  //},

  // NOWPAYMENTS CONFIG
  // - PAYING CRYPTO INVOICES
  //nowpayments: {
  //  key: "0000000-0000000-0000000-0000000",
  //  notificationsKey: "super secret key here",
  //  sandbox: true,
  //},

  // See config options here: https://github.com/apocas/dockerode
  //docker: {
  //  socketPath: "/var/run/docker.sock",
  //},

  // HCAPTCHA CONFIG
  // HIGHLY RECOMMENDED
  // https://www.hcaptcha.com/ integration
  //hcaptcha: {
  //  siteKey: "10000000-ffff-ffff-ffff-000000000001",
  //  secret: "0x0000000000000000000000000000000000000000",
  //},

  // DISCORD CONFIG
  // - USES OAUTH2 TO LINK DISCORD ACC TO DASHBOARD
  // - GIVE SUPPORTERS THEIR ROLES IN THE HOLY UB DISCORD
  // https://discord.com/developers/applications

  //discord: {
  //  listenForJoins: false, // if you're developing, you don't want to spam discord's api
  //  botToken: "DISCORD BOT TOKEN HERE",
  //  clientId: "OAUTH CLIENT ID",
  //  clientSecret: "OAUTH CLIENT SECRET",
  //  clientRedirectURI: "https://holyubofficial.net/pro/linkdiscord",
  //  guildId: "1263780452356063273", // holy unblocker's discord server
  //  roleIds: {
  //    premium: "1264613836040835093", // premium subscribers
  //  },
  //},

  // MAILER CONFIG
  // receipts, recovery, contacting, password resets, etc..
  // holyuboffical.net hosts postfix
  // you can setup POP with a burner gmail to send emails
  // these options are passed to nodemailer.createTransport

  //mailer: {
  //  // enter your SMTP server configuration.
  //  // strings are also acceptable
  //  // local smtp server: transport: "smtp://127.0.0.1:25",
  //  transport: {
  //    host: "smtp.ethereal.email",
  //    port: 587,
  //    secure: false, // Use `true` for port 465, `false` for all other ports
  //    auth: {
  //      user: "maddison53@ethereal.email",
  //      pass: "jn7jnAPss4f63QBp6D",
  //    },
  //  },
  // people can contact us via our support email
  //  sender: {
  //    address: "support@holyubofficial.net",
  //    name: "Holy Unblocker Team",
  //  },
  //  // email to send verifications from
  //  noreply: "noreply@holyubofficial.net",
  //},

  // general website links
  links: {
    // add your affiliate link here
    billigerhost: "https://billing.billigerhost.com/",
    patreon: {
      holyunblocker: "https://www.patreon.com/holyunblocker",
    },
    github: {
      ultraviolet: "https://github.com/titaniumnetwork-dev/Ultraviolet",
      titaniumnetwork: "https://github.com/titaniumnetwork-dev",
      mercuryworkshop: "https://github.com/MercuryWorkshop",
      // link to this repository
      // used in the contact page and navbar
      holyunblocker: "https://github.com/holy-unblocker/website2",
    },
    discord: {
      titaniumnetwork: "https://discord.gg/unblock",
      holyunblocker: "https://discord.gg/VZguJSmMcN",
    },
  },
};
