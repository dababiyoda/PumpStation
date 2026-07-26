import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runTieredExperiment,
  type TieredExperimentFixture,
} from "../src/experimentV2.js";

const serverDirectory = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = resolve(
  serverDirectory,
  "../fixtures/tiered-opportunities-v2.json",
);
const outputPath = resolve(
  serverDirectory,
  "../experiments/results/tiered-benchmark-v2.json",
);
const fixture = JSON.parse(
  readFileSync(fixturePath, "utf8"),
) as TieredExperimentFixture;
const result = runTieredExperiment(fixture);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(
  `Wrote deterministic tiered fixture result ${result.result_hash} to ${outputPath}`,
);
