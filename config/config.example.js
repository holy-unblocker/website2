// This config is only loaded on the serverside and should never be used on the client.

// Example configuration:
// - no local db operations, mirrors holyunb.locker for game database
// - not hosting theatre files locally, mirrors holyunb.locker for thumbnails and game files
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
  host: "0.0.0.0",
  port: 8080,

  theatre: {
    // specifies a mirror for the theatre api
    // this mirror is used if there are no database credentials
    apiMirror: "https://holyunb.locker/api/theatre/",
    // specifies a holy unblocker theatre mirror
    filesMirror: "https://holyunb.locker/cdn/",

    // specifies the path to where theatre files are hosted.
    // See https://github.com/holy-unblocker/theatre/
    // If not specified, it will proxy the mirror
    //filesPath: "/home/ubuntu/theatre/public/",

    // when true and the database has no admin users, /admin/signup can create
    // the first theatre admin account
    adminSignupEnabled: true,

    // when false, opening theatre games will not increment their play counts
    playCountingEnabled: true,
  },

  // wisp server url
  // If not specified, it will host wisp locally on /api/wisp
  // holyunb.locker hosts wisp on the `api.` subdomain
  // string vars are calculated on the client-side, not by astro!!
  // - %{ws} - `ws:` or `wss:` depending on whether the location is http: or https:
  // - %{host} - the website host with the port appended, eg `127.0.0.1:4321`
  // - %{hostname} - the website host WITHOUT the port appended - *why would you ever use this?*
  // - %{ws} - `ws:` or `wss:` depending on whether the location is http: or https:
  //separateBareServer: "%{protocol}//api.%{host}/bare/",
  //separateWispServer: "wss://wisp.mercurywork.shop/",

  // SUPPORT EMAIL
  // shown on /contact
  //supportEmail: "support@holyunb.locker",

  // a link to the main Holy Unblocker website
  // - is a hostname, doesn't include the port
  // - shown in emails
  // - used to not automatically set a cloak
  // - used to determine if metadata should be inserted
  // - used to determine if x-robots-tag should be set
  mainWebsite: "holyunb.locker",

  // GOOGLE ADSENSE
  // your AdSense publisher ID, eg "ca-pub-XXXXXXXXXXXXXXXX"
  // if specified, the adsbygoogle.js snippet is added to the page head
  // (only on the main website)
  //adsenseClient: "ca-pub-XXXXXXXXXXXXXXXX",

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
  //  clientRedirectURI: "https://holyunb.locker/pro/linkdiscord",
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
  //    address: "support@holyunb.locker",
  //    name: "Holy Unblocker Team",
  //  },
  //  // email to send verifications from
  //  noreply: "noreply@holyunb.locker",
  //},

  // general website links
  links: {
    patreon: {
      holyunblocker: "https://www.patreon.com/holyunblocker",
    },
    github: {
      ultraviolet: "https://github.com/titaniumnetwork-dev/Ultraviolet",
      scramjet: "https://github.com/MercuryWorkshop/scramjet",
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
