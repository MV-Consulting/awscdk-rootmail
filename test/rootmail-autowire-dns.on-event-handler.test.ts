const spyGetParameter = jest.fn();
const spyPutParameter = jest.fn();
const spySSM = jest.fn(() => ({
  getParameter: spyGetParameter,
  putParameter: spyPutParameter,
}));
const spyListHostedZonesByName = jest.fn();
const spyListResourceRecordSets = jest.fn();
const spyChangeResourceRecordSets = jest.fn();
const spyRoute53 = jest.fn(() => ({
  listHostedZonesByName: spyListHostedZonesByName,
  listResourceRecordSets: spyListResourceRecordSets,
  changeResourceRecordSets: spyChangeResourceRecordSets,
}));

jest.mock('aws-sdk', () => ({
  SSM: spySSM,
  Route53: spyRoute53,
}));

// eslint-disable-next-line import/no-unresolved
import { OnEventRequest } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import { handler } from '../src/rootmail-autowire-dns.on-event-handler';

describe('wire-rootmail-dns', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('wire-dns-ns-records', async () => {
    spyGetParameter.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          Parameter: {
            Value: 'ns-1111.awsdns-00.co.uk,ns-2222.awsdns-00.co.uk,ns-3333.awsdns-00.de,ns-4444.awsdns-00.com',
          },
        });
      },
    }));

    spyListHostedZonesByName.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          HostedZones: [
            { Id: '/hostedzone/Z1234567890CC2' },
          ],
        });
      },
    }));

    spyListResourceRecordSets.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          ResourceRecordSets: [
            { Name: 'another.domain.com.', Type: 'NS' },
          ],
        });
      },
    }));

    spyChangeResourceRecordSets.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          ChangeInfo: { Status: 'PENDING' },
        });
      },
    }));

    spyPutParameter.mockImplementation(() => ({
      promise() {
        return Promise.resolve({});
      },
    }));


    await handler(
      {
        RequestType: 'Create',
        ResourceProperties: {
          Domain: 'superluminar.io',
          Subdomain: 'aws',
          HostedZoneParameterName: '/superwerker/dns_name_servers',
          R53ChangeInfoIdParameterName: '/superwerker/auto_wire_r53_changeinfo_id',
          ParentHostedZoneId: 'Z1234567890CC2',
        },
      } as unknown as OnEventRequest,
    );

    expect(spyGetParameter).toHaveBeenCalledTimes(1);
    expect(spyListHostedZonesByName).toHaveBeenCalledTimes(1);
    expect(spyListResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(spyChangeResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(spyPutParameter).toHaveBeenCalledTimes(1);
  });

  it('dns-ns-records-already-exist', async () => {
    spyGetParameter.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          Parameter: {
            Value: 'ns-1111.awsdns-00.co.uk,ns-2222.awsdns-00.co.uk,ns-3333.awsdns-00.de,ns-4444.awsdns-00.com',
          },
        });
      },
    }));

    spyListHostedZonesByName.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          HostedZones: [
            { Id: '/hostedzone/Z1234567890CC2' },
          ],
        });
      },
    }));

    spyListResourceRecordSets.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          ResourceRecordSets: [
            // record already exist
            { Name: 'aws.superluminar.io.', Type: 'NS' },
          ],
        });
      },
    }));

    await handler(
      {
        RequestType: 'Create',
        ResourceProperties: {
          Domain: 'superluminar.io',
          Subdomain: 'aws',
          HostedZoneParameterName: '/superwerker/dns_name_servers',
          R53ChangeInfoIdParameterName: '/superwerker/auto_wire_r53_changeinfo_id',
          ParentHostedZoneId: 'Z1234567890CC2',
        },
      } as unknown as OnEventRequest,
    );

    expect(spyGetParameter).toHaveBeenCalledTimes(1);
    expect(spyListHostedZonesByName).toHaveBeenCalledTimes(1);
    expect(spyListResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(spyChangeResourceRecordSets).not.toHaveBeenCalled();
    expect(spyPutParameter).not.toHaveBeenCalled();
  });
});