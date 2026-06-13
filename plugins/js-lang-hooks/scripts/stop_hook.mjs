import { spawnSync } from "node:child_process";
import {
  envEnabled,
  envFlag,
  quitHook,
  runHook,
} from "./common/hook.mjs";
import { commandFailureDetails } from "./common/command_failure.mjs";
import {
  currentNodeProjectRoot,
  hasTypeScriptConfig,
  packageJsonError,
  resolveCommand,
  resolvePackageScript,
} from "./common/node_runtime.mjs";
import { getJsTurnState } from "./common/turn_state.mjs";

function shouldRunStopChecks() {
  return !envFlag("JS_HOOKS_FAST");
}

function commandForCandidates(candidates, projectRoot) {
  for (const [name, args, displayName] of candidates) {
    const resolved = resolveCommand(name, projectRoot);
    if (resolved) {
      return { ...resolved, name: displayName || `${name} ${args.join(" ")}`.trim(), args };
    }
  }

  return null;
}

function typecheckCommand(projectRoot) {
  const packageScript = resolvePackageScript("typecheck", projectRoot);
  if (packageScript) {
    return packageScript;
  }

  if (!hasTypeScriptConfig(projectRoot)) {
    return null;
  }

  const tsc = resolveCommand("tsc", projectRoot);
  if (!tsc) {
    return null;
  }

  return {
    ...tsc,
    name: "tsc --noEmit",
    args: ["--noEmit"],
  };
}

function lintCommand(projectRoot) {
  const packageScript = resolvePackageScript("lint", projectRoot);
  if (packageScript) {
    return packageScript;
  }

  return commandForCandidates(
    [
      ["eslint", ["."], "eslint ."],
      ["biome", ["check", "."], "biome check ."],
    ],
    projectRoot,
  );
}

function testCommand(projectRoot) {
  const packageScript = resolvePackageScript("test", projectRoot);
  if (packageScript) {
    return packageScript;
  }

  return commandForCandidates(
    [
      ["vitest", ["run"], "vitest run"],
      ["jest", ["--runInBand"], "jest --runInBand"],
      ["node", ["--test"], "node --test"],
    ],
    projectRoot,
  );
}

function enabledCommands(projectRoot) {
  const commands = [];

  if (envEnabled("JS_HOOKS_TYPECHECK")) {
    const typecheck = typecheckCommand(projectRoot);
    if (typecheck) {
      commands.push(typecheck);
    }
  }

  if (envEnabled("JS_HOOKS_LINT")) {
    const lint = lintCommand(projectRoot);
    if (lint) {
      commands.push(lint);
    }
  }

  if (envEnabled("JS_HOOKS_TEST")) {
    const test = testCommand(projectRoot);
    if (test) {
      commands.push(test);
    }
  }

  return commands;
}

function runJsCommand(command, projectRoot) {
  const result = spawnSync(command.command, command.args, {
    cwd: projectRoot,
    encoding: "utf8",
    env: command.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error?.code === "ENOENT") {
    return null;
  }

  if (result.error || result.status !== 0) {
    return {
      commandName: command.name,
      projectRoot,
      details: commandFailureDetails(result),
    };
  }

  return null;
}

function commandFailedMessage(failure, { retry }) {
  const status = retry ? "still failed" : "failed";
  return `${failure.commandName} in ${failure.projectRoot} ${status}: ${failure.details}`;
}

function packageJsonFailure(projectRoot) {
  const error = packageJsonError(projectRoot);
  if (!error) {
    return null;
  }

  return {
    commandName: "package.json",
    projectRoot,
    details: error,
  };
}

function projectRootsToCheck(input) {
  const state = getJsTurnState(input?.turn_id);
  if (state === null) {
    const projectRoot = currentNodeProjectRoot(input);
    return projectRoot ? [projectRoot] : [];
  }

  if (!state.jsChanged || state.projectRoots.length === 0) {
    return [];
  }

  return state.projectRoots;
}

function main(input) {
  if (!shouldRunStopChecks()) {
    quitHook({ continue: true });
  }

  const projectRoots = projectRootsToCheck(input);
  if (projectRoots.length === 0) {
    quitHook({ continue: true });
  }

  const retryMode = input.stop_hook_active === true;
  const failures = [];

  for (const projectRoot of projectRoots) {
    const manifestFailure = packageJsonFailure(projectRoot);
    if (manifestFailure) {
      if (!retryMode) {
        quitHook({
          decision: "block",
          reason: commandFailedMessage(manifestFailure, { retry: false }),
        });
      }

      failures.push(manifestFailure);
      continue;
    }

    for (const command of enabledCommands(projectRoot)) {
      const failure = runJsCommand(command, projectRoot);
      if (!failure) {
        continue;
      }

      if (!retryMode) {
        quitHook({
          decision: "block",
          reason: commandFailedMessage(failure, { retry: false }),
        });
      }

      failures.push(failure);
    }
  }

  if (failures.length > 0) {
    quitHook({
      continue: true,
      systemMessage: failures
        .map((failure) => commandFailedMessage(failure, { retry: true }))
        .join("\n\n"),
    });
  }

  quitHook({ continue: true });
}

runHook(main);
