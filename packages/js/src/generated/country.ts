/* Generated from schemas/country.schema.json. Do not edit. */

import type { CountryCode } from "./country-code.js";

/**
 * BCP 47 language tag.
 */
export type Language = string;

export interface Country {
  /**
   * ISO 3166-1 alpha-2 code.
   */
  code: CountryCode;
  name: string;
  alpha3_code?: string;
  numeric_code?: string;
  /**
   * Known nationally official languages. An empty array means no value has been contributed or verified; it does not assert that the country has no official language.
   */
  official_languages: Language[];
  /**
   * Known commonly spoken languages from the sources listed in the manifest. An empty array means no value has been contributed or verified.
   */
  commonly_spoken_languages?: Language[];
  centroid?: Coordinates;
  localized_names?: LocalizedName[];
  aliases?: string[];
}
/**
 * Approximate country-level representative point; not a precise address.
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}
export interface LocalizedName {
  language: Language;
  name: string;
}
