/* eslint-disable import/no-nodejs-modules, compat/compat, unicorn/no-array-reduce, no-magic-numbers, no-console, n/no-process-exit, unicorn/no-process-exit, no-await-in-loop, n/no-top-level-await, prettier/prettier */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const kilobytes = 1024;
const maxPrimaryKb = Number.parseFloat(
  process.env.BUNDLE_PRIMARY_MAX_KB ?? "350"
);
const maxTotalKb = Number.parseFloat(process.env.BUNDLE_TOTAL_MAX_KB ?? "1500");

const immutableRoots = [
  path.join(process.cwd(), "build", "_app", "immutable"),
  path.join(process.cwd(), ".svelte-kit", "output", "client", "_app", "immutable"),
];

const toKb = bytes => bytes / kilobytes;

const walkFiles = async directory => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkFiles(fullPath);
      files.push(...nested);
    } else {
      files.push(fullPath);
    }
  }
  return files;
};

const resolveImmutableRoot = async () => {
  for (const root of immutableRoots) {
    try {
      const stats = await stat(root);
      if (stats.isDirectory()) {
        return root;
      }
    } catch {
      // Continue searching.
    }
  }
  return null;
};

const getPrimaryChunk = bundles => {
  const entryCandidates = bundles.filter(bundle => {
    const normalized = bundle.path.replaceAll("\\", "/");
    return normalized.includes("/entry/") || normalized.includes("/nodes/");
  });
  if (entryCandidates.length > 0) {
    return entryCandidates.reduce((largest, current) =>
      current.bytes > largest.bytes ? current : largest
    );
  }
  return bundles.reduce((largest, current) =>
    current.bytes > largest.bytes ? current : largest
  );
};

const main = async () => {
  const immutableRoot = await resolveImmutableRoot();
  if (!immutableRoot) {
    console.error(
      "Bundle budget check could not find build output. Run `pnpm build` first."
    );
    process.exit(1);
  }

  const allFiles = await walkFiles(immutableRoot);
  const jsFiles = allFiles.filter(filePath => filePath.endsWith(".js"));

  if (jsFiles.length === 0) {
    console.error(`No JavaScript bundles found in ${immutableRoot}.`);
    process.exit(1);
  }

  const bundleEntries = await Promise.all(
    jsFiles.map(async filePath => {
      const fileStat = await stat(filePath);
      return {
        path: path.relative(process.cwd(), filePath),
        bytes: fileStat.size,
      };
    })
  );

  const primary = getPrimaryChunk(bundleEntries);
  const totalBytes = bundleEntries.reduce((sum, entry) => sum + entry.bytes, 0);

  const primaryKb = toKb(primary.bytes);
  const totalKb = toKb(totalBytes);

  console.log(`Bundle root: ${path.relative(process.cwd(), immutableRoot)}`);
  console.log(`Primary chunk: ${primary.path} (${primaryKb.toFixed(1)} KB)`);
  console.log(
    `Total JS payload: ${totalKb.toFixed(1)} KB across ${bundleEntries.length} files`
  );
  console.log(
    `Budgets: primary <= ${maxPrimaryKb.toFixed(1)} KB, total <= ${maxTotalKb.toFixed(1)} KB`
  );

  const failures = [];
  if (primaryKb > maxPrimaryKb) {
    failures.push(
      `Primary chunk exceeds budget by ${(primaryKb - maxPrimaryKb).toFixed(1)} KB.`
    );
  }
  if (totalKb > maxTotalKb) {
    failures.push(
      `Total JS payload exceeds budget by ${(totalKb - maxTotalKb).toFixed(1)} KB.`
    );
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("Bundle size check passed.");
};

await main();
