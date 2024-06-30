// for code readability:
// type definitions will assume every config field exists
// or else u get to assert every: appConfig.mailer!.noreply

// DOCUMENTATION AND EXAMPLES OF ALL THIS CRAP
// CAN BE FOUND IN config.example.js

export interface AppConfig {
  configName: string;
  host: string;
  port: number;
  theatreApiMirror: string;
  theatreFilesMirror: string;
  theatreFilesPath: string;
  separateWispServer: string;
  db: {
    user: string;
    password: string;
    host: string;
    port: number;
    database: string;
  };
  supportEmail: string;
  mainWebsite: string;
  stripe: {
    secret: string;
    webhookEndpointSecret: string;
    priceIds: {
      official: string;
      ultimate: string;
    };
  };
  mailer: {
    transport: Parameters<typeof import("nodemailer")["createTransport"]>[0];
    sender: import("nodemailer").SendMailOptions["sender"];
    noreply: string;
  };
  discord: {
    botToken: string;
    clientId: string;
    clientSecret: string;
    clientRedirectURI: string;
    guildId: string;
    roleIds: {
      donator: string;
      ultimate: string;
    };
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
}

export const appConfig: AppConfig;
