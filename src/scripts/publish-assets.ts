import { execSync } from 'child_process';
const path = require('path');
import * as retry from 'async-retry';

if (!process.env.RELEASE_NAME || process.env.RELEASE_NAME === '') {
  throw new Error('RELEASE_NAME environment variable must be set');
}

if (!process.env.RELEASE_RETRIES || process.env.RELEASE_RETRIES === '') {
  throw new Error('RELEASE_RETRIES environment variable must be set');
}

if (!process.env.RELEASE_REGIONS || process.env.RELEASE_REGIONS.length === 0) {
  throw new Error('RELEASE_REGIONS environment variable must be set and not empty');
}

const releaseName = process.env.RELEASE_NAME;
const releaseRetries = process.env.RELEASE_RETRIES as unknown as number;
const releaseRegions = process.env.RELEASE_REGIONS.split(',');
console.log(`Publishing assets for release ${releaseName} with ${releaseRetries} retries to regions: ${releaseRegions}`);

const main = async () => {
  const assetManifestPath = path.resolve(__dirname, '..', '..', 'cdk.out', `${releaseName}.assets.json`);
  for (const region of releaseRegions) {
    const command = `AWS_REGION=${region} yarn cdk-assets publish -p ${assetManifestPath}`;
    console.log(command);
    await retry(async (_: any, attempt: number) => {
      console.log(`Attempt ${attempt} of ${releaseRetries} in region ${region}`);
      const execResult = await execSync(command);
      console.log(execResult.toString());
    }, {
      retries: releaseRetries,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 30000,
    });
  }
};

(async () => { await main(); })().catch(e => {
  console.error(e);
});
