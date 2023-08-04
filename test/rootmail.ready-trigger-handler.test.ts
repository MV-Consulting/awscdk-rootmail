const putSpy = jest.fn();
jest.mock('axios', () => ({
  put: putSpy,
}));

const spyDisableRule = jest.fn();
const spyCloudWatchEvents = jest.fn(() => ({
  disableRule: spyDisableRule,
}));
jest.mock('aws-sdk', () => ({
  CloudWatchEvents: spyCloudWatchEvents,
}));

// eslint-disable-next-line import/no-unresolved
import { handler } from '../src/rootmail.ready-trigger-handler';

describe('root-mail-ready-trigger', () => {
  const originalEnvironment = process.env;
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnvironment };
    process.env.SIGNAL_URL = 'https://dummy-signal-url.com';
  });

  afterEach(() => {
    // restore the original env after each test
    process.env = originalEnvironment;
  });

  it('root-mail is ready trigger with autoWire enabled', async () => {
    process.env.ROOTMAIL_READY_EVENTRULE_ARN = 'event-rule-arn1';
    process.env.AUTOWIRE_DNS_EVENTRULE_ARN = 'event-rule-arn2';

    spyDisableRule.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          $response: {
            error: undefined,
          },
        });
      },
    }));

    await handler();
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(spyDisableRule).toHaveBeenCalledTimes(2);
  });

  it('root-mail is ready trigger with autoWire disabled', async () => {
    process.env.ROOTMAIL_READY_EVENTRULE_ARN = 'event-rule-arn1';
    process.env.AUTOWIRE_DNS_EVENTRULE_ARN = ''; // empty for disabled

    spyDisableRule.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          $response: {
            error: undefined,
          },
        });
      },
    }));

    await handler();
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(spyDisableRule).toHaveBeenCalledTimes(1);
  });
});