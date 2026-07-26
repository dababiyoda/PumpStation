import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
  fileURLToPath(new URL("../../", import.meta.url)),
);
const scanRoots = [
  resolve(repositoryRoot, "server/src"),
  resolve(repositoryRoot, "client"),
];
const exactDangerousTokens = [
  "eth_sendTransaction",
  "wallet_sendCalls",
  ".sendTransaction(",
  ".signTransaction(",
  "privateKey",
  "process.env.PRIVATE_KEY",
  "from 'ccxt'",
  'from "ccxt"',
  "from '@binance",
  'from "@binance',
  "from 'coinbase",
  'from "coinbase',
];
const allowedExtensions = new Set([".ts", ".js", ".html", ".css"]);
const findings: string[] = [];

function walk(path: string): string[] {
  return readdirSync(path).flatMap((entry) => {
    const child = join(path, entry);
    return statSync(child).isDirectory() ? walk(child) : [child];
  });
}

for (const path of scanRoots.flatMap(walk)) {
  if (!allowedExtensions.has(extname(path))) continue;
  const content = readFileSync(path, "utf8");
  for (const token of exactDangerousTokens) {
    if (content.includes(token)) {
      findings.push(`${path.slice(repositoryRoot.length + 1)}: ${token}`);
    }
  }
}

const packageJson = JSON.parse(
  readFileSync(resolve(repositoryRoot, "server/package.json"), "utf8"),
) as {
  dependencies?: Record<string, string>;
};
const bannedDependencies = [
  "ccxt",
  "@coinbase/coinbase-sdk",
  "@binance/connector",
  "@uniswap/sdk-core",
];
for (const dependency of bannedDependencies) {
  if (packageJson.dependencies?.[dependency]) {
    findings.push(`server/package.json: banned dependency ${dependency}`);
  }
}

if (findings.length > 0) {
  console.error("Prohibited execution surface detected:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(
    "No private-key, transaction, exchange, swap, order, or transfer execution surface detected.",
  );
}
