// eslint-disable-next-line import/no-unresolved
import * as AWSCDKAsyncCustomResource from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
export const PROP_DOMAIN = 'Domain';

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest): Promise<AWSCDKAsyncCustomResource.OnEventResponse> {
  switch (event.RequestType) {
    case 'Create':
      console.log('Creating DKIM propagation, doing nothing');
      return {
        PhysicalResourceId: event.PhysicalResourceId,
      };
    case 'Update':
      console.log('Updating DKIM propagation, doing nothing');
      return {};
    case 'Delete':
      console.log('Updating DKIM propagation, doing nothing');
      return {};
  }
}

