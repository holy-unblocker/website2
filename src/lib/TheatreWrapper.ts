import type { Client } from "pg";
import type {
  ListData,
  ListOptions,
  TheatreEntry,
  TheatreEntryMin,
} from "@lib/TheatreAPI";
import type { m } from "@lib/util";
import type { TheatreModel } from "./models";

export const theatreTypes = [
  "emulator.nes",
  "emulator.gba",
  "emulator.n64",
  "emulator.genesis",
  "flash",
  "embed",
  "proxy",
];

export function rowTo(entry: m.TheatreModel) {
  return {
    ...entry,
    controls: JSON.parse(entry.controls),
    category: entry.category.split(","),
  } as TheatreEntry;
}

export function rowToMin(entry: m.TheatreModel): TheatreEntryMin {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category.split(","),
  };
}

function validate(entry: TheatreEntry): entry is TheatreEntry {
  if ("id" in entry)
    if (typeof entry.id !== "string")
      throw new TypeError("Entry ID was not a string");

  if ("name" in entry)
    if (typeof entry.name !== "string")
      throw new TypeError("Entry name was not a string");

  if ("category" in entry) {
    if (!(entry.category instanceof Array))
      throw new TypeError("Entry category was not an array");

    for (const category of entry.category)
      if (typeof category !== "string")
        throw new TypeError("Entry category element was not an array");
  }

  if ("controls" in entry)
    if (!(entry.controls instanceof Array))
      throw new TypeError("Entry controls was not an array");

  if ("src" in entry)
    if (typeof entry.src !== "string")
      throw new TypeError("Entry src was not a string");

  if ("plays" in entry)
    if (typeof entry.plays !== "number")
      throw new TypeError("Entry plays was not a number");

  if ("type" in entry)
    if (!theatreTypes.includes(entry.type))
      throw new TypeError(
        `Entry type was not one of the following: ${theatreTypes}`
      );

  return true;
}

