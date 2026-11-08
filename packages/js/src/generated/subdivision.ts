/* Generated from schemas/subdivision.schema.json. Do not edit. */

export type LanguageTag = string;
export type SourceIds = string[];

export interface AdministrativeSubdivision {
  /**
   * ISO 3166-2 code when available; otherwise a stable country-scoped code.
   */
  code: string;
  countryCode: string;
  name: string;
  /**
   * Country-specific administrative level, such as state, province, canton, or district.
   */
  level: string;
  parentCode?: string;
  localizedNames?: LocalizedName[];
  aliases?: string[];
  sourceIds?: SourceIds;
}
export interface LocalizedName {
  languageTag: LanguageTag;
  name: string;
}
