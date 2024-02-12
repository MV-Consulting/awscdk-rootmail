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

let rootmailVersion = process.env.ROOTMAIL_VERSION;
if (!process.env.ROOTMAIL_VERSION || process.env.ROOTMAIL_VERSION === '') {
  console.log('ROOTMAIL_VERSION is not set. Using default \'0.0.0-DEVELOPMENT\'');
  rootmailVersion = '0.0.0-DEVELOPMENT';
}

console.log(`Using ROOTMAIL_VERSION Version: '${rootmailVersion}'`);


new RootmailStack(app, 'RootmailStack', {

  version: rootmailVersion,
  synthesizer: new CliCredentialsStackSynthesizer({
    // TODO: https://www.simplified.guide/aws/s3/create-public-bucket
    fileAssetsBucketName: 'mvc-test4-bucket-${AWS::Region}',
    bucketPrefix: `rootmail/${rootmailVersion}/`,
  }),
});

app.synth();