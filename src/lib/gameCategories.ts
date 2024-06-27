export type categoryKey =
  | "action_"
  | "action"
  | "platformer"
  | "shooter_"
  | "shooter"
  | "rpg"
  | "sandbox"
  | "survival_"
  | "survival"
  | "sports_"
  | "sports"
  | "puzzle";

export interface Category {
  name: string;
  /**
   * ID
   *i18n `name` is `gameCategory.${id}`
   *i18n `shortName` is `gameCategory.${id}_`
   */
  id: string;
  /** i18n ID */
  short: boolean;
}

const categories: Category[] = [
  {
    name: "Action",
    id: "action",
    short: true,
  },
  {
    name: "Platformer",
    id: "platformer",
    short: false,
  },
  {
    name: "Shooter",
    id: "shooter",
    short: true,
  },
  {
    name: "RPG",
    id: "rpg",
    short: false,
  },
  {
    name: "Sandbox",
    id: "sandbox",
    short: false,
  },
  {
    name: "Survival",
    id: "survival",
    short: true,
  },
  {
    name: "Sports",
    id: "sports",
    short: true,
  },
  {
    name: "Puzzle",
    id: "puzzle",
    short: false,
  },
];

export default categories;
