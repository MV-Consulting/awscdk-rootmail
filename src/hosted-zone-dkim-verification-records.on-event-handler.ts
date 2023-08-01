// eslint-disable-next-line import/no-unresolved
import * as AWSCDKAsyncCustomResource from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import * as AWS from 'aws-sdk';
export const PROP_DOMAIN = 'Domain';
export const ATTR_VERIFICATION_TOKEN = 'VerificationToken';
export const ATTR_DKIM_TOKENS = 'DkimTokens';

// this is fixed to eu-west-1 until SES supports receive more globally (see #23)
const SES = new AWS.SES({ region: 'eu-west-1' });

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest): Promise<AWSCDKAsyncCustomResource.OnEventResponse> {
  switch (event.RequestType) {
    case 'Create':
      const domain = event.ResourceProperties[PROP_DOMAIN];
      console.log(`Do Domain verification and DKIM records for ${event.LogicalResourceId} and domain '${domain}'`);
      const verifyDomainResponse = await SES.verifyDomainIdentity({ Domain: domain }).promise();
      const verificationToken = verifyDomainResponse.VerificationToken;

      const verifyDomainDkimResponse = await SES.verifyDomainDkim({ Domain: domain }).promise();
      const dkimTokens = verifyDomainDkimResponse.DkimTokens;

      return {
        PhysicalResourceId: event.PhysicalResourceId,
        Data: {
          [ATTR_VERIFICATION_TOKEN]: verificationToken,
          [ATTR_DKIM_TOKENS]: dkimTokens,
        },
      };
    case 'Update':
    case 'Delete':
      console.log('Updating/Deleting DKIM verification, doing nothing');
      return {};
  }
}

