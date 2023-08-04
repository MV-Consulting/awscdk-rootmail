// eslint-disable-next-line import/no-extraneous-dependencies
import { IntegTest, ExpectedResult } from '@aws-cdk/integ-tests-alpha';
import {
  App,
  // Duration,
  // Aspects,
  Stack,
} from 'aws-cdk-lib';
// eslint-disable-next-line import/no-extraneous-dependencies
// import { AwsSolutionsChecks } from 'cdk-nag';
import { Rootmail } from '../src/rootmail';
// CDK App for Integration Tests
const app = new App();
// Add the cdk-nag AwsSolutions Pack with extra verbose logging enabled.
// Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true })); // TODO enable again
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

const rootmail = new Rootmail(stackUnderTest, 'testRootmail', {
  subdomain: 'aws-test',
  domain: 'mavogel.xyz',
  emailBucketName: 'acd2d6439c39-rootmail-bucket-integtest',
  autowireDNSOnAWSEnabled: true,
  autowireDNSOnAWSParentHostedZoneId: 'Z02503291YUXLE3C4727T', // mavogel.xyz
});

// const fullDomain = 'aws-test.mavogel.xyz';

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
// const id = 'test-id-1';
// const message = 'This is a mail body';

// const sendTestEmailAssertion = integ.assertions
//   .awsApiCall('SES', 'sendEmail', {
//     Source: `test@${fullDomain}`,
//     Destination: {
//       ToAddresses: [`root+${id}@${fullDomain}`],
//     },
//     Message: {
//       Subject: {
//         Data: id,
//       },
//       Body: {
//         Text: {
//           Data: message,
//         },
//       },
//     },
//   });

// sendTestEmailAssertion.provider.addToRolePolicy({
//   Effect: 'Allow',
//   Action: [
//     'ses:SendEmail',
//   ],
//   Resource: [
//     // 'arn:aws:ses:eu-central-1:935897259846:identity/root+test-id-1@aws-test.mavogel.xyz',
//     // `arn:aws:ses:::identity/root+${id}@${fullDomain}`,
//     '*',
//   ],
// });

// const validateOpsItemAssertion = integ.assertions
//   .awsApiCall('SSM', 'getOpsSummary', {
//     Filters: [
//       {
//         Key: 'AWS:OpsItem.Title',
//         Values: [id],
//         Type: 'Equal',
//       },
//       {
//         Key: 'AWS:OpsItem.Status',
//         Values: ['Open'],
//         Type: 'Equal',
//       },
//     ],
//   })
//   /**
//    * Expect the ops item to be created and returned.
//    */
//   .expect(
//     ExpectedResult.objectLike({
//       Entities: [
//         {
//           Id: id,
//           Data: {
//             'AWS:OpsItem': {
//               Content: [
//                 {
//                   Description: message,
//                 },
//               ],
//             },
//           },
//         },
//       ],
//       // NextToken: '',
//     }),
//   )
//   /**
//    * Timeout and interval check for assertion to be true.
//    * Note - Data may take some time to be parsed and the OPS item to be created.
//    * Iteratively executes API call at specified interval.
//    */
//   .waitForAssertions({
//     totalTimeout: Duration.minutes(1),
//     interval: Duration.seconds(5),
//   });

// validateOpsItemAssertion.provider.addToRolePolicy({
//   Effect: 'Allow',
//   Action: [
//     'ssm:GetOpsSummary',
//   ],
//   Resource: ['*'],
// });

// const updateOpsItemAssertion = integ.assertions
//   .awsApiCall('SSM', 'updateOpsItem', { // TODO check method
//     OpsItemId: id,
//     Status: 'Resolved',
//   });
// /**
// * Expect the ops item to be closed.
// */
// // .expect(
// //   ExpectedResult.objectLike({}), // TODO check
// // ),

// updateOpsItemAssertion.provider.addToRolePolicy({
//   Effect: 'Allow',
//   Action: [
//     'ssm:UpdateOpsItem',
//   ],
//   Resource: ['*'],
// });

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
  );
// Send a test email
// .next(sendTestEmailAssertion)
// Validate an OPS item was created.
// .next(validateOpsItemAssertion)
// Close the OPS item that was created.
// .next(updateOpsItemAssertion);

// TODO call teardown lambda
// - s3 rootmail bucket (empty & remove)
// - main domain ns records for `aws` subdomain HZ
// - SES verified identities
// - cw log groups prefixed with '/aws/lambda/IntegrationTestStack*'