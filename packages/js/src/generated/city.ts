/* Generated from schemas/city.schema.json. Do not edit. */

export type LanguageTag = string;
export type SourceIds = string[];

export interface CityOrLocality {
  /**
   * Stable identifier that must not be derived from a mutable display name.
   */
  id: string;
  name: string;
  countryCode: string;
  subdivisionCode?: string;
  coordinates?: Coordinates;
  population?: number;
  localizedNames?: LocalizedName[];
  aliases?: string[];
  sourceIds?: SourceIds;
}
export interface Coordinates {
  latitude: number;
  longitude: number;
}
export interface LocalizedName {
  languageTag: LanguageTag;
  name: string;
}
