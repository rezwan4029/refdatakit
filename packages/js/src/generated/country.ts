/* Generated from schemas/country.schema.json. Do not edit. */

/**
 * BCP 47 language tag.
 */
export type Language = string;

export interface Country {
  /**
   * ISO 3166-1 alpha-2 code.
   */
  code: string;
  name: string;
  alpha3_code?: string;
  numeric_code?: string;
  /**
   * @minItems 1
   */
  official_languages: [Language, ...Language[]];
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
