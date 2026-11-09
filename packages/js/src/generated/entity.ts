/* Generated from schemas/entity.schema.json. Do not edit. */

import type { CountryCode } from "./country-code.js";

/**
 * Generated from datasets/manifest.json vocabularies.entity_tags.
 */
export type Tag =
  | "hospital"
  | "k12_school"
  | "medical_college"
  | "nursing_home"
  | "polytechnic"
  | "technical_training_institute"
  | "university";
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
     * Partial names keyed by ISO 639-1 code for verified official non-English languages; unavailable translations may be omitted.
     */
    languages: {
      [k: string]: string;
    };
  };
  entity_type:
    "school" | "college" | "university" | "corporation" | "civic_organization" | "religious_building" | "other";
  country_code: CountryCode;
  /**
   * Optional public or private ownership classification when supported by the source.
   */
  ownership?: "public" | "private";
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
