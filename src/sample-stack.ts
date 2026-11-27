import { Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { ArtifactStore } from "./artifact-store.js";
import type { ArtifactStoreProps } from "./artifact-store.js";

export class SampleStack extends Stack {
  readonly store: ArtifactStore;

  constructor(scope: Construct, id: string, props: StackProps & ArtifactStoreProps) {
    super(scope, id, props);
    this.store = new ArtifactStore(this, "Artifacts", props);
  }
}
