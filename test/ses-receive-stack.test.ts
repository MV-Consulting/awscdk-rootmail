import {
  App,
  Stack,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { SESReceiveStack, SESReceiveStackProps } from '../src';

test('ses-receive-stack-create', () => {
  const app = new App();
  const stack = new Stack(app, 'testStack', {
    env: {
      region: 'eu-west-1',
      account: '1234',
    },
  });

  const emailBucket = new s3.Bucket(stack, 'EmailBucket', {
    bucketName: 'test-email-bucket',
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  });

  const testProps: SESReceiveStackProps = {
    domain: 'example.com',
    subdomain: 'aws',
    emailbucket: emailBucket,
    rootMailDeployRegion: 'eu-central-1',
  };

  new SESReceiveStack(stack, 'testSesReceive', testProps);

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});