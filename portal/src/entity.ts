import Ajv2020, { type AnySchema, type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import entitySchema from "../../schemas/entity.schema.json";
import type { UniversalDirectoryEntity as Entity } from "../../packages/js/src/generated/entity.js";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile<Entity>(entitySchema as AnySchema);

export type { Entity };

export function validateEntity(value: unknown): { ok: true; entity: Entity } | {
  ok: false;
  errors: string[];
} {
  if (validate(value)) {
    return { ok: true, entity: value as Entity };
  }

  const errors = (validate.errors ?? []).map((error: ErrorObject) => {
    const path = error.instancePath || "entity";
    return `${path}: ${error.message ?? "is invalid"}`;
  });
  return { ok: false, errors };
}
