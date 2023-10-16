import { execSync } from 'child_process';
import * as path from 'path';
import * as retry from 'async-retry';

const REGIONS = [
  'eu-west-1', // Europe (Ireland),
  // 'us-east-1', // US East (N. Virginia),
  // 'us-west-2', // US West (Oregon),
  //  // new regions since 2023-09
  // 'eu-central-1', // Europe (Frankfurt),
  // 'eu-west-2', // Europe (London),
  // 'us-east-2', // US East (Ohio),
  // 'ca-central-1', // Canada (Central),
  // 'ap-northeast-1', // Asia Pacific (Tokyo),
  // 'ap-southeast-1', // Asia Pacific (Singapore),
  // 'ap-southeast-2', // Asia Pacific (Sydney),
];

const retries = 20;

// Publish assets into all regional buckets
// e.g. superwerker-assets-eu-central-1 etc.
const main = async () => {
  const assetManifestPath = path.resolve(__dirname, '..', '..', 'cdk.out', 'RootmailStack.assets.json');
  for (const region of REGIONS) {
    const command = `AWS_REGION=${region} yarn cdk-assets publish -p ${assetManifestPath}`;
    console.log(command);
    await retry(async (_: any, attempt: number) => {
      console.log(`Attempt ${attempt} of ${retries} in region ${region}`);
      const execResult = await execSync(command);
      console.log(execResult.toString());
    }, {
      retries: retries,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 30000,
    });
  }
};

// top level await madness
(async () => { await main(); })().catch(e => {
  console.error(e);
});
