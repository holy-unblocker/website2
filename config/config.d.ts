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
    patreon: string;
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
