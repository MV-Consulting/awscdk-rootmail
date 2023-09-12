const spyGetParameter = jest.fn();
const spySSM = jest.fn(() => ({
  getParameter: spyGetParameter,
}));
const spyWaitFor = jest.fn();
const spyRoute53 = jest.fn(() => ({
  waitFor: spyWaitFor,
}));

jest.mock('aws-sdk', () => ({
  SSM: spySSM,
  Route53: spyRoute53,
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
      promise() {
        return Promise.resolve({
          Parameter: {
            Value: 'uuid-123',
          },
        });
      },
    }));

    spyWaitFor.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          ChangeInfo: { Status: 'INSYNC' },
        });
      },
    }));


    await handler(
      {
        RequestType: 'Create',
        ResourceProperties: {
          Domain: 'manuel-vogel.de',
          Subdomain: 'aws',
          HostedZoneParameterName: '/superwerker/dns_name_servers',
          R53ChangeInfoIdParameterName: '/superwerker/auto_wire_r53_changeinfo_id',
          ParentHostedZoneId: 'Z1234567890CC2',
        },
      } as unknown as OnEventRequest,
    );

    expect(spyGetParameter).toHaveBeenCalledTimes(1);
    expect(spyWaitFor).toHaveBeenCalledTimes(1);
  });
});