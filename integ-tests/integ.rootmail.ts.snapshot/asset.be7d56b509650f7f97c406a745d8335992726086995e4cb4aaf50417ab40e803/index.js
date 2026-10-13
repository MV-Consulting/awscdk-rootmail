"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/ses-receipt-ruleset-activation.on-event-handler.ts
var ses_receipt_ruleset_activation_on_event_handler_exports = {};
__export(ses_receipt_ruleset_activation_on_event_handler_exports, {
  FILTERED_EMAIL_SUBJECTS: () => FILTERED_EMAIL_SUBJECTS,
  PROP_DOMAIN: () => PROP_DOMAIN,
  PROP_EMAILBUCKET_NAME: () => PROP_EMAILBUCKET_NAME,
  PROP_OPS_SANTA_FUNCTION_ARN: () => PROP_OPS_SANTA_FUNCTION_ARN,
  PROP_RULESET_SETTLE_TIME_SECONDS: () => PROP_RULESET_SETTLE_TIME_SECONDS,
  PROP_SUBDOMAIN: () => PROP_SUBDOMAIN,
  handler: () => handler
});
module.exports = __toCommonJS(ses_receipt_ruleset_activation_on_event_handler_exports);
var import_client_ses = require("@aws-sdk/client-ses");
var PROP_DOMAIN = "Domain";
var PROP_SUBDOMAIN = "Subdomain";
var PROP_EMAILBUCKET_NAME = "EmailBucketName";
var PROP_OPS_SANTA_FUNCTION_ARN = "OpsSantaFunctionArn";
var PROP_RULESET_SETTLE_TIME_SECONDS = "RulesetSettleTimeSeconds";
var FILTERED_EMAIL_SUBJECTS = "FilteredEmailSubjects";
var ses = new import_client_ses.SES();
async function handler(event) {
  const domain = event.ResourceProperties[PROP_DOMAIN];
  const subdomain = event.ResourceProperties[PROP_SUBDOMAIN];
  const emailBucketName = event.ResourceProperties[PROP_EMAILBUCKET_NAME];
  const opsSantaFunctionArn = event.ResourceProperties[PROP_OPS_SANTA_FUNCTION_ARN];
  const logicalResourceId = event.LogicalResourceId;
  const ruleSetName = "RootMail";
  const ruleName = "Receive";
  const rootmailBucketObjectKeyPrefix = "RootMail";
  switch (event.RequestType) {
    case "Create":
      console.log(`${event.RequestType} SES ReceiptRuleSet. PhysicalResourceId: ${event.RequestId}`);
      await ses.createReceiptRuleSet({ RuleSetName: ruleSetName });
      await ses.createReceiptRule({
        RuleSetName: ruleSetName,
        Rule: {
          Name: ruleName,
          Enabled: true,
          TlsPolicy: "Require",
          ScanEnabled: true,
          Recipients: [`root@${subdomain}.${domain}`],
          Actions: [
            {
              S3Action: {
                BucketName: emailBucketName,
                ObjectKeyPrefix: rootmailBucketObjectKeyPrefix
              }
            },
            {
              LambdaAction: {
                FunctionArn: opsSantaFunctionArn
              }
            }
          ]
        }
      });
      console.log("Activating SES ReceiptRuleSet:", logicalResourceId);
      await ses.setActiveReceiptRuleSet({ RuleSetName: ruleSetName });
      return {
        PhysicalResourceId: event.RequestId
      };
    case "Update":
      console.log(`${event.RequestType} SES ReceiptRuleSet. PhysicalResourceId: ${event.PhysicalResourceId}`);
      return {
        PhysicalResourceId: event.PhysicalResourceId
      };
    case "Delete":
      console.log("Deactivating SES ReceiptRuleSet:", logicalResourceId);
      await ses.setActiveReceiptRuleSet({ RuleSetName: void 0 });
      await ses.deleteReceiptRule({
        RuleName: ruleName,
        RuleSetName: ruleSetName
      });
      await ses.deleteReceiptRuleSet({ RuleSetName: ruleSetName });
      return {
        PhysicalResourceId: event.PhysicalResourceId
      };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FILTERED_EMAIL_SUBJECTS,
  PROP_DOMAIN,
  PROP_EMAILBUCKET_NAME,
  PROP_OPS_SANTA_FUNCTION_ARN,
  PROP_RULESET_SETTLE_TIME_SECONDS,
  PROP_SUBDOMAIN,
  handler
});
