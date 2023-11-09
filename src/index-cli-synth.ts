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

const rootmailVersion = process.env.ROOTMAIL_VERSION || '0.0.9-DEVELOPMENT';

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

    const autowireDNS = new CfnParameter(this, 'AutowireDNS', {
      type: 'String',
      description: 'Set to \'true\' to autowire the DNS if HostedZone of the Domain is in the SAME AWS Account. Leave blank of you domain is at an external DNS provider',
      default: 'false',
      allowedValues: ['true', 'false'],
    });

    new Rootmail(this, 'Rootmail', {
      domain: domain.valueAsString,
      subdomain: subdomain.valueAsString,
      totalTimeToWireDNS: Duration.minutes(totalTimeToWireDNS.valueAsNumber),
      autowireDNS: autowireDNS.valueAsString.trim().toLowerCase() === 'true',
    });
  }
}

new RootmailStack(app, 'RootmailStack', {
  version: rootmailVersion,
  synthesizer: new CliCredentialsStackSynthesizer({
    // TODO: https://www.simplified.guide/aws/s3/create-public-bucket
    fileAssetsBucketName: 'mvc-test4-bucket-${AWS::Region}',
    bucketPrefix: `rootmail/${rootmailVersion}/`,
  }),
});

app.synth();