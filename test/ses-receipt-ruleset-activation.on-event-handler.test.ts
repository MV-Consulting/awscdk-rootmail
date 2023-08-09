const spyCreateReceiptRuleSet = jest.fn();
const spyCreateReceiptRule = jest.fn();
const spySetActiveReceiptRuleSet = jest.fn();
const spyDeleteReceiptRule = jest.fn();
const spyDeleteReceiptRuleSet = jest.fn();
const spySES = jest.fn(() => ({
  createReceiptRuleSet: spyCreateReceiptRuleSet,
  createReceiptRule: spyCreateReceiptRule,
  setActiveReceiptRuleSet: spySetActiveReceiptRuleSet,
  deleteReceiptRule: spyDeleteReceiptRule,
  deleteReceiptRuleSet: spyDeleteReceiptRuleSet,
}));

jest.mock('aws-sdk', () => ({
  SES: spySES,
}));

// eslint-disable-next-line import/no-unresolved
import { OnEventRequest } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import { handler } from '../src/ses-receipt-ruleset-activation.on-event-handler';

describe('ses-receipt-ruleset-activation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('create-ses-receipt-ruleset-activation', async () => {
    spyCreateReceiptRuleSet.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      },
    }));

    spyCreateReceiptRule.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      },
    }));

    spySetActiveReceiptRuleSet.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      },
    }));

    await handler(
      {
        RequestType: 'Create',
        ResourceProperties: {
          Domain: 'superluminar.io',
          Subdomain: 'aws',
          EmailBucket: 'email-bucket',
          OpsSantaFunctionArn: 'func-arn',
        },
      } as unknown as OnEventRequest,
    );

    expect(spyCreateReceiptRuleSet).toHaveBeenCalledTimes(1);
    expect(spyCreateReceiptRule).toHaveBeenCalledTimes(1);
    expect(spySetActiveReceiptRuleSet).toHaveBeenCalledTimes(1);
  });

  it('update-ses-receipt-ruleset-activation', async () => {
    spyCreateReceiptRuleSet.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      },
    }));

    spyCreateReceiptRule.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      },
    }));

    spySetActiveReceiptRuleSet.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      },
    }));

    await handler(
      {
        RequestType: 'Update',
        ResourceProperties: {
          Domain: 'superluminar.io',
          Subdomain: 'aws',
          EmailBucket: 'email-bucket',
          OpsSantaFunctionArn: 'func-arn',
          RulesetSettleTimeSeconds: 1,
        },
      } as unknown as OnEventRequest,
    );

    expect(spyCreateReceiptRuleSet).toHaveBeenCalledTimes(1);
    expect(spyCreateReceiptRule).toHaveBeenCalledTimes(1);
    expect(spySetActiveReceiptRuleSet).toHaveBeenCalledTimes(1);
  });

  it('delete: ses receipt ruleset activation', async () => {
    spyDeleteReceiptRuleSet.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      },
    }));

    spyDeleteReceiptRule.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      },
    }));

    spySetActiveReceiptRuleSet.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      },
    }));

    await handler(
      {
        RequestType: 'Delete',
        ResourceProperties: {
          Domain: 'superluminar.io',
          Subdomain: 'aws',
          EmailBucket: 'email-bucket',
          OpsSantaFunctionArn: 'func-arn',
          RulesetSettleTimeSeconds: 1,
        },
      } as unknown as OnEventRequest,
    );

    expect(spySetActiveReceiptRuleSet).toHaveBeenCalledTimes(1);
    expect(spyDeleteReceiptRule).toHaveBeenCalledTimes(1);
    expect(spyDeleteReceiptRuleSet).toHaveBeenCalledTimes(1);
  });
});