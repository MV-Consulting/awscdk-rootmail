const spyGetAccountSendingEnabled = jest.fn();
const spyGetIdentityVerificationAttributes = jest.fn();
const spygGetIdentityDkimAttributes = jest.fn();
const spyGetIdentityNotificationAttributes = jest.fn();
const spySES = jest.fn(() => ({
  getAccountSendingEnabled: spyGetAccountSendingEnabled,
  getIdentityVerificationAttributes: spyGetIdentityVerificationAttributes,
  getIdentityDkimAttributes: spygGetIdentityDkimAttributes,
  getIdentityNotificationAttributes: spyGetIdentityNotificationAttributes,
}));

jest.mock('aws-sdk', () => ({
  SES: spySES,
}));

// eslint-disable-next-line import/no-unresolved
import { handler } from '../src/rootmail.ready-handler';

describe('root-mail-ready', () => {
  const originalEnvironment = process.env;
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnvironment };
    process.env.SUB_DOMAIN = 'subdomain';
    process.env.DOMAIN = 'domain.com';
  });

  afterEach(() => {
    // restore the original env after each test
    process.env = originalEnvironment;
  });

  it('root-mail is ready', async () => {
    const domain = `${process.env.SUB_DOMAIN}.${process.env.DOMAIN}`;
    spyGetAccountSendingEnabled.mockImplementation(() => ({
      promise() {
        return Promise.resolve({ Enabled: true });
      },
    }));

    spyGetIdentityVerificationAttributes.mockImplementation(() => ({
      promise() {
        return Promise.resolve({ VerificationAttributes: { [domain]: { VerificationStatus: 'Success' } } });
      },
    }));

    spygGetIdentityDkimAttributes.mockImplementation(() => ({
      promise() {
        return Promise.resolve({ DkimAttributes: { [domain]: { DkimVerificationStatus: 'Success' } } });
      },
    }));

    spyGetIdentityNotificationAttributes.mockImplementation(() => ({
      promise() {
        return Promise.resolve({ NotificationAttributes: { [domain]: { ForwardingEnabled: true } } });
      },
    }));

    await handler(
      {
        foo: 'bar',
      }, {},
    );

    expect(spyGetAccountSendingEnabled).toHaveBeenCalledTimes(1);
    expect(spyGetIdentityVerificationAttributes).toHaveBeenCalledTimes(1);
    expect(spygGetIdentityDkimAttributes).toHaveBeenCalledTimes(1);
    expect(spyGetIdentityNotificationAttributes).toHaveBeenCalledTimes(1);
  });
});