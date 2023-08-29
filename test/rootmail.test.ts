import {
  App,
  Stack,
} from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Rootmail, RootmailProps } from '../src';

test('rootmail-fails-to-create-with-autoDNSEnable', () => {
  const app = new App();
  const stack = new Stack(app, 'testStack', {
    env: {
      region: 'us-east-1',
      account: '1234',
    },
  });

  const testProps: RootmailProps = {
    domain: 'example.com',
    autowireDNSOnAWSParentHostedZoneId: '',
  };

  try {
    new Rootmail(stack, 'testRootmail', testProps);
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
    return;
  }

  fail('Should have thrown an error');
});

test('rootmail-create-with-autoDNSEnable', () => {
  const app = new App();
  const stack = new Stack(app, 'testStack', {
    env: {
      region: 'us-east-1',
      account: '1234',
    },
  });

  const testProps: RootmailProps = {
    domain: 'example.com',
    autowireDNSOnAWSParentHostedZoneId: 'randomHZId',
  };

  new Rootmail(stack, 'testRootmail', testProps);

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});