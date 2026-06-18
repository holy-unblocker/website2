import StaticTheatre from "./StaticTheatre";
import type TheatreAPI from "./TheatreAPI";

// Game data is served statically from config/games.json (no Postgres).
// `dbEnabled` is kept true so existing consumers use the local data source
// (`theatreAPI`) rather than proxying the remote mirror.
export const dbEnabled = true;

export const theatreAPI: StaticTheatre = new StaticTheatre();

export const theatreAPIMirror: TheatreAPI = undefined as any;
