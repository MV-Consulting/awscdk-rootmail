import fs from 'fs';
import path from 'path';
import jsonfile from 'jsonfile';

const spyGetObject = jest.fn();
const spyS3 = jest.fn(() => ({
  getObject: spyGetObject,
}));
const spyPutParameter = jest.fn();
const spyCreateOpsItem = jest.fn();
const spySSM = jest.fn(() => ({
  putParameter: spyPutParameter,
  createOpsItem: spyCreateOpsItem,
}));

jest.mock('aws-sdk', () => ({
  S3: spyS3,
  SSM: spySSM,
}));

// eslint-disable-next-line import/no-unresolved
import { SESEventRecordsToLambda, handler } from '../src/ses-receive.ops-santa-handler';

describe('ops santa', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('parse password reset mail', async () => {
    const sesPasswordResetEvent = jsonfile.readFileSync(path.join(__dirname, 'fixtures', 'password-reset-ses-event.json'), { encoding: 'utf-8' }) as SESEventRecordsToLambda;

    spyGetObject.mockImplementation(() => ({
      promise() {
        const email = fs.readFileSync(path.join(__dirname, 'fixtures', 'password-reset-mail.txt'), { encoding: 'utf-8' });
        return Promise.resolve({ Body: email });
      },
    }));

    spyPutParameter.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      },
    }));

    spyCreateOpsItem.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      },
    }));

    await handler(sesPasswordResetEvent);

    expect(spyGetObject).toHaveBeenCalledTimes(1);
    expect(spyPutParameter).toHaveBeenCalledTimes(1);
    expect(spyCreateOpsItem).not.toHaveBeenCalled(); // no ops item for now
  });

  it('filter account ready mail', async () => {
    const sesAccountReadyEvent = jsonfile.readFileSync(path.join(__dirname, 'fixtures', 'account-ready-ses-event.json'), { encoding: 'utf-8' }) as SESEventRecordsToLambda;

    spyGetObject.mockImplementation(() => ({
      promise() {
        const email = fs.readFileSync(path.join(__dirname, 'fixtures', 'account-ready-mail.txt'), { encoding: 'utf-8' });
        return Promise.resolve({ Body: email });
      },
    }));

    await handler(sesAccountReadyEvent);

    expect(spyGetObject).toHaveBeenCalledTimes(1);
    expect(spyPutParameter).not.toHaveBeenCalled();
    expect(spyCreateOpsItem).not.toHaveBeenCalled();
  });

});