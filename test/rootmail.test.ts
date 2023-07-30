import {
  App,
  Stack,
} from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Rootmail, RootmailProps } from '../src';

test.skip('rootmail create', () => {
  const app = new App();
  const stack = new Stack(app, 'testStack', {
    env: {
      region: 'us-east-1',
      account: '1234',
    },
  });

  const testProps: RootmailProps = {
    domain: 'example.com',
  };

  new Rootmail(stack, 'testRootmail', testProps);

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});