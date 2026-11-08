/* Generated from schemas/country.schema.json. Do not edit. */

/**
 * BCP 47 language tag.
 */
export type LanguageTag = string;
export type SourceIds = string[];

export interface Country {
  /**
   * ISO 3166-1 alpha-2 code.
   */
  code: string;
  name: string;
  /**
   * ISO 3166-1 alpha-3 code, when available.
   */
  alpha3Code?: string;
  /**
   * ISO 3166-1 numeric code, when available.
   */
  numericCode?: string;
  official_languages: LanguageTag[];
  localizedNames?: LocalizedName[];
  aliases?: string[];
  sourceIds?: SourceIds;
}
export interface LocalizedName {
  languageTag: LanguageTag;
  name: string;
}
