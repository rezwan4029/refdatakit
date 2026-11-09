/* Generated from schemas/city.schema.json. Do not edit. */

import type { CountryCode } from "./country-code.js";

export type Language = string;

export interface CityOrLocality {
  /**
   * Stable identifier that must not be derived from a mutable display name.
   */
  id: string;
  name: string;
  country_code: CountryCode;
  subdivision_code?: string;
  coordinates?: Coordinates;
  population?: number;
  localized_names?: LocalizedName[];
  aliases?: string[];
}
export interface Coordinates {
  latitude: number;
  longitude: number;
}
export interface LocalizedName {
  language: Language;
  name: string;
}
