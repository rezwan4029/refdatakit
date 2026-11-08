/* Generated from schemas/entity.schema.json. Do not edit. */

/**
 * Generated from datasets/manifest.json vocabularies.entity_tags.
 */
export type Tag = "hospital" | "k12_school" | "medical_college" | "nursing_home" | "university";
/**
 * BCP 47 language tag.
 */
export type Language = string;

export interface UniversalDirectoryEntity {
  /**
   * Stable identifier that must not be derived from a mutable display name.
   */
  id: string;
  names: {
    en: string;
    /**
     * Names keyed by ISO 639-1 code for the entity's official non-English languages.
     */
    languages: {
      [k: string]: string;
    };
  };
  entity_type:
    "school" | "college" | "university" | "corporation" | "civic_organization" | "religious_building" | "other";
  country_code: string;
  city_id: string;
  /**
   * Controlled classifications for an institution; multiple tags may apply.
   *
   * @minItems 1
   */
  tags: [Tag, ...Tag[]];
  localized_aliases?: LocalizedAlias[];
  /**
   * Languages used for instruction, services, or public-facing operations.
   */
  languages?: Language[];
  website?: string;
  domains?: string[];
  external_ids?: ExternalId[];
}
export interface LocalizedAlias {
  language: Language;
  value: string;
}
export interface ExternalId {
  system: string;
  value: string;
  url?: string;
}
