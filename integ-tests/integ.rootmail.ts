import * as path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntegTest, ExpectedResult, LogType, InvocationType } from '@aws-cdk/integ-tests-alpha';
import {
  App,
  Arn,
  ArnFormat,
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
// CDK App for Integration Tests
const app = new App();
// Add the cdk-nag AwsSolutions Pack with extra verbose logging enabled.
// see https://aws.amazon.com/de/blogs/devops/manage-application-security-and-compliance-with-the-aws-cloud-development-kit-and-cdk-nag/
// Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
// Stack under test
const stackUnderTestName = 'RootmailTestStack';
const stackUnderTest = new Stack(app, stackUnderTestName, {
  // env: {
  // region: 'eu-central-1',
  // account: '1234',
  // },
  description:
    "This stack includes the application's resources for integration testing.",
});

const randomTestId = Math.floor(Math.random() * 100000);
const subdomain = `integ-test-${randomTestId}`; // TODO randomize
const domain = 'mavogel.xyz';
const parentHostedZoneId = 'Z02503291YUXLE3C4727T'; // mavogel.xyz

const rootmail = new Rootmail(stackUnderTest, 'testRootmail', {
  subdomain: subdomain,
  domain: domain,
  // tests took on average 15-20 minutes , but we leave some buffer
  totalTimeToWireDNS: Duration.minutes(40),
  autowireDNSOnAWSParentHostedZoneId: parentHostedZoneId,
  setDestroyPolicyToAllResources: false,
});

const fullDomain = `${subdomain}.${domain}`;

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

const closeOpsItemHandler = new NodejsFunction(stackUnderTest, 'close-opsitem-handler', {
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

const cleanupHandler = new NodejsFunction(stackUnderTest, 'cleanup-handler', {
  entry: path.join(__dirname, 'functions', 'cleanup-handler.ts'),
  runtime: lambda.Runtime.NODEJS_18_X,
  logRetention: 1,
  timeout: Duration.seconds(60),
  initialPolicy: [
    new iam.PolicyStatement({
      actions: [
        'logs:DescribeLogGroups',
      ],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      actions: [
        'logs:DeleteLogGroup',
      ],
      resources: [
        Arn.format({
          partition: 'aws',
          service: 'logs',
          region: '*',
          account: '*',
          resource: 'log-group',
          arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          resourceName: `/aws/lambda/${stackUnderTestName}*`,
        }),
        Arn.format({
          partition: 'aws',
          service: 'logs',
          region: '*',
          account: '*',
          resource: 'log-group',
          arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          resourceName: `/aws/lambda/${integStackName}*`,
        }),
      ],
    }),
    new iam.PolicyStatement({
      actions: [
        'route53:ListHostedZonesByName',
      ],
      effect: iam.Effect.ALLOW,
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      actions: [
        'route53:ListResourceRecordSets',
        'route53:ChangeResourceRecordSets',
      ],
      effect: iam.Effect.ALLOW,
      resources: [
        // arn:aws:route53:::hostedzone/H12345
        // arn:{partition}:{service}:{region}:{account}:{resource}{sep}{resource-name}
        Arn.format({
          partition: 'aws',
          service: 'route53',
          region: '',
          account: '',
          resource: 'hostedzone',
          arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: parentHostedZoneId,
        }),
      ],
    }),
  ],
});

rootmail.emailBucket.grantRead(cleanupHandler);
rootmail.emailBucket.grantDelete(cleanupHandler);

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

// const cleanupAssertion = integ.assertions
//   .invokeFunction({
//     functionName: cleanupHandler.functionName,
//     logType: LogType.TAIL,
//     invocationType: InvocationType.REQUEST_RESPONE, // to run it synchronously
//     payload: JSON.stringify({
//       s3EmailBucketName: rootmail.emailBucket.bucketName,
//       parentHostedZoneId: parentHostedZoneId,
//       domain: domain,
//       subdomain: subdomain,
//       logGroupNamePrefixes: `/aws/lambda/${stackUnderTestName},/aws/lambda/${integStackName}`,
//     }),
//   }).expect(ExpectedResult.objectLike(
//     // as the object 'return { success: 200 };' is wrapped in a Payload object with other properties
//     {
//       Payload: {
//         success: 200,
//       },
//     },
//   ),
//   );

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
// call teardown lambda // TODO check for race condition
// .next(cleanupAssertion);