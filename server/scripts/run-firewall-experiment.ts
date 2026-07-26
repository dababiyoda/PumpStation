import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runFirewallExperiment,
  type FirewallExperimentFixture,
} from "../src/firewallExperiment.js";

const serverDirectory = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = resolve(
  serverDirectory,
  "../fixtures/semantic-firewall-corpus.json",
);
const outputPath = resolve(
  serverDirectory,
  "../experiments/results/semantic-firewall-v1.json",
);
const fixture = JSON.parse(
  readFileSync(fixturePath, "utf8"),
) as FirewallExperimentFixture;
const result = runFirewallExperiment(fixture);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(
  `Wrote semantic firewall fixture result ${result.result_hash} to ${outputPath}`,
);
