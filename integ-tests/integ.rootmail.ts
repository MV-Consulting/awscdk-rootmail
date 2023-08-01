import { IntegTest, ExpectedResult } from '@aws-cdk/integ-tests-alpha';
import { App, Duration, Aspects, Stack } from 'aws-cdk-lib';
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
  subdomain: 'aws',
  domain: 'mavogel.xyz',
});

const fullDomain = 'aws.mavogel.xyz';

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
/**
 * Publish a email to the domain.
 */
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
  })
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
  );