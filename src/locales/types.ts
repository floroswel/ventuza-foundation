import type { Dict } from "./ro";

/** Recursive partial — traducerile incomplete cad pe engleză, cheie cu cheie. */
export type PartialDict = {
  [K in keyof Dict]?: Dict[K] extends string
    ? string
    : { [P in keyof Dict[K]]?: Dict[K][P] extends string ? string : Partial<Dict[K][P]> };
};
