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

  // FRONTEND LISTENING ADDRESS
  // website2 will start an http server
  host: "127.0.0.1",
  port: 4321,

  // specifies a mirror for the theatre api
  // this mirror is used if there are no database credentials
  theatreApiMirror: "https://holyubofficial.net/api/theatre/",
  // specifies a holy unblocker theatre mirror
  theatreFilesMirror: "https://holyubofficial.net/cdn/",

  // specifies the path to where theatre files are hosted.
  // See https://github.com/holy-unblocker/theatre/
  // If not specified, it will proxy the mirror
  // theatreFilesPath: "/home/ubuntu/theatre/public/",

  // wisp server url
  // If not specified, it will host wisp locally on /wisp/
  // holyubofficial.net hosts wisp on the `api.` subdomain
  // separateWispServer: "%{location.wsprotocol}//api.%{location.host}/",

  // website support email
  // shown on /contact
  // supportEmail: "support@holyubofficial.net",

  // a link to the main Holy Unblocker website
  // - shown in emails
  // - used to not automatically set a cloak
  // - used to determine if metadata should be inserted
  // - used to determine if x-robots-tag should be set
  mainWebsite: "127.0.0.1",
  // mainWebsite: "holyubofficial.net",

  // Postgres database credentials
  // if no credentials are specified, it will proxy the mirror
  // optionally string
  // strings are also acceptable
  // local postgresql server: db: "postgresql://user:secret@localhost/dbname",
  // db: {
  //   user: "user",
  //   password: "secret",
  //   host: "localhost",
  //   port: 5432,
  //   database: "dbname",
  // },

  /// STRIPE CONFIG
  // - ASSIGN A STRIPE CUSTOMER ID TO EACH USER
  // - CREATE INVOICES FOR SUBSCRIPTIONS
  // stripe: {
  //   secret: "API secret",
  //   webhookEndpointSecret: "webhook secret",
  //   priceIds: {
  //     official: "price id for official supporter",
  //     ultimate: "price id for ultimate supporter",
  //   },
  // },

  // DISCORD CONFIG
  // - USES OAUTH2 TO LINK DISCORD ACC TO DASHBOARD
  // - GIVE SUPPORTERS THEIR ROLES IN THE HOLY UB DISCORD
  // - Official Subscriber -> Awesome role
  // - Ultimate Subscriber -> ULTIMATE SUBSCRIBER role
  // https://discord.com/developers/applications
  // discord: {
  //   listenForJoins: false, // if you're developing, you don't want to spam discord's api
  //   botToken: "DISCORD BOT TOKEN HERE",
  //   clientId: "OAUTH CLIENT ID",
  //   clientSecret: "OAUTH CLIENT SECRET",
  //   clientRedirectURI: "https://holyubofficial.net/sub/linkdiscord",
  //   guildId: "1251447707529252896", // holy unblocker's discord server
  //   roleIds: {
  //     official: "1251473356188946544", // official & ultimate subscribers
  //     ultimate: "1256770749230874634", // ultimate subscribers
  //   },
  // },

  // MAILER CONFIG
  // receipts, recovery, contacting, password resets, etc..
  // holyuboffical.net hosts postfix
  // you can setup POP with a burner gmail to send emails
  // these options are passed to nodemailer.createTransport
  // mailer: {
  //   // enter your SMTP server configuration.
  //   // strings are also acceptable
  //   // local smtp server: transport: "smtp://127.0.0.1:25",
  //   transport: {
  //     host: "smtp.ethereal.email",
  //     port: 587,
  //     secure: false, // Use `true` for port 465, `false` for all other ports
  //     auth: {
  //       user: "maddison53@ethereal.email",
  //       pass: "jn7jnAPss4f63QBp6D",
  //     },
  //   },
  //   // people can contact us via our support email
  //   sender: {
  //     address: "support@holyubofficial.net",
  //     name: "Holy Unblocker Team",
  //   },
  //   // email to send verifications from
  //   noreply: "noreply@holyubofficial.net",
  // },

  // general website links
  links: {
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
      holyunblocker: "https://discord.gg/JFDCJzFana",
    },
  },
};
