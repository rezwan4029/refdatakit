/* Generated from schemas/entity.schema.json. Do not edit. */

/**
 * BCP 47 language tag.
 */
export type LanguageTag = string;
export type SourceIds = string[];

export interface UniversalDirectoryEntity {
  /**
   * Stable identifier that must not be derived from a mutable display name.
   */
  id: string;
  name: string;
  entityType:
    "school" | "college" | "university" | "corporation" | "civic_organization" | "religious_building" | "other";
  countryCode: string;
  subdivisionCode?: string;
  cityId?: string;
  localizedNames?: LocalizedName[];
  aliases?: string[];
  /**
   * Languages used for instruction, services, or public-facing operations.
   */
  languages?: LanguageTag[];
  website?: string;
  domains?: string[];
  coordinates?: Coordinates;
  externalIds?: ExternalId[];
  sourceIds?: SourceIds;
}
export interface LocalizedName {
  languageTag: LanguageTag;
  name: string;
}
export interface Coordinates {
  latitude: number;
  longitude: number;
}
export interface ExternalId {
  system: string;
  value: string;
  url?: string;
}
