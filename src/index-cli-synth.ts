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

const rootmailVersion = process.env.ROOTMAIL_VERSION || '0.0.0-DEVELOPMENT';

interface RootmailStackProps extends StackProps {
  readonly version?: string;
}

class RootmailStack extends Stack {
  constructor(scope: Construct, id: string, props: RootmailStackProps) {
    super(scope, id, props);

    Stack.of(this).templateOptions.description = 'TBD';
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

    const enableAutowireDNS = new CfnParameter(this, 'EnableAutowireDNS', {
      type: 'String',
      description: 'Automatically wire the DNS. Your domain must be in the SAME AWS Account for this to work.',
      allowedValues: ['Yes', 'No'],
      default: 'Yes',
    });

    new Rootmail(this, 'Rootmail', {
      domain: domain.valueAsString,
      subdomain: subdomain.valueAsString,
      totalTimeToWireDNS: Duration.minutes(totalTimeToWireDNS.valueAsNumber),
      enableAutowireDNS: enableAutowireDNS.valueAsString.toLowerCase().trim() === 'yes',
    });
  }
}

new RootmailStack(app, 'RootmailStack', {
  version: rootmailVersion,
  synthesizer: new CliCredentialsStackSynthesizer({
    fileAssetsBucketName: 'mvc-test4-bucket-${AWS::Region}',
    bucketPrefix: `rootmail/${rootmailVersion}/`,
  }),
});

app.synth();