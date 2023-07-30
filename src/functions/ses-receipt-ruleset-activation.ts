// eslint-disable-next-line import/no-unresolved
import * as AWSCDKAsyncCustomResource from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import * as AWS from 'aws-sdk';

const ses = new AWS.SES();

export async function handler(
  event: AWSCDKAsyncCustomResource.OnEventRequest): Promise<void> {
  const Properties = event.ResourceProperties;
  const LogicalResourceId = event.LogicalResourceId;
  const Domain = Properties.Domain;
  const Subdomain = Properties.Subdomain;
  const EmailBucket = Properties.EmailBucket;
  const OpsSantaFunctionArn = Properties.OpsSantaFunctionArn;

  const ruleSetName = 'RootMail';
  const ruleName = 'Receive';

  switch (event.RequestType) {
    case 'Create' || 'Update':
      await ses.createReceiptRuleSet({ RuleSetName: ruleSetName }).promise();

      await ses.createReceiptRule({
        RuleSetName: ruleSetName,
        Rule: {
          Name: ruleName,
          Enabled: true,
          TlsPolicy: 'Require',
          ScanEnabled: true,
          Recipients: [`'root@${Subdomain}.${Domain}'`],
          Actions: [
            {
              S3Action: {
                BucketName: `'${EmailBucket}'`,
                ObjectKeyPrefix: 'RootMail',
              },
            },
            {
              LambdaAction: {
                FunctionArn: `'${OpsSantaFunctionArn}'`,
              },
            },
          ],
        },
      })
        .promise();

      console.log('Activating SES ReceiptRuleSet:', LogicalResourceId);

      await ses.setActiveReceiptRuleSet({ RuleSetName: ruleSetName }).promise();
      break;

    case 'Delete':
      console.log('Deactivating SES ReceiptRuleSet:', LogicalResourceId);

      await ses.setActiveReceiptRuleSet().promise();

      await ses.deleteReceiptRule({
        RuleName: ruleName,
        RuleSetName: ruleSetName,
      }).promise();

      await ses.deleteReceiptRuleSet({ RuleSetName: ruleSetName }).promise();
  }
};
