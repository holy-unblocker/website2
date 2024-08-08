// for code readability:
// type definitions will assume every config field exists
// or else u get to assert every: appConfig.mailer!.noreply

// DOCUMENTATION AND EXAMPLES OF ALL THIS CRAP
// CAN BE FOUND IN config.example.js

export interface AppConfig {
  configName: string;
  hatBadge?: "dev" | "beta" | "normal";
  host: string;
  port: number;
  theatreApiMirror: string;
  theatreFilesMirror: string;
  theatreFilesPath: string;
  separateWispServer?: string;
  db:
    | string
    | {
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
  };
  nowpayments: {
    key: string;
    notificationsKey: string;
    sandbox: boolean;
  };
  docker: import("dockerode").DockerOptions;
  hcaptcha: {
    siteKey: string;
    secret: string;
  };
  mailer: {
    transport: Parameters<typeof import("nodemailer")["createTransport"]>[0];
    sender: import("nodemailer").SendMailOptions["sender"];
    noreply: string;
  };
  discord: {
    listenForJoins: boolean;
    botToken: string;
    clientId: string;
    clientSecret: string;
    clientRedirectURI: string;
    guildId: string;
    roleIds: {
      premium: string;
    };
  };
  links: {
    billigerhost?: string;
    patreon: {
      holyunblocker: string;
    };
    github: {
      ultraviolet: string;
      titaniumnetwork: string;
      mercuryworkshop: string;
      holyunblocker: string;
    };
    discord: {
      titaniumnetwork: string;
      holyunblocker: string;
    };
  };
}

export const appConfig: AppConfig;
