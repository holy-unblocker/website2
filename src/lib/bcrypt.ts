// hey at least it works
import { createRequire } from "module";

const bcrypt = createRequire(import.meta.url)(
  "@node-rs/bcrypt",
) as typeof import("@node-rs/bcrypt");

export const hash = bcrypt.hash;
export const compare = bcrypt.compare;
