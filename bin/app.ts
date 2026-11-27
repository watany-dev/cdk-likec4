import { App } from "aws-cdk-lib";
import { SampleStack } from "../src/sample-stack.js";

const app = new App({ analyticsReporting: false });
// Environment-agnostic: no account/region, lookups, assets, credentials or deployment.
new SampleStack(app, "CdkLikec4Sample", { project: "cdk-likec4", stage: "dev" });
app.synth();
