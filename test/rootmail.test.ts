import {
  App,
  Aspects,
  Stack,
} from 'aws-cdk-lib';
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { Rootmail, RootmailProps } from '../src';

describe('rootmail-autoDns', () => {
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
});

describe.skip('rootmail-cdk-nag-AwsSolutions-Pack', () => {
  let stack: Stack;
  let app: App;
  // In this case we can use beforeAll() over beforeEach() since our tests
  // do not modify the state of the application
  beforeAll(() => {
    // GIVEN
    app = new App();
    stack = new Stack(app, 'testStack', {
      env: {
        region: 'us-east-1',
        account: '1234',
      },
    });

    new Rootmail(stack, 'testRootmail', {
      domain: 'example.com',
    });

    // WHEN
    Aspects.of(stack).add(new AwsSolutionsChecks({ verbose: true }));
  });

  // THEN
  test('No unsuppressed Warnings', () => {
    const warnings = Annotations.fromStack(stack).findWarning(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*'),
    );
    expect(warnings).toHaveLength(0);
  });

  test('No unsuppressed Errors', () => {
    const errors = Annotations.fromStack(stack).findError(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*'),
    );
    if (errors.length > 0) {
      for (const error of errors) {
        // if (error.id.includes('EmailBucket')) {
        console.log(`id: '${error.id}': ${error.entry.data}`);
        // }
      }
    }
    expect(errors).toHaveLength(0);
  });
});