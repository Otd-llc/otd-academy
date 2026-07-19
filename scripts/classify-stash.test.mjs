// Self-test for the out-of-tree store helpers.
// Run: `node --test scripts/classify-stash.test.mjs` (no deps).
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveStore, isInside } from "./classify-stash.mjs";

const repo = path.resolve("/work/project-foundry");

test("default store is a sibling of the repo, not inside it", () => {
  const store = resolveStore({}, repo);
  assert.equal(store, path.resolve("/work/otd-classified"));
  assert.equal(isInside(store, repo), false);
});

test("OTD_CLASSIFIED_STORE overrides the default", () => {
  const store = resolveStore({ OTD_CLASSIFIED_STORE: "/secure/otd" }, repo);
  assert.equal(store, path.resolve("/secure/otd"));
});

test("isInside catches a store misconfigured inside the repo (the guarded case)", () => {
  assert.equal(isInside(path.join(repo, "docs", "secret"), repo), true);
  assert.equal(isInside(repo, repo), true); // the repo itself counts as inside
  assert.equal(isInside(path.resolve("/work/otd-classified"), repo), false);
  assert.equal(isInside(path.resolve("/work/project-foundry-notes"), repo), false); // sibling prefix, not nested
});
