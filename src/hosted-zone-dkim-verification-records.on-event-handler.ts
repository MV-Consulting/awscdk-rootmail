// eslint-disable-next-line import/no-unresolved
import * as AWSCDKAsyncCustomResource from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import * as AWS from 'aws-sdk';
export const PROP_DOMAIN = 'Domain';
export const ATTR_VERIFICATION_TOKEN = 'VerificationToken';
export const ATTR_DKIM_TOKENS = 'DkimTokens';

// this is fixed to eu-west-1 until SES supports receive more globally (see #23)
const SES = new AWS.SES({ region: 'eu-west-1' });

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest): Promise<AWSCDKAsyncCustomResource.OnEventResponse> {
  const domain = event.ResourceProperties[PROP_DOMAIN];
  switch (event.RequestType) {
    case 'Create':
      console.log(`Do Domain verification and DKIM records for ${event.LogicalResourceId} and domain '${domain}'`);
      const verifyDomainResponse = await SES.verifyDomainIdentity({ Domain: domain }).promise();
      const verificationToken = verifyDomainResponse.VerificationToken;
      console.log(`Got verification token '${verificationToken}' for domain '${domain}'`);

      const verifyDomainDkimResponse = await SES.verifyDomainDkim({ Domain: domain }).promise();
      const dkimTokens = verifyDomainDkimResponse.DkimTokens;
      console.log(`Got DKIM tokens '${dkimTokens}' for domain '${domain}'`);

      return {
        PhysicalResourceId: event.PhysicalResourceId,
        Data: {
          [ATTR_VERIFICATION_TOKEN]: verificationToken,
          [ATTR_DKIM_TOKENS]: dkimTokens,
        },
      };
    case 'Update':
      console.log('Updating DKIM verification, doing nothing');
      return {};
    case 'Delete':
      console.log(`Deleting Domain identity for domain '${domain}'`);
      const deleteResponse = await SES.deleteIdentity({ Identity: domain }).promise();
      console.log(`Deleted Domain identity for domain '${domain}'`, deleteResponse);
      return {};
  }
}

