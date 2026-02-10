import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const infraDir = path.join(rootDir, "infra");
const stack = process.env.PULUMI_STACK || "dev";

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
};

const readStackOutput = (name) => {
  const result = spawnSync(
    "pulumi",
    ["-C", infraDir, "stack", "output", name, "--stack", stack, "--json"],
    { encoding: "utf8" }
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr || "Pulumi output failed.\n");
    process.exit(result.status ?? 1);
  }

  return JSON.parse(result.stdout.trim());
};

const bucket = readStackOutput("bucket");
const distributionId = readStackOutput("distributionId");

process.stdout.write(`Deploying stack: ${stack}\n`);
process.stdout.write(`Bucket: ${bucket}\n`);
process.stdout.write(`Distribution: ${distributionId}\n`);

run("pnpm", ["build"], { cwd: rootDir });

const env = { ...process.env };
run("aws", ["s3", "sync", path.join(rootDir, "build"), `s3://${bucket}`, "--delete"], {
  cwd: rootDir,
  env,
});

run(
  "aws",
  ["cloudfront", "create-invalidation", "--distribution-id", distributionId, "--paths", "/*"],
  {
    cwd: rootDir,
    env,
  }
);
