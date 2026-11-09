/* Generated from schemas/subdivision.schema.json. Do not edit. */

import type { CountryCode } from "./country-code.js";

export type Language = string;

export interface AdministrativeSubdivision {
  /**
   * ISO 3166-2 code when available; otherwise a stable country-scoped code.
   */
  code: string;
  country_code: CountryCode;
  name: string;
  /**
   * Country-specific administrative level.
   */
  level: string;
  parent_code?: string;
  localized_names?: LocalizedName[];
  aliases?: string[];
}
export interface LocalizedName {
  language: Language;
  name: string;
}
