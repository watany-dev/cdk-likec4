import { RemovalPolicy, Tags } from "aws-cdk-lib";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { resourcePrefix } from "./naming.js";
import type { Stage } from "./naming.js";

export interface ArtifactStoreProps {
  readonly project: string;
  readonly stage: Stage;
}

/** A private versioned bucket, discoverable through one SSM parameter. */
export class ArtifactStore extends Construct {
  readonly bucket: Bucket;
  readonly catalog: StringParameter;

  constructor(scope: Construct, id: string, props: ArtifactStoreProps) {
    super(scope, id);
    const prefix = resourcePrefix(props.project, props.stage);
    Tags.of(this).add("Project", props.project);
    Tags.of(this).add("Stage", props.stage);
    this.bucket = new Bucket(this, "Bucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.catalog = new StringParameter(this, "Catalog", {
      parameterName: `/${prefix}/bucket-name`,
      stringValue: this.bucket.bucketName,
    });
  }
}
