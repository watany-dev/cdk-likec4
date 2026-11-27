// Independent finite-state abstraction of the SSM -> S3 CloudFormation Ref.
let bucketReady = false;
let catalogReady = false;

export const createBucket = () => {
  if (bucketReady) return;
  bucketReady = true;
};

export const createCatalog = () => {
  if (!bucketReady || catalogReady) return;
  catalogReady = true;
};

export const deleteCatalog = () => {
  if (!catalogReady) return;
  catalogReady = false;
};

export const deleteBucket = () => {
  if (!bucketReady || catalogReady) return;
  bucketReady = false;
};

// INV-5: every reachable state keeps the reference target available.
export const ReferenceTargetExists = () => !catalogReady || bucketReady;
