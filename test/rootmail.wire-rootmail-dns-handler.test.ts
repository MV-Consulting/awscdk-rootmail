const spyGetParameter = jest.fn();
const spySSM = jest.fn(() => ({
  getParameter: spyGetParameter,
}));
const spyListHostedZonesByName = jest.fn();
const spyListResourceRecordSets = jest.fn();
const spyChangeResourceRecordSets = jest.fn();
const spyWaitFor = jest.fn();
const spyRoute53 = jest.fn(() => ({
  listHostedZonesByName: spyListHostedZonesByName,
  listResourceRecordSets: spyListResourceRecordSets,
  changeResourceRecordSets: spyChangeResourceRecordSets,
  waitFor: spyWaitFor,
}));

jest.mock('aws-sdk', () => ({
  SSM: spySSM,
  Route53: spyRoute53,
}));

// eslint-disable-next-line import/no-unresolved
import { handler } from '../src/rootmail.wire-rootmail-dns-handler';

describe('wire rootmail dns', () => {
  const originalEnvironment = process.env;
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnvironment };
    process.env.SUB_DOMAIN = 'subdomain';
    process.env.DOMAIN = 'domain.com';
    process.env.HOSTED_ZONE_PARAMETER_NAME = '/superwerker/dns_name_servers';
  });

  afterEach(() => {
    // restore the original env after each test
    process.env = originalEnvironment;
  });

  it('wire dns ns records', async () => {
    const hostedZoneId = 'HZ1234567890';
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
            { Id: hostedZoneId },
          ],
        });
      },
    }));

    spyListResourceRecordSets.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          ResourceRecordSets: [
            { Name: 'another.domain.com', Type: 'NS' },
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

    spyWaitFor.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          ChangeInfo: { Status: 'INSYNC' },
        });
      },
    }));


    await handler();

    expect(spyGetParameter).toHaveBeenCalledTimes(1);
    expect(spyListHostedZonesByName).toHaveBeenCalledTimes(1);
    expect(spyListResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(spyChangeResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(spyWaitFor).toHaveBeenCalledTimes(1);
  });

  it('dns ns records already exist', async () => {
    const hostedZoneId = 'HZ1234567890';
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
            { Id: hostedZoneId },
          ],
        });
      },
    }));

    spyListResourceRecordSets.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          ResourceRecordSets: [
            // record already exist
            { Name: `${process.env.SUB_DOMAIN}.${process.env.DOMAIN}`, Type: 'NS' },
          ],
        });
      },
    }));

    await handler();

    expect(spyGetParameter).toHaveBeenCalledTimes(1);
    expect(spyListHostedZonesByName).toHaveBeenCalledTimes(1);
    expect(spyListResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(spyChangeResourceRecordSets).not.toHaveBeenCalled();
    expect(spyWaitFor).not.toHaveBeenCalled();
  });
});