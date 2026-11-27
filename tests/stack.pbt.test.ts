import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App, CfnResource } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import fc from "fast-check";
import { LikeC4 } from "likec4";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import { SampleStack } from "../src/sample-stack.js";
import type { Stage } from "../src/naming.js";

interface Resource {
  Type: string;
  Properties: Record<string, unknown>;
  DeletionPolicy?: string;
  UpdateReplacePolicy?: string;
}

const projectArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/);
const stageArb = fc.constantFrom<Stage>("dev", "test", "prod");
let documented: { type: string; path: string }[];
let relations: { source: string; target: string }[];

beforeAll(async () => {
  const workspace = await LikeC4.fromWorkspace("architecture");
  try {
    const model = await workspace.computedModel();
    documented = [...model.elements()]
      .filter((element) => element.kind === "resource")
      .map((element) => {
        const type = element.getMetadata("awsType");
        const path = element.getMetadata("constructPath");
        if (typeof type !== "string" || typeof path !== "string")
          throw new Error(`Missing resource metadata: ${element.id}`);
        return { type, path };
      });
    relations = [...model.relationships()].map((relation) => ({
      source: relation.source.id,
      target: relation.target.id,
    }));
  } finally {
    await workspace.dispose();
  }
});

function synth(project: string, stage: Stage) {
  const outdir = mkdtempSync(join(tmpdir(), "cdk-likec4-test-"));
  try {
    const app = new App({ outdir, analyticsReporting: false });
    const stack = new SampleStack(app, "Test", { project, stage });
    const resources = Template.fromStack(stack).toJSON().Resources as Record<string, Resource>;
    const paths = stack.node
      .findAll()
      .filter((node): node is CfnResource => node instanceof CfnResource)
      .map((node) => ({ type: node.cfnResourceType, path: node.node.path.slice("Test/".length) }));
    const bucketId = stack.getLogicalId(stack.store.bucket.node.defaultChild as CfnResource);
    return { resources, paths, bucketId };
  } finally {
    rmSync(outdir, { recursive: true, force: true });
  }
}

function checkStack(project: string, stage: Stage) {
  const { resources, paths, bucketId } = synth(project, stage);
  const all = Object.values(resources);
  // INV-1: compare the real parsed .c4 metadata with ALL synthesized resources.
  expect(all.map((r) => r.Type).sort()).toEqual(documented.map((e) => e.type).sort());
  expect(paths.sort((a, b) => a.path.localeCompare(b.path))).toEqual(
    [...documented].sort((a, b) => a.path.localeCompare(b.path)),
  );
  // INV-2: every resource has both tags, for arbitrary valid project/stage values.
  for (const resource of all) {
    const tags = resource.Properties.Tags;
    // S3 uses Tag[], while SSM CloudFormation uses a string map.
    const normalized = Array.isArray(tags)
      ? Object.fromEntries(tags.map((tag: { Key: string; Value: string }) => [tag.Key, tag.Value]))
      : tags;
    expect(normalized).toEqual({ Project: project, Stage: stage });
  }
  // INV-3: no public access, encryption/versioning and retention are explicit.
  expect(resources[bucketId]).toMatchObject({
    Type: "AWS::S3::Bucket",
    DeletionPolicy: "Retain",
    UpdateReplacePolicy: "Retain",
    Properties: {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
        ],
      },
      VersioningConfiguration: { Status: "Enabled" },
    },
  });
  const catalog = all.find((r) => r.Type === "AWS::SSM::Parameter");
  // INV-4: the SSM name carries the validated prefix without truncation.
  expect(catalog?.Properties.Name).toBe(`/${project}-${stage}/bucket-name`);
  // INV-5: real Ref matches the documented direction and formal abstraction.
  expect(catalog?.Properties.Value).toEqual({ Ref: bucketId });
  expect(relations).toEqual([{ source: "sample.catalog", target: "sample.bucket" }]);
}

describe("synth / diagram contract", () => {
  it("INV-1 INV-2 INV-3 INV-4 INV-5: hold for every valid project and stage", () => {
    fc.assert(fc.property(projectArb, stageArb, checkStack));
  });
});
