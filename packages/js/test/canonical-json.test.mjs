import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalJson } from "../dist/canonical-json.js";

test("sorts object keys and normalizes strings to NFC", () => {
  assert.equal(
    canonicalJson({ z: "e\u0301", a: { y: 1, x: 2 } }),
    '{"a":{"x":2,"y":1},"z":"é"}\n',
  );
});

test("rejects keys that collide after NFC normalization", () => {
  assert.throws(
    () => canonicalJson({ "e\u0301": 1, "é": 2 }),
    /duplicate keys after NFC normalization/,
  );
});
