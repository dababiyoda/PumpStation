'use strict';

/**
 * CI entry point for the admission gate.
 *
 *     node governance/check.js [path-to-matrix.json]
 *
 * Exit 0 when no feature claiming ADMITTED or DEPLOYED fails a rule. A PROPOSED
 * feature that fails is reported but does not fail the build: the gate is
 * telling its author what must exist before it may ship, which is the entire
 * point of registering features before building them.
 *
 * Exit 1 means something that claims to be running does not satisfy the
 * founder's termination trigger. That is an incident, not a style violation.
 */

const fs = require('node:fs');
const path = require('node:path');

const { admitMatrix } = require('./admission');

const DEFAULT_MATRIX = path.join(__dirname, 'feature-control-matrix.json');

function format(report) {
  const lines = [];
  lines.push(`PumpStation admission gate — ${report.organ} matrix ${report.matrix_version}`);
  lines.push(`${report.evaluated} feature(s): ${report.admitted} admitted, ${report.rejected} rejected`);
  lines.push('');

  for (const result of report.results) {
    const mark = result.admitted ? 'ADMIT ' : 'REJECT';
    lines.push(`${mark}  ${result.feature_id}  [${result.status}]`);
    for (const rejection of result.rejections) {
      lines.push(`         ✗ ${rejection.rule}: ${rejection.reason}`);
    }
    for (const warning of result.warnings) {
      lines.push(`         ! ${warning}`);
    }
  }

  lines.push('');
  if (report.clean) {
    lines.push('PASS — nothing claiming ADMITTED or DEPLOYED fails a rule.');
  } else {
    lines.push(`FAIL — ${report.blocking.length} feature(s) claim to be live while failing the gate:`);
    for (const blocked of report.blocking) {
      lines.push(`  ${blocked.feature_id} [${blocked.status}]`);
    }
  }
  return lines.join('\n');
}

function main(argv) {
  const matrixPath = argv[0] || DEFAULT_MATRIX;
  let matrix;
  try {
    matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  } catch (err) {
    console.error(`cannot read matrix at ${matrixPath}: ${err.message}`);
    return 2;
  }

  const report = admitMatrix(matrix);
  console.log(format(report));
  return report.clean ? 0 : 1;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { main, format };
