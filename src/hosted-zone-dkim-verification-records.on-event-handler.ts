// eslint-disable-next-line import/no-unresolved
import * as AWSCDKAsyncCustomResource from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import * as AWS from 'aws-sdk';
export const PROP_DOMAIN = 'Domain';
export const ATTR_VERIFICATION_TOKEN = 'VerificationToken';
export const ATTR_DKIM_TOKENS = 'DkimTokens';

const SES = new AWS.SES();

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest): Promise<AWSCDKAsyncCustomResource.OnEventResponse> {
  const domain = event.ResourceProperties[PROP_DOMAIN];
  switch (event.RequestType) {
    case 'Create':
    case 'Update': // TODO check for double creation
      let physicalResourceId = event.PhysicalResourceId;
      if (event.RequestType === 'Create') {
        physicalResourceId = event.RequestId;
      }

      console.log(`${event.RequestType}: Do Domain verification and DKIM records for ${event.LogicalResourceId} and domain '${domain}' with PhysicalResourceId '${physicalResourceId}'`);
      const verifyDomainResponse = await SES.verifyDomainIdentity({ Domain: domain }).promise();
      const verificationToken = verifyDomainResponse.VerificationToken;
      console.log(`${event.RequestType}: Got verification token '${verificationToken}' for domain '${domain}'`);

      const verifyDomainDkimResponse = await SES.verifyDomainDkim({ Domain: domain }).promise();
      const dkimTokens = verifyDomainDkimResponse.DkimTokens;
      console.log(`${event.RequestType}: Got DKIM tokens '${dkimTokens}' for domain '${domain}'`);


      return {
        PhysicalResourceId: physicalResourceId,
        Data: {
          [ATTR_VERIFICATION_TOKEN]: verificationToken,
          [ATTR_DKIM_TOKENS]: dkimTokens,
        },
      };
    case 'Delete':
      console.log(`Deleting Domain identity for domain '${domain}' with PhysicalResourceId '${event.PhysicalResourceId}'`);
      const deleteResponse = await SES.deleteIdentity({ Identity: domain }).promise();
      console.log(`Deleted Domain identity for domain '${domain}'`, deleteResponse);
      return {
        PhysicalResourceId: event.PhysicalResourceId,
      };
  }
}

