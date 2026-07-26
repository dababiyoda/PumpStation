import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runStageZeroExperiment,
  type ExperimentFixture,
} from "../src/experiment.js";

const serverDirectory = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = resolve(
  serverDirectory,
  "../fixtures/synthetic-opportunities.json",
);
const outputPath = resolve(
  serverDirectory,
  "../experiments/results/stage0-baseline.json",
);
const fixture = JSON.parse(
  readFileSync(fixturePath, "utf8"),
) as ExperimentFixture;
const result = runStageZeroExperiment(fixture);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(
  `Wrote deterministic Stage 0 fixture result ${result.result_hash} to ${outputPath}`,
);
