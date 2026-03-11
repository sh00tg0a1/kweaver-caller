import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeHtmlEntities,
  normalizeDisplayText,
  stripHtmlComments,
} from "../src/ui/display-text.js";

test("decodeHtmlEntities decodes basic quote entities", () => {
  assert.equal(
    decodeHtmlEntities('多个&quot;恬露&quot;系列品牌'),
    '多个"恬露"系列品牌'
  );
});

test("decodeHtmlEntities decodes nested amp-escaped entities", () => {
  assert.equal(
    decodeHtmlEntities('多个&amp;quot;恬露&amp;quot;系列品牌'),
    '多个"恬露"系列品牌'
  );
});

test("normalizeDisplayText strips html comments and decodes entities", () => {
  assert.equal(
    normalizeDisplayText('品牌<!-- hidden -->家族：&amp;quot;恬露&amp;quot;'),
    '品牌家族："恬露"'
  );
});

test("stripHtmlComments removes comment blocks", () => {
  assert.equal(stripHtmlComments("a<!-- x -->b"), "ab");
});

test("stripHtmlComments drops content that starts with html comment", () => {
  assert.equal(stripHtmlComments("<!-- hidden -->should not render"), "");
  assert.equal(stripHtmlComments("   <!-- hidden only"), "");
});
