import * as path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntegTest, ExpectedResult, LogType, InvocationType } from '@aws-cdk/integ-tests-alpha';
import {
  App,
  Duration,
  // Duration,
  // Aspects,
  Stack,
  aws_iam as iam,
  aws_lambda as lambda,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
// eslint-disable-next-line import/no-extraneous-dependencies
// import { AwsSolutionsChecks } from 'cdk-nag';
import { Rootmail } from '../src/rootmail';
import { SESReceiveStack } from '../src/ses-receive-stack';
// CDK App for Integration Tests
const app = new App();
// Add the cdk-nag AwsSolutions Pack with extra verbose logging enabled.
// Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
// Stack under test
const stackUnderTest = new Stack(app, 'RootmailTestStack', {
  // env: {
  // region: 'eu-central-1',
  // account: '1234',
  // },
  // setDestroyPolicyToAllResources: true,
  description:
    "This stack includes the application's resources for integration testing.",
});

const subdomain = 'integ-test-auto';
const domain = 'mavogel.xyz';
const rootMailDeployRegion = 'eu-central-1';

const rootmail = new Rootmail(stackUnderTest, 'testRootmail', {
  subdomain: subdomain,
  domain: domain,
  emailBucketName: 'bab2d6439c39-rootmail-bucket-integtest',
  // tests took on average 15-20 minutes , but we leave some buffer
  totalTimeToWireDNS: Duration.minutes(40),
  autowireDNSOnAWSEnabled: true,
  autowireDNSOnAWSParentHostedZoneId: 'Z02503291YUXLE3C4727T', // mavogel.xyz
  env: {
    region: rootMailDeployRegion,
  },
});

// as cdk is multi account and region unlike cloudformation we can deploy the stack directly
const sesReceiveStack = new SESReceiveStack(stackUnderTest, 'SESReceiveStack', {
  domain: domain,
  subdomain: subdomain,
  emailbucket: rootmail.emailBucket,
  rootMailDeployRegion: rootMailDeployRegion,
  // this is fixed to eu-west-1 until SES supports receive more globally (see #23)
  env: {
    region: 'eu-west-1',
  },
});
sesReceiveStack.addDependency(rootmail); // TODO is this needed?

const fullDomain = `${subdomain}.${domain}`;

// Initialize Integ Test construct
const integ = new IntegTest(app, 'SetupTest', {
  testCases: [stackUnderTest], // Define a list of cases for this test
  cdkCommandOptions: {
    // Customize the integ-runner parameters
    deploy: {
      args: {
        // If I do not provide this argument it will fail with
        // 'You must either specify a list of Stacks or the `--all` argument'
        stacks: [], // TODO dunno why the opsSanta is not processing! Keep the stacks maybe
        //  Wait for SES in eu-west-1 to be in production state
        all: true,
      },
    },
    destroy: {
      args: {
        force: true,
      },
    },
  },
  hooks: {
    postDestroy: [
      'echo "All resources have been destroyed."',
    ],
  },
  regions: [stackUnderTest.region],
});

const sendEmailHandler = new NodejsFunction(stackUnderTest, 'send-email-handler', {
  entry: path.join(__dirname, 'functions', 'send-email-handler.ts'),
  runtime: lambda.Runtime.NODEJS_18_X,
  logRetention: 1,
  timeout: Duration.seconds(30),
  initialPolicy: [
    new iam.PolicyStatement({
      actions: [
        'ses:SendEmail',
        'ses:DescribeReceiptRule',
      ],
      resources: ['*'],
    }),
  ],
});

/**
 * Assertion:
 * The application should parse a dummy email, store it in S3 and set create an OPS item.
 */
const id = 'test-id-1';
const message = 'This is a mail body';

const sendTestEmailAssertion = integ.assertions
  .invokeFunction({
    functionName: sendEmailHandler.functionName,
    logType: LogType.TAIL,
    invocationType: InvocationType.REQUEST_RESPONE, // to run it synchronously
    payload: JSON.stringify({
      id: id,
      text: message,
      sourceMail: `test@${fullDomain}`,
      toMail: `root+${id}@${fullDomain}`,
    }),
  }).expect(ExpectedResult.exact({
    statusCode: '200',
  }),
  );

// sendTestEmailAssertion.provider.addToRolePolicy({
//   Effect: 'Allow',
//   Action: [
//     'ses:SendEmail',
//   ],
//   Resource: [
//     // 'arn:aws:ses:eu-central-1:935897259846:identity/root+test-id-1@aws-test.mavogel.xyz',
//     // `arn:aws:ses:::identity/root+${id}@${fullDomain}`,
//     // arn:aws:ses:eu-west-1:935897259846:identity/aws-test.mavogel.xyz
//     '*',
//   ],
// });

const validateOpsItemAssertion = integ.assertions
  .awsApiCall('SSM', 'getOpsSummary', {
    Filters: [
      {
        Key: 'AWS:OpsItem.Title',
        Values: [id],
        Type: 'Equal',
      },
      {
        Key: 'AWS:OpsItem.Status',
        Values: ['Open'],
        Type: 'Equal',
      },
    ],
  })
  /**
   * Expect the ops item to be created and returned.
   */
  .expect(
    ExpectedResult.objectLike({
      Entities: [
        {
          Id: id,
          Data: {
            'AWS:OpsItem': {
              Content: [
                {
                  Description: message,
                },
              ],
            },
          },
        },
      ],
    }),
  )
  /**
   * Timeout and interval check for assertion to be true.
   * Note - Data may take some time to be parsed and the OPS item to be created.
   * Iteratively executes API call at specified interval.
   */
  .waitForAssertions({
    totalTimeout: Duration.minutes(3),
    interval: Duration.seconds(10),
  });

validateOpsItemAssertion.provider.addToRolePolicy({
  Effect: 'Allow',
  Action: [
    'ssm:GetOpsSummary',
  ],
  Resource: ['*'],
});

const updateOpsItemAssertion = integ.assertions
  .awsApiCall('SSM', 'updateOpsItem', {
    OpsItemId: id,
    Status: 'Resolved',
  });

updateOpsItemAssertion.provider.addToRolePolicy({
  Effect: 'Allow',
  Action: [
    'ssm:UpdateOpsItem',
  ],
  Resource: ['*'],
});

/**
 * Main test case
 */
integ.assertions
  /**
  * Check that parameter are present
  */
  .awsApiCall('SSM', 'getParameter', {
    Name: rootmail.hostedZoneParameterName,
  })
  .expect(
    ExpectedResult.objectLike({
      Parameter: {
        Name: rootmail.hostedZoneParameterName,
        Type: 'StringList',
      },
    }),
  )
  .next(
    integ.assertions.
      awsApiCall('CloudWatchEvents', 'describeRule', {
        Name: rootmail.rootMailReadyEventRule.ruleName,
      })
      .expect(
        ExpectedResult.objectLike({
          State: 'DISABLED',
        }),
      ),
  )
  // Send a test email
  .next(sendTestEmailAssertion)
  // Validate an OPS item was created.
  .next(validateOpsItemAssertion)
  // Close the OPS item that was created.
  .next(updateOpsItemAssertion);

// TODO call teardown lambda
// - s3 rootmail bucket (empty & remove)
// - main domain ns records for `aws` subdomain HZ
// - cw log groups prefixed with '/aws/lambda/RootmailTestStack*' in eu-west-1 and eu-central-1