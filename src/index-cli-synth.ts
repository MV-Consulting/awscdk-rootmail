import {
  App,
  CfnParameter,
  CliCredentialsStackSynthesizer,
  Duration,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Rootmail } from './rootmail';

const app = new App();

interface RootmailStackProps extends StackProps {
  readonly version?: string;
}

class RootmailStack extends Stack {
  constructor(scope: Construct, id: string, props: RootmailStackProps) {
    super(scope, id, props);

    Stack.of(this).templateOptions.description = 'The rootmail feature. All EMail in one AWS Account';
    Stack.of(this).templateOptions.metadata = {
      RootmailVersion: props.version,
    };

    const domain = new CfnParameter(this, 'Domain', {
      type: 'String',
      description: 'Domain used for root mail feature.',
    });

    const subdomain = new CfnParameter(this, 'Subdomain', {
      type: 'String',
      description: 'Subdomain used for root mail feature.',
      default: 'aws',
    });

    const totalTimeToWireDNS = new CfnParameter(this, 'TotalTimeToWireDNS', {
      type: 'Number',
      description: 'Total time in MINUTES to wire the DNS.',
      default: 120,
      minValue: 5,
      maxValue: 120,
    });

    const wireDNSToHostedZoneID = new CfnParameter(this, 'WireDNSToHostedZoneID', {
      type: 'String',
      description: 'Set to the ID of the HostedZone of the Domain is in the SAME AWS Account. Leave blank of you domain is at an external DNS provider',
      default: '',
    });

    new Rootmail(this, 'Rootmail', {
      domain: domain.valueAsString,
      subdomain: subdomain.valueAsString,
      totalTimeToWireDNS: Duration.minutes(totalTimeToWireDNS.valueAsNumber),
      wireDNSToHostedZoneID: wireDNSToHostedZoneID.valueAsString.trim(),
    });
  }
}

let releaseVersion = process.env.RELEASE_VERSION;
if (!process.env.RELEASE_VERSION || process.env.RELEASE_VERSION === '') {
  console.log('RELEASE_VERSION is not set. Using default \'0.0.0-DEVELOPMENT\'');
  releaseVersion = '0.0.0-DEVELOPMENT';
}

if (!process.env.RELEASE_NAME || process.env.RELEASE_NAME === '') {
  throw new Error('RELEASE_NAME environment variable must be set');
}
const releaseName = process.env.RELEASE_NAME;

if (!process.env.RELEASE_PREFIX || process.env.RELEASE_PREFIX === '') {
  throw new Error('RELEASE_PREFIX environment variable must be set');
}
const releasePrefix = process.env.RELEASE_PREFIX;

if (!process.env.S3_FILE_ASSETS_BUCKET_PREFIX || process.env.S3_FILE_ASSETS_BUCKET_PREFIX === '') {
  throw new Error('S3_FILE_ASSETS_BUCKET_PREFIX environment variable must be set');
}
const s3FileAssetsBucketPrefix = process.env.S3_FILE_ASSETS_BUCKET_PREFIX;

console.log(`Using RELEASE_NAME: '${releaseName}' RELEASE_VERSION Version: '${releaseVersion}' with prefix: '${releasePrefix}'`);
new RootmailStack(app, releaseName, {
  version: releaseVersion,
  synthesizer: new CliCredentialsStackSynthesizer({
    fileAssetsBucketName: `${s3FileAssetsBucketPrefix}-\${AWS::Region}`,
    bucketPrefix: `${releasePrefix}/${releaseVersion}/`,
  }),
});
app.synth();