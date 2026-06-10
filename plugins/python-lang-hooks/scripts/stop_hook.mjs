import { spawnSync } from "node:child_process";
import {
  commandFailureDetails,
  currentPythonProjectRoot,
  envEnabled,
  envFlag,
  quitHook,
  resolveAnyCommand,
  resolveCommand,
  runHook,
} from "./common/hook.mjs";
import { getPythonTurnState } from "./common/turn_state.mjs";

const TYPE_CHECKERS = [
  ["ty", ["check", "."]],
  ["pyre", ["check"]],
  ["pyright", []],
  ["mypy", ["."]],
];
const LINTERS = [
  ["ruff", ["check", "."]],
  ["pylint", ["."]],
];

function shouldRunStopChecks() {
  return !envFlag("PYTHON_HOOKS_FAST");
}

function commandForCandidates(candidates, projectRoot) {
  for (const [name, args] of candidates) {
    const resolved = resolveCommand(name, projectRoot);
    if (resolved) {
      return { ...resolved, name, args };
    }
  }

  return null;
}

function testCommand(projectRoot) {
  const pytest = resolveCommand("pytest", projectRoot);
  if (pytest) {
    return { ...pytest, name: "pytest", args: [] };
  }

  const python = resolveAnyCommand(["python", "python3"], projectRoot);
  if (python) {
    return {
      ...python,
      name: "python -m unittest discover",
      args: ["-m", "unittest", "discover"],
    };
  }

  return null;
}

function enabledCommands(projectRoot) {
  const commands = [];

  if (envEnabled("PYTHON_HOOKS_TYPECHECK")) {
    const typeChecker = commandForCandidates(TYPE_CHECKERS, projectRoot);
    if (typeChecker) {
      commands.push(typeChecker);
    }
  }

  if (envEnabled("PYTHON_HOOKS_LINT")) {
    const linter = commandForCandidates(LINTERS, projectRoot);
    if (linter) {
      commands.push(linter);
    }
  }

  if (envEnabled("PYTHON_HOOKS_TEST")) {
    const tester = testCommand(projectRoot);
    if (tester) {
      commands.push(tester);
    }
  }

  return commands;
}

function runPythonCommand(command, projectRoot, blockOnFailed) {
  const result = spawnSync(command.command, command.args, {
    cwd: projectRoot,
    encoding: "utf8",
    env: command.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error?.code === "ENOENT") {
    return;
  }

  if (result.error || result.status !== 0) {
    const details = commandFailureDetails(result);
    if (blockOnFailed) {
      quitHook({
        decision: "block",
        reason: `${command.name} in ${projectRoot} failed: ${details}`,
      });
    } else {
      quitHook({
        continue: true,
        systemMessage: `${command.name} in ${projectRoot} still failed: ${details}`,
      });
    }
  }
}

function projectRootsToCheck(input) {
  const state = getPythonTurnState(input?.turn_id);
  if (state === null) {
    return [currentPythonProjectRoot(input)];
  }

  if (!state.pythonChanged || state.projectRoots.length === 0) {
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

  const blockOnFailed = input.stop_hook_active ? false : true;
  for (const projectRoot of projectRoots) {
    for (const command of enabledCommands(projectRoot)) {
      runPythonCommand(command, projectRoot, blockOnFailed);
    }
  }

  quitHook({ continue: true });
}

runHook(main);
