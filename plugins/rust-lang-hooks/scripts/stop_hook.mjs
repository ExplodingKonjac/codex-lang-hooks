import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  envEnabled,
  envFlag,
  findUp,
  quitHook,
  runHook,
} from "./common/hook.mjs";
import { getRustTurnState } from "./common/turn_state.mjs";

function shouldRunStopChecks() {
  return !envFlag("RUST_HOOKS_FAST");
}

function enabledCargoCommands() {
  return [
    ["check", envEnabled("RUST_HOOKS_CARGO_CHECK")],
    ["clippy", envEnabled("RUST_HOOKS_CARGO_CLIPPY")],
    ["test", envEnabled("RUST_HOOKS_CARGO_TEST")],
  ].filter(([_, enabled]) => enabled);
}

function commandDetails(result) {
  return (
    result.error?.message ||
    (result.stderr || result.stdout).trim() ||
    `exit ${result.status}`
  );
}

function handleCargoFailure(command, projectDir, result, blockOnFailed) {
  const details = commandDetails(result);
  if (blockOnFailed) {
    quitHook({
      decision: "block",
      reason: `cargo ${command} in ${projectDir} failed: ${details}`,
    });
  }

  quitHook({
    continue: true,
    systemMessage: `cargo ${command} in ${projectDir} still failed: ${details}`,
  });
}

function runCargoCommand(command, projectDir, blockOnFailed) {
  const result = spawnSync("cargo", [command], {
    cwd: projectDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error?.code === "ENOENT") {
    return;
  }

  if (result.error || result.status !== 0) {
    handleCargoFailure(command, projectDir, result, blockOnFailed);
  }
}

function currentCargoProjectDir(input) {
  const cwd = typeof input?.cwd === "string" ? input.cwd : process.cwd();
  const cargoToml = findUp(cwd, "Cargo.toml");
  return cargoToml ? path.dirname(cargoToml) : null;
}

function cargoProjectsToCheck(input) {
  const state = getRustTurnState(input?.turn_id);
  if (state === null) {
    const projectDir = currentCargoProjectDir(input);
    return projectDir ? [projectDir] : [];
  }

  if (!state.rustChanged || state.cargoProjectDirs.length === 0) {
    return [];
  }

  return state.cargoProjectDirs;
}

function main(input) {
  if (!shouldRunStopChecks()) {
    quitHook({ continue: true });
  }

  const commands = enabledCargoCommands().map(([command]) => command);
  if (commands.length === 0) {
    quitHook({ continue: true });
  }

  const projectDirs = cargoProjectsToCheck(input);
  if (projectDirs.length === 0) {
    quitHook({ continue: true });
  }

  const blockOnFailed = input.stop_hook_active ? false : true;
  for (const projectDir of projectDirs) {
    for (const command of commands) {
      runCargoCommand(command, projectDir, blockOnFailed);
    }
  }

  quitHook({ continue: true });
}

runHook(main);
