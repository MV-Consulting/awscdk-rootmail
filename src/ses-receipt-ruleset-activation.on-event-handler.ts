// eslint-disable-next-line import/no-unresolved
import * as AWSCDKAsyncCustomResource from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import * as AWS from 'aws-sdk';
export const PROP_DOMAIN = 'Domain';
export const PROP_SUBDOMAIN = 'Subdomain';
export const PROP_EMAILBUCKET_NAME = 'EmailBucketName';
export const PROP_OPS_SANTA_FUNCTION_ARN = 'OpsSantaFunctionArn';
export const PROP_RULESET_SETTLE_TIME_SECONDS = 'RulesetSettleTimeSeconds';

const ses = new AWS.SES();

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest): Promise<AWSCDKAsyncCustomResource.OnEventResponse> {
  const domain = event.ResourceProperties[PROP_DOMAIN];
  const subdomain = event.ResourceProperties[PROP_SUBDOMAIN];
  const emailBucketName = event.ResourceProperties[PROP_EMAILBUCKET_NAME];
  const opsSantaFunctionArn = event.ResourceProperties[PROP_OPS_SANTA_FUNCTION_ARN];
  const logicalResourceId = event.LogicalResourceId;

  const ruleSetName = 'RootMail';
  const ruleName = 'Receive';

  switch (event.RequestType) {
    case 'Create':
      await ses.createReceiptRuleSet({ RuleSetName: ruleSetName }).promise();

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
                ObjectKeyPrefix: 'RootMail',
              },
            },
            {
              LambdaAction: {
                FunctionArn: opsSantaFunctionArn,
              },
            },
          ],
        },
      }).promise();

      console.log('Activating SES ReceiptRuleSet:', logicalResourceId);

      await ses.setActiveReceiptRuleSet({ RuleSetName: ruleSetName }).promise();
      return {
        PhysicalResourceId: event.PhysicalResourceId,
      };

    case 'Update':
      console.log('Updating SES ReceiptRuleSet, doing nothing');
      return {
        PhysicalResourceId: event.PhysicalResourceId,
      };
    case 'Delete':
      console.log('Deactivating SES ReceiptRuleSet:', logicalResourceId);

      await ses.setActiveReceiptRuleSet({ RuleSetName: undefined }).promise();

      await ses.deleteReceiptRule({
        RuleName: ruleName,
        RuleSetName: ruleSetName,
      }).promise();

      await ses.deleteReceiptRuleSet({ RuleSetName: ruleSetName }).promise();
      return {
        PhysicalResourceId: event.PhysicalResourceId,
      };
  }
};
