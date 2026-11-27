export type Stage = "dev" | "test" | "prod";

/** Keep names explicit and portable; do not silently truncate or normalize. */
export function resourcePrefix(project: string, stage: Stage): string {
  if (!/^[a-z][a-z0-9-]{0,19}$/.test(project)) {
    throw new Error(
      "project must be 1–20 lowercase letters, digits or hyphens, starting with a letter",
    );
  }
  return `${project}-${stage}`;
}
