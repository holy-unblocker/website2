import pg from "pg";
import { appConfig } from "@config/config";
import TheatreWrapper from "./TheatreWrapper";
import TheatreAPI from "./TheatreAPI";

export const dbEnabled = "db" in appConfig;

const gloo = globalThis as unknown as { pginstance: pg.Client };

export const db = gloo.pginstance || (await initDB());

async function initDB() {
  if (!dbEnabled) return new pg.Client();

  const cli = new pg.Client({
    ...appConfig.db,
  });

  cli.connect();

  return cli;
}

if (process.env.NODE_ENV !== "production") gloo.pginstance = db;

export const theatreAPI: TheatreWrapper = dbEnabled
  ? new TheatreWrapper(db)
  : (undefined as any);

export const theatreAPIMirror: TheatreAPI = dbEnabled
  ? (undefined as any)
  : new TheatreAPI(appConfig.theatreApiMirror);
