import pg from "pg";
import { appConfig } from "@config/config";
import TheatreWrapper from "./TheatreWrapper";

const gloo = globalThis as unknown as { pginstance: pg.Client };

export const db = gloo.pginstance || (await initDB());

async function initDB() {
  const cli = new pg.Client({
    ...appConfig.db,
  });

  cli.connect();

  return cli;
}

if (process.env.NODE_ENV !== "production") gloo.pginstance = db;

export const theatreAPI = new TheatreWrapper(db);
