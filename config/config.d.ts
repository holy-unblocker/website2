// for code readability:
// type definitions will assume every config field exists
// or else u get to assert every: appConfig.mailer!.noreply

// DOCUMENTATION AND EXAMPLES OF ALL THIS CRAP
// CAN BE FOUND IN config.example.js

interface DockerConfig {
  /**
   * The type of connection to use to connect to the Docker daemon.
   * @default "socket"
   */
  type?: "http" | "socket";
  /**
   * The path to the Docker socket to connect to, if using a socket connection.
   * @default "/var/run/docker.sock"
   */
  socket?: string;
  /**
   * The host to connect to, if using an HTTP connection.
   */
  host?: string;
  /**
   * The port for the docker host, if using an HTTP connection.
   */
  port?: number;
  /**
   * The Docker network used for connecting to containers
   */
  network: string;
}

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
    priceIds: {
      premium: string;
    };
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
