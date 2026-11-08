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
  official_languages: Language[];
  localized_names?: LocalizedName[];
  aliases?: string[];
}
export interface LocalizedName {
  language: Language;
  name: string;
}
