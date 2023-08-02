import * as path from 'path';
import { IntegTest, ExpectedResult, LogType, InvocationType } from '@aws-cdk/integ-tests-alpha';
import {
  App,
  Duration,
  Aspects,
  Stack,
  aws_lambda as lambda,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { AwsSolutionsChecks } from 'cdk-nag';
import { Rootmail } from '../src/rootmail';
// CDK App for Integration Tests
const app = new App();
// Add the cdk-nag AwsSolutions Pack with extra verbose logging enabled.
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
// Stack under test
const stackUnderTest = new Stack(app, 'IntegrationTestStack', {
  // env: {
  //   region: 'us-east-1',
  //   account: '1234',
  // },
  // setDestroyPolicyToAllResources: true,
  description:
    "This stack includes the application's resources for integration testing.",
});

new Rootmail(stackUnderTest, 'testRootmail', {
  subdomain: 'aws-test',
  domain: 'mavogel.xyz',
  emailBucketName: `${Stack.of(stackUnderTest).account}-rootmail-bucket-integtest`,
});

const fullDomain = 'aws-test.mavogel.xyz';

// Initialize Integ Test construct
const integ = new IntegTest(app, 'SetupTest', {
  testCases: [stackUnderTest], // Define a list of cases for this test
  cdkCommandOptions: {
    // Customize the integ-runner parameters
    destroy: {
      args: {
        force: true,
      },
    },
  },
  regions: [stackUnderTest.region],
});

/**
 * Assertion:
 * The application should parse a dummy email, store it in S3 and set create an OPS item.
 */
const id = 'test-id-1';
const message = 'This is a mail body';
const hostedZoneParameterName = '/superwerker/domain_name_servers';
const wireRootmailDnsInvoke = new NodejsFunction(stackUnderTest, 'wire-rootmail-dns-handler', {
  entry: path.join(__dirname, 'functions', 'wire-rootmail-dns-handler.ts'),
  runtime: lambda.Runtime.NODEJS_18_X,
  timeout: Duration.minutes(5),
});

integ.assertions
  /**
  * Wait until NS server a propagated
  */
  .awsApiCall('SSM', 'getParameter', {
    Name: hostedZoneParameterName, // TODO as export
  })
  .expect(
    ExpectedResult.objectLike({
      Parameter: {
        PSParameterName: hostedZoneParameterName,
        ParameterType: 'StringList',
      },
    }),
  )
  .waitForAssertions({
    totalTimeout: Duration.minutes(5),
    interval: Duration.seconds(30),
  })
  /**
   * Wire the NS server for the subdomain
   */
  .next(
    integ.assertions
      .invokeFunction({
        functionName: wireRootmailDnsInvoke.functionName,
        logType: LogType.TAIL,
        invocationType: InvocationType.REQUEST_RESPONE, // to run it synchronously
        payload: JSON.stringify({
          domain: 'mavogel.xyz',
          subdomain: 'aws-test',
          hostedZoneParameterName: hostedZoneParameterName,
        }),
      }).expect(ExpectedResult.objectLike({
        payload: '200',
      }),
      ),
  )
  /**
   * Send a test email
   */
  .next(
    integ.assertions
      .awsApiCall('SES', 'sendEmail', {
        Source: `test@${fullDomain}`,
        Destination: {
          ToAddresses: [`root+${id}@${fullDomain}`],
        },
        Message: {
          Subject: {
            Data: id,
          },
          Body: {
            Text: {
              Data: message,
            },
          },
        },
      }),
  )
  /**
   * Validate an OPS item was created.
   */
  .next(
    integ.assertions
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
          // NextToken: '',
        }),
      )
      /**
       * Timeout and interval check for assertion to be true.
       * Note - Data may take some time to be parsed and the OPS item to be created.
       * Iteratively executes API call at specified interval.
       */
      .waitForAssertions({
        totalTimeout: Duration.minutes(15),
        interval: Duration.seconds(30),
      }),
  )
  /**
   * Close the OPS item that was created.
   */
  .next(
    integ.assertions
      .awsApiCall('SSM', 'updateOpsItem', { // TODO checke method
        OpsItemId: id,
        Status: 'Resolved',
      })
      /**
       * Expect the ops item to be closed.
       */
      .expect(
        ExpectedResult.objectLike({}), // TODO check
      ),
  );
// TODO call teardown lambda
// - s3 rootmail bucket (empty & remove)
// - main domain ns records for `aws` subdomain HZ
// - SES ruleset and verified identities
// - cw logs