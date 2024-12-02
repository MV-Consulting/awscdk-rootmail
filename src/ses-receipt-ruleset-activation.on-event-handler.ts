import { SES } from '@aws-sdk/client-ses';
// eslint-disable-next-line import/no-unresolved
import * as AWSCDKAsyncCustomResource from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
export const PROP_DOMAIN = 'Domain';
export const PROP_SUBDOMAIN = 'Subdomain';
export const PROP_EMAILBUCKET_NAME = 'EmailBucketName';
export const PROP_OPS_SANTA_FUNCTION_ARN = 'OpsSantaFunctionArn';
export const PROP_RULESET_SETTLE_TIME_SECONDS = 'RulesetSettleTimeSeconds';
export const FILTERED_EMAIL_SUBJECTS = 'FilteredEmailSubjects';

const ses = new SES();

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest): Promise<AWSCDKAsyncCustomResource.OnEventResponse> {
  const domain = event.ResourceProperties[PROP_DOMAIN];
  const subdomain = event.ResourceProperties[PROP_SUBDOMAIN];
  const emailBucketName = event.ResourceProperties[PROP_EMAILBUCKET_NAME];
  const opsSantaFunctionArn = event.ResourceProperties[PROP_OPS_SANTA_FUNCTION_ARN];
  const logicalResourceId = event.LogicalResourceId;

  const ruleSetName = 'RootMail';
  const ruleName = 'Receive';
  const rootmailBucketObjectKeyPrefix = 'RootMail';

  switch (event.RequestType) {
    case 'Create':
      console.log(`${event.RequestType} SES ReceiptRuleSet. PhysicalResourceId: ${event.RequestId}`);
      await ses.createReceiptRuleSet({ RuleSetName: ruleSetName });

      await ses.createReceiptRule({
        RuleSetName: ruleSetName,
        Rule: {
          Name: ruleName,
          Enabled: true,
          TlsPolicy: 'Require',
          ScanEnabled: true,
          Recipients: [`root@${subdomain}.${domain}`],
          Actions: [
            {
              S3Action: {
                BucketName: emailBucketName,
                ObjectKeyPrefix: rootmailBucketObjectKeyPrefix,
              },
            },
            {
              LambdaAction: {
                FunctionArn: opsSantaFunctionArn,
              },
            },
          ],
        },
      });

      console.log('Activating SES ReceiptRuleSet:', logicalResourceId);

      await ses.setActiveReceiptRuleSet({ RuleSetName: ruleSetName });
      return {
        PhysicalResourceId: event.RequestId,
      };
    case 'Update':
      console.log(`${event.RequestType} SES ReceiptRuleSet. PhysicalResourceId: ${event.PhysicalResourceId}`);
      return {
        PhysicalResourceId: event.PhysicalResourceId,
      };
    case 'Delete':
      console.log('Deactivating SES ReceiptRuleSet:', logicalResourceId);

      await ses.setActiveReceiptRuleSet({ RuleSetName: undefined });

      await ses.deleteReceiptRule({
        RuleName: ruleName,
        RuleSetName: ruleSetName,
      });

      await ses.deleteReceiptRuleSet({ RuleSetName: ruleSetName });
      return {
        PhysicalResourceId: event.PhysicalResourceId,
      };
  }
};
