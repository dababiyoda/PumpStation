# Rollback and Black-Start Instructions

## Before merge

Close the draft PR or reset the feature branch to `main`. No default-branch or external system state changes.

## After merge, before any pilot

1. Stop the Node process.
2. Preserve `server/data/institutional-events.jsonl` as an evidence artifact with its SHA-256 hash.
3. Revert the migration commit through a new Git commit.
4. Do not restore the original coordinated-market README as an active product definition.
5. Record why rollback occurred and the evidence needed to revive the design.

## Event-store recovery

If startup returns `EVENT_CHAIN_INVALID`:

1. stop immediately;
2. copy the file without editing it;
3. compute and record its SHA-256 hash;
4. identify the last independently retained valid copy;
5. replay in a bounded recovery environment;
6. add a new correction or incident record after recovery;
7. never repair the file by silently deleting or changing a prior line.

## Kill criteria

- any real-money or transaction path appears;
- unauthorized external effects become nonzero;
- fixed or replayable wallet signatures return;
- an agent can approve a decision or stage;
- a founder decision activates a stage without Kernel permission;
- dissent or history can be deleted;
- fixture output is represented as performance;
- classifier errors continue rather than refuse;
- legal or security review rejects the next stage;
- the system increases founder burden without measured evidence improvement.