export default class TheatreWrapper {
  client: Client;
  constructor(client: Client) {
    this.client = client;
  }
  async indexID(index: number) {
    const {
      rows: [result],
    } = await this.client.query("SELECT id FROM theatre WHERE index = $1;", [
      index,
    ]);

    if (result === undefined) {
      throw new RangeError(`Entry doesn't exist at index ${index}.`);
    }

    return result.id;
  }
  async show(id: string) {
    const row = (
      await this.client.query<TheatreModel>(
        "SELECT * FROM theatre WHERE id = $1",
        [id]
      )
    ).rows[0];

    if (row) return rowTo(row);
  }
  async list(
    options: ListOptions = {},
    _signal?: AbortSignal
  ): Promise<ListData> {
    // 0: select, 1: condition, 3: order, 3: limit, 4: offset
    const select = [];
    const conditions = [];
    const vars = [];
    const selection = ["*", "count(*) OVER() AS total"];

    if (typeof options.limitPerCategory === "number")
      conditions.push(
        `(SELECT COUNT(*) FROM theatre b WHERE string_to_array(b."category", ',') && string_to_array(a."category", ',') AND a."index" < b."index") < $${vars.push(
          options.limitPerCategory
        )}`
      );

    if (typeof options.ids === "object") {
      // split the entry category into an array
      // check if the input categories array has any elements in common with the entry category array
      conditions.push(
        `id = ANY(string_to_array($${vars.push(options.ids.join(","))}, ','))`
      );
    }

    if (
      typeof options.category === "object" &&
      options.category !== null &&
      options.category.every((e) => typeof e === "string") &&
      typeof options.category[0] === "string"
    ) {
      // split the entry category into an array
      // check if the input categories array has any elements in common with the entry category array
      conditions.push(
        `string_to_array(category, ',') && string_to_array($${vars.push(
          options.category.join(",")
        )}, ',')`
      );
    }

    if (typeof options.category === "string") {
      conditions.push(
        `$${vars.push(options.category)} = ANY(string_to_array(category, ','))`
      );
    }

    const order = [];

    switch (options.sort) {
      case "name":
        order.push("name", "id");
        break;
      case "plays":
        order.push("-plays", "name", "id");
        break;
    }

    if (typeof options.search === "string") {
      selection.push(
        `similarity(name, $${vars.push(options.search.toUpperCase())}) as sml`
      );
      order.push("sml DESC", "name");
    }

    if (order.length) {
      select[2] = [
        "ORDER BY",
        (options.order === "asc"
          ? order.map((order) => `${order} DESC`)
          : order
        ).join(","),
      ]
        .filter(Boolean)
        .join(" ");
    }

    if (conditions.length) {
      select[1] = `WHERE ${conditions.join("AND")}`;
    }

    if (typeof options.limit === "number")
      select[3] = `LIMIT $${vars.push(options.limit)}`;

    if (typeof options.offset === "number")
      select[4] = `OFFSET $${vars.push(options.offset)}`;

    const query =
      ["SELECT", selection.join(", "), "FROM theatre a", ...select]
        .filter(Boolean)
        .join(" ") + ";";

    const { rows } = await this.client.query<TheatreModel & { total: string }>(
      query,
      vars
    );

    const total = parseInt(rows[0]?.total);

    const entries = rows.map(rowToMin);

    return {
      total,
      entries,
    };
  }
  async delete(id: string) {
    return (
      (await this.client.query("DELETE FROM theatre WHERE id = $1;", [id]))
        .rowCount !== 0
    );
  }
  async create(
    name: TheatreEntry["name"],
    type: TheatreEntry["type"],
    src: TheatreEntry["src"],
    category: TheatreEntry["category"],
    controls: TheatreEntry["controls"]
  ) {
    const entry = {
      id: Math.random().toString(36).slice(2),
      name,
      type,
      category,
      src,
      plays: 0,
      controls,
    };

    validate(entry);

    const vars: unknown[] = [];

    await this.client.query(
      `INSERT INTO theatre(id, name, type, category, src, plays, controls) VALUES ($${vars.push(
        entry.id
      )}, $${vars.push(entry.name)}, $${vars.push(entry.type)}, $${vars.push(
        entry.category.join(",")
      )}, $${vars.push(entry.src)}, $${vars.push(entry.plays)}, $${vars.push(
        JSON.stringify(entry.controls)
      )});`,
      vars
    );

    return entry;
  }
  async update(
    id: TheatreEntry["id"],
    name: TheatreEntry["name"],
    type: TheatreEntry["type"],
    src: TheatreEntry["src"],
    category: TheatreEntry["category"],
    controls: TheatreEntry["controls"]
  ) {
    let entry = await this.show(id);

    if (!entry) return false;

    if (name === undefined) name = entry.name;

    if (type === undefined) type = entry.type;

    if (src === undefined) src = entry.src;

    if (category === undefined) category = entry.category;

    if (controls === undefined) controls = entry.controls;

    entry = {
      id,
      name,
      type,
      category,
      src,
      controls,
      plays: 0,
    };

    validate(entry);

    const vars: unknown[] = [];

    const res = (
      await this.client.query<TheatreModel>(
        `UPDATE theatre SET name = $${vars.push(
          entry.name
        )}, type = $${vars.push(entry.type)}, category = $${vars.push(
          entry.category.join(",")
        )}, src = $${vars.push(entry.src)}, controls = $${vars.push(
          JSON.stringify(entry.controls)
        )} WHERE id = $${vars.push(entry.id)} RETURNING *;`,
        vars
      )
    ).rows[0];

    return res === undefined ? undefined : rowTo(res);
  }
  async countPlay(id: string): Promise<boolean> {
    return (
      (
        await this.client.query(
          `UPDATE theatre SET plays = plays + 1 WHERE id = $1`,
          [id]
        )
      ).rowCount !== 0
    );
  }
}
