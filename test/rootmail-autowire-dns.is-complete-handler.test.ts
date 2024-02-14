const spyGetParameter = jest.fn();
const spySSM = jest.fn(() => ({
  getParameter: spyGetParameter,
}));
const spyWaitUntilResourceRecordSetsChanged = jest.fn();
const spyRoute53 = jest.fn(() => ({}));

jest.mock('@aws-sdk/client-ssm', () => ({
  SSM: spySSM,
}));

jest.mock('@aws-sdk/client-route-53', () => ({
  Route53: spyRoute53,
  waitUntilResourceRecordSetsChanged: spyWaitUntilResourceRecordSetsChanged,
}));

// eslint-disable-next-line import/no-unresolved
import { OnEventRequest } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import { handler } from '../src/rootmail-autowire-dns.is-complete-handler';

describe('wire-rootmail-dns-completion', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('dns-records-in-sync', async () => {
    spyGetParameter.mockImplementation(() => ({
      Parameter: {
        Value: 'uuid-123',
      },
    }));

    spyWaitUntilResourceRecordSetsChanged.mockImplementation(() => ({
      state: 'SUCCESS',
    }));


    await handler(
      {
        RequestType: 'Create',
        ResourceProperties: {
          Domain: 'manuel-vogel.de',
          Subdomain: 'aws',
          HostedZoneParameterName: '/rootmail/dns_name_servers',
          R53ChangeInfoIdParameterName: '/rootmail/auto_wire_r53_changeinfo_id',
          ParentHostedZoneId: 'Z1234567890CC2',
        },
      } as unknown as OnEventRequest,
    );

    expect(spyGetParameter).toHaveBeenCalledTimes(1);
    expect(spyWaitUntilResourceRecordSetsChanged).toHaveBeenCalledTimes(1);
  });
});