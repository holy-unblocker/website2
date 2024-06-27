import type { Client } from "pg";

export const proxyTypes = ["ultraviolet", "rammerhead", "stomp"];

interface Compat {
  host: string;
  proxy: "ultraviolet" | "rammerhead" | "stomp" | string;
}

export default class CompatWrapper {
  client: Client;
  constructor(client: Client) {
    this.client = client;
  }
  async show(host: string) {
    return (
      await this.client.query<Compat>("SELECT * FROM compat WHERE host = $1", [
        host,
      ])
    ).rows[0] as Compat | undefined;
  }
  async list() {
    return (await this.client.query<Compat>("SELECT * FROM compat;")).rows;
  }
  async delete(host: string) {
    return (
      (await this.client.query("DELETE FROM compat WHERE host = $1;", [host]))
        .rowCount !== 0
    );
  }
  async create(host: Compat["host"], proxy: Compat["proxy"]) {
    return (
      await this.client.query(
        "INSERT INTO compat (host, proxy) VALUES ($1, $2) RETURNING *;",
        [host, proxy]
      )
    ).rows[0];
  }
  async update(host: Compat["host"], proxy: Compat["proxy"]) {
    return (
      await this.client.query<Compat>(
        "UPDATE compat SET proxy = $1 WHERE host = $2 RETURNING *;",
        [proxy, host]
      )
    ).rows[0];
  }
}
