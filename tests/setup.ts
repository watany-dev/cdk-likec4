import fc from "fast-check";

const numRuns = Number(process.env.FC_RUNS ?? 100);
if (!Number.isSafeInteger(numRuns) || numRuns < 1)
  throw new Error("FC_RUNS must be a positive integer");
const seed = process.env.FC_SEED === undefined ? undefined : Number(process.env.FC_SEED);
if (seed !== undefined && !Number.isSafeInteger(seed))
  throw new Error("FC_SEED must be an integer");
fc.configureGlobal({ numRuns, ...(seed === undefined ? {} : { seed }) });
