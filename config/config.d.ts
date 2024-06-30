// Config is only fully loaded on the serverside.
// Client should only have access to the "apis" part of the config.

export interface AppConfig {
  host: string;
  port: number;
  db: {
    user: string;
    password: string;
    host: string;
    port: number;
    database: string;
  };
  apis: {
    db: string;
    theatre: string;
    wisp: string;
  };
  emails: {
    support: string;
  };
  links: {
    github: {
      org: string;
      website: string;
      websiteaio: string;
    };
    discord: {
      titaniumnetwork: string;
      holyunblocker: string;
    };
  };
  // used to give discord perks and for account integration
  discord?: {
    botToken: string;
    donatorRoleId: string;
    ultimateRoleId: string;
    // oauth stuff
    guildId: string;
    clientId: string;
    clientSecret: string;
    redirectURI: string; // this should go to /donate/linkdiscord on ur official domain
  };
  // donator stuff
  smtpTransport?: string;
  stripe?: {
    publish: string;
    secret: string;
    endpointSecret: string;
    // stripe price ids for each tier
    // used for creating invoices
    priceIds: {
      official: string;
      ultimate: string;
    };
  };
}

export const appConfig: AppConfig;
