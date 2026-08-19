import type { TheatreEntry, TheatreEntryMin } from "./TheatreAPI.ts";

export function toPublicGame(entry: TheatreEntry) {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category[0],
    categories: entry.category,
    type: entry.type,
    controls: entry.controls,
    src: entry.src,
  };
}

export function toPublicGameMin(entry: TheatreEntryMin, rank?: number) {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category[0],
    categories: entry.category,
    type: entry.type,
    controls: entry.controls,
    rank,
  };
}
