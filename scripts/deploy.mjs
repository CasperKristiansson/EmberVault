/* eslint-disable import/no-nodejs-modules, compat/compat, sonarjs/arrow-function-convention, n/no-top-level-await */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import path from "node:path";

const successExitCode = Number("0");
const defaultFailureExitCode = Number("1");
const rootDirectory = path.resolve(
  fileURLToPath(new URL("..", import.meta.url))
);
const infraDirectory = path.join(rootDirectory, "infra");
const stack = process.env.PULUMI_STACK || "dev";

const run = async (command, commandArguments, options = {}) => {
  const child = spawn(command, commandArguments, {
    stdio: "inherit",
    ...options,
  });
  const closePromise = once(child, "close");
  const errorPromise = once(child, "error");
  const [result] = await Promise.race([closePromise, errorPromise]);
  if (result instanceof Error) {
    throw result;
  }
  const code = result;
  if (code === null) {
    throw new Error(`${command} exited without a status code.`);
  }
  if (code !== successExitCode) {
    throw new Error(`${command} exited with status ${code}.`);
  }
};

const runWithOutput = async (command, commandArguments, options = {}) => {
  const child = spawn(command, commandArguments, {
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const closePromise = once(child, "close");
  const errorPromise = once(child, "error");
  const [result] = await Promise.race([closePromise, errorPromise]);
  if (result instanceof Error) {
    throw result;
  }
  const code = result;
  return { code, stdout, stderr };
};

const readStackOutput = async (name) => {
  const { code, stdout, stderr } = await runWithOutput(
    "pulumi",
    ["-C", infraDirectory, "stack", "output", name, "--stack", stack, "--json"],
    { cwd: rootDirectory }
  );

  if (code !== successExitCode) {
    const message = stderr.trim() || "Pulumi output failed.";
    throw new Error(message);
  }
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error(`Pulumi output for ${name} was empty.`);
  }
  return JSON.parse(trimmed);
};

const main = async () => {
  const bucket = await readStackOutput("bucket");
  const distributionId = await readStackOutput("distributionId");

  process.stdout.write(`Deploying stack: ${stack}\n`);
  process.stdout.write(`Bucket: ${bucket}\n`);
  process.stdout.write(`Distribution: ${distributionId}\n`);

  await run("pnpm", ["build"], { cwd: rootDirectory });
  await run(
    "aws",
    [
      "s3",
      "sync",
      path.join(rootDirectory, "build"),
      `s3://${bucket}`,
      "--delete",
    ],
    { cwd: rootDirectory }
  );
  await run(
    "aws",
    [
      "cloudfront",
      "create-invalidation",
      "--distribution-id",
      distributionId,
      "--paths",
      "/*",
    ],
    { cwd: rootDirectory }
  );
};

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = defaultFailureExitCode;
}
