import assert from "node:assert/strict";
import test from "node:test";
import {
  makeFixture,
  path,
  POST_EDIT_HOOK,
  readJsChanged,
  readLines,
  readProjectRoots,
  runHook,
  writeToolLogger,
} from "./helpers.mjs";

test("post-edit TypeScript file marks the turn and records the project root", () => {
  const fixture = makeFixture();
  const result = runHook(
    POST_EDIT_HOOK,
    {
      cwd: fixture.projectDir,
      turn_id: "turn-ts",
      tool_name: "Edit",
      tool_input: { file_path: "src/index.ts" },
    },
    {
      env: {
        PLUGIN_DATA: fixture.pluginData,
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readJsChanged(fixture.pluginData, "turn-ts"), 1);
  assert.deepEqual(readProjectRoots(fixture.pluginData, "turn-ts"), [
    fixture.projectDir,
  ]);
});

test("post-edit config-only edits mark the project root without running a formatter", () => {
  const fixture = makeFixture();
  const logPath = path.join(fixture.dir, "config.log");
  writeToolLogger(fixture.binDir, "prettier", logPath);

  const result = runHook(
    POST_EDIT_HOOK,
    {
      cwd: fixture.projectDir,
      turn_id: "turn-config",
      tool_name: "Edit",
      tool_input: { file_path: "package.json" },
    },
    {
      env: {
        PLUGIN_DATA: fixture.pluginData,
        PATH: fixture.binDir,
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readJsChanged(fixture.pluginData, "turn-config"), 1);
  assert.deepEqual(readProjectRoots(fixture.pluginData, "turn-config"), [
    fixture.projectDir,
  ]);
  assert.deepEqual(readLines(logPath), []);
});

test("post-edit unrelated files do not mark the turn", () => {
  const fixture = makeFixture();
  const result = runHook(
    POST_EDIT_HOOK,
    {
      cwd: fixture.projectDir,
      turn_id: "turn-docs",
      tool_name: "Edit",
      tool_input: { file_path: "README.md" },
    },
    { env: { PLUGIN_DATA: fixture.pluginData } },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readJsChanged(fixture.pluginData, "turn-docs"), null);
});

test("post-edit deleted and moved JS files mark the turn without formatting missing files", () => {
  const fixture = makeFixture();
  const logPath = path.join(fixture.dir, "delete.log");
  writeToolLogger(fixture.binDir, "prettier", logPath);

  const result = runHook(
    POST_EDIT_HOOK,
    {
      cwd: fixture.projectDir,
      turn_id: "turn-delete",
      tool_name: "apply_patch",
      tool_input: {
        command: [
          "*** Begin Patch",
          "*** Delete File: src/removed.ts",
          "*** Update File: src/from.js",
          "*** Move to: src/to.js",
          "*** End Patch",
        ].join("\n"),
      },
    },
    {
      env: {
        PLUGIN_DATA: fixture.pluginData,
        PATH: fixture.binDir,
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readJsChanged(fixture.pluginData, "turn-delete"), 1);
  assert.deepEqual(readProjectRoots(fixture.pluginData, "turn-delete"), [
    fixture.projectDir,
  ]);
  assert.deepEqual(readLines(logPath), []);
});
