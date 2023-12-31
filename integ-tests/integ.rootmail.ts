import * as path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntegTest, ExpectedResult, LogType, InvocationType } from '@aws-cdk/integ-tests-alpha';
import {
  App,
  Duration,
  Stack,
  aws_iam as iam,
  aws_lambda as lambda,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Rootmail } from '../src/rootmail';
// CDK App for Integration Tests
const app = new App();
// Parameters TODO
const testDomain = process.env.TEST_DOMAIN ?? '';
const testAccount = process.env.TEST_ACCOUNT_ID ?? process.env.CDK_DEFAULT_ACCOUNT ?? '';
const testRegion = 'eu-west-1';
console.log(`Running integration tests in region '${testRegion}' and account '${testAccount}' for domain '${testDomain}'`);
if (testDomain === '' || testAccount === '') {
  throw new Error(`TEST_DOMAIN and TEST_ACCOUNT_ID environment variables must be set. Were TEST_DOMAIN='${testDomain}' and TEST_ACCOUNT_ID='${testAccount}'`);
}
// Stack under test
const stackUnderTestName = 'RootmailTestStack';
const stackUnderTest = new Stack(app, stackUnderTestName, {
  description: "This stack includes the application's resources for integration testing.",
  env: {
    account: testAccount,
    region: testRegion,
  },
});

const randomTestId = 1234;
const testSubdomain = `integ-test-${randomTestId}`;

const rootmail = new Rootmail(stackUnderTest, 'testRootmail', {
  subdomain: testSubdomain,
  domain: testDomain,
  // tests took on average 10-15 minutes , but we leave some buffer
  totalTimeToWireDNS: Duration.minutes(20),
  enableAutowireDNS: true,
  setDestroyPolicyToAllResources: false,
});

const fullDomain = `${testSubdomain}.${testDomain}`;

// Initialize Integ Test construct
const integStackName = 'SetupTest';
const integ = new IntegTest(app, integStackName, {
  testCases: [stackUnderTest], // Define a list of cases for this test
  cdkCommandOptions: {
    // Customize the integ-runner parameters
    deploy: {
      args: {
        // If I do not provide this argument it will fail with
        // 'You must either specify a list of Stacks or the `--all` argument'
        stacks: [],
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
      'echo "Post hook"',
      // TOOD: needs to be verified
      // `echo "Deleting S3 bucket '${rootmail.emailBucket.bucketName}'`,
      // `python3 cleanup/empty-and-delete-s3-bucket.py ${rootmail.emailBucket.bucketName}`,
    ],
  },
  regions: [stackUnderTest.region],
});

const sendEmailHandler = new NodejsFunction(stackUnderTest, 'send-email-handler', {
  functionName: `${stackUnderTestName}-send-email-handler`,
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

const closeOpsItemHandler = new NodejsFunction(stackUnderTest, 'close-opsitem-handler', {
  functionName: `${stackUnderTestName}-close-opsitem-handler`,
  entry: path.join(__dirname, 'functions', 'close-opsitem-handler.ts'),
  runtime: lambda.Runtime.NODEJS_18_X,
  logRetention: 1,
  timeout: Duration.seconds(180),
  initialPolicy: [
    new iam.PolicyStatement({
      actions: [
        'ssm:GetOpsSummary',
        'ssm:UpdateOpsItem',
      ],
      resources: ['*'],
    }),
  ],
});

/**
 * Assertion:
 * The application should parse a dummy email, store it in S3 and set create an OPS item.
 */
const id = `test-id-${randomTestId}`;
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
  }).expect(ExpectedResult.objectLike(
    // as the object 'return { sendStatusCode: 200 };' is wrapped in a Payload object with other properties
    {
      Payload: {
        sendStatusCode: 200,
      },
    },
  ),
  );


const validateOpsItemAssertion = integ.assertions
  .invokeFunction({
    functionName: closeOpsItemHandler.functionName,
    logType: LogType.TAIL,
    invocationType: InvocationType.REQUEST_RESPONE, // to run it synchronously
    payload: JSON.stringify({
      title: id,
      source: `root+${id}@${fullDomain}`,
      description: `${message}\n`,
    }),
  }).expect(ExpectedResult.objectLike(
    // as the object 'return { closeStatusCode: 200 };' is wrapped in a Payload object with other properties
    {
      Payload: {
        closeStatusCode: 200,
      },
    },
  ),
  );
// NOTE: this is not working as expected
// .waitForAssertions({
//   totalTimeout: Duration.minutes(2),
//   interval: Duration.seconds(10),
// });

const getHostedZoneParametersAssertion = integ.assertions
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
  );

/**
 * Main test case
 */
// check the parameter store
getHostedZoneParametersAssertion
  // Send a test email
  .next(sendTestEmailAssertion)
  // Validate and close the OPS item that was created.
  .next(validateOpsItemAssertion);