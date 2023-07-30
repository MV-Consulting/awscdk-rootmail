const putSpy = jest.fn();

jest.mock('axios', () => ({
  put: putSpy,
}));

// eslint-disable-next-line import/no-unresolved
import { handler } from '../../src/functions/root-mail-ready-trigger';

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

  it('root-mail is ready trigger', async () => {
    await handler();
    expect(putSpy).toHaveBeenCalledTimes(1);
  });
});