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

jest.mock('@aws-sdk/client-s3', () => ({
  S3: spyS3,
}));

jest.mock('@aws-sdk/client-ssm', () => ({
  SSM: spySSM,
}));

// eslint-disable-next-line import/no-unresolved
import { SESEventRecordsToLambda, handler } from '../src/ses-receive.ops-santa-handler';

describe('ops-santa', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('parse-password-reset-mail', async () => {
    const sesPasswordResetEvent = jsonfile.readFileSync(path.join(__dirname, 'fixtures', 'password-reset-ses-event.json'), { encoding: 'utf-8' }) as SESEventRecordsToLambda;

    const email = fs.readFileSync(path.join(__dirname, 'fixtures', 'password-reset-mail.txt'), { encoding: 'utf-8' });
    spyGetObject.mockImplementation(() => ({
      Body: email,
    }));

    spyPutParameter.mockImplementation(() => ({}));

    spyCreateOpsItem.mockImplementation(() => ({}));

    await handler(sesPasswordResetEvent);

    expect(spyGetObject).toHaveBeenCalledTimes(1);
    expect(spyPutParameter).toHaveBeenCalledTimes(1);
    expect(spyCreateOpsItem).not.toHaveBeenCalled(); // no ops item for now
  });

  it('filter-account-ready-mail', async () => {
    const sesAccountReadyEvent = jsonfile.readFileSync(path.join(__dirname, 'fixtures', 'account-ready-ses-event.json'), { encoding: 'utf-8' }) as SESEventRecordsToLambda;

    const email = fs.readFileSync(path.join(__dirname, 'fixtures', 'account-ready-mail.txt'), { encoding: 'utf-8' });
    spyGetObject.mockImplementation(() => ({
      Body: email,
    }));

    await handler(sesAccountReadyEvent);

    expect(spyGetObject).toHaveBeenCalledTimes(1);
    expect(spyPutParameter).not.toHaveBeenCalled();
    expect(spyCreateOpsItem).not.toHaveBeenCalled();
  });

  it('filter-custom-title', async () => {
    // Config Rules Compliance Change
    const sesAccountReadyEvent = jsonfile.readFileSync(path.join(__dirname, 'fixtures', 'filtered-title-ses-event.json'), { encoding: 'utf-8' }) as SESEventRecordsToLambda;

    const email = fs.readFileSync(path.join(__dirname, 'fixtures', 'filtered-title-mail.txt'), { encoding: 'utf-8' });
    spyGetObject.mockImplementation(() => ({
      Body: email,
    }));

    process.env.FILTERED_EMAIL_SUBJECTS = 'Config Rules Compliance Change';
    await handler(sesAccountReadyEvent);

    expect(process.env.FILTERED_EMAIL_SUBJECTS).toBe('Config Rules Compliance Change');
    expect(spyGetObject).toHaveBeenCalledTimes(1);
    expect(spyPutParameter).not.toHaveBeenCalled();
    expect(spyCreateOpsItem).not.toHaveBeenCalled();
    process.env.FILTERED_EMAIL_SUBJECTS = '';
  });

  it('spam-verdict-fail', async () => {
    const sesAccountSpamVerdictFailedEvent = jsonfile.readFileSync(path.join(__dirname, 'fixtures', 'spam-verdict-failed-ses-event.json'), { encoding: 'utf-8' }) as SESEventRecordsToLambda;

    // return, aka do nothing
    await handler(sesAccountSpamVerdictFailedEvent);

    expect(spyGetObject).not.toHaveBeenCalled();
    expect(spyPutParameter).not.toHaveBeenCalled();
    expect(spyCreateOpsItem).not.toHaveBeenCalled();
  });

  it('empty-subject-mail', async () => {
    const sesAccountReadyEvent = jsonfile.readFileSync(path.join(__dirname, 'fixtures', 'empty-subject-ses-event.json'), { encoding: 'utf-8' }) as SESEventRecordsToLambda;

    const email = fs.readFileSync(path.join(__dirname, 'fixtures', 'empty-subject-mail.txt'), { encoding: 'utf-8' });
    spyGetObject.mockImplementation(() => ({
      Body: email,
    }));

    await handler(sesAccountReadyEvent);

    expect(spyGetObject).toHaveBeenCalledTimes(1);
    expect(spyPutParameter).not.toHaveBeenCalled();
    expect(spyCreateOpsItem).not.toHaveBeenCalled();
  });

  it('create-ops-items-mail', async () => {
    const sesAccountReadyEvent = jsonfile.readFileSync(path.join(__dirname, 'fixtures', 'ops-item-ses-event.json'), { encoding: 'utf-8' }) as SESEventRecordsToLambda;

    const email = fs.readFileSync(path.join(__dirname, 'fixtures', 'ops-item-mail.txt'), { encoding: 'utf-8' });
    spyGetObject.mockImplementation(() => ({
      Body: email,
    }));

    await handler(sesAccountReadyEvent);

    expect(spyGetObject).toHaveBeenCalledTimes(1);
    expect(spyPutParameter).not.toHaveBeenCalled();
    expect(spyCreateOpsItem).toHaveBeenCalledTimes(1);
  });

});