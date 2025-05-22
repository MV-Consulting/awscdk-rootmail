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

// asset-input/src/ses-receipt-ruleset-activation.is-complete-handler.ts
var ses_receipt_ruleset_activation_is_complete_handler_exports = {};
__export(ses_receipt_ruleset_activation_is_complete_handler_exports, {
  PROP_EMAILBUCKET_NAME: () => PROP_EMAILBUCKET_NAME,
  handler: () => handler
});
module.exports = __toCommonJS(ses_receipt_ruleset_activation_is_complete_handler_exports);
var import_client_s3 = require("@aws-sdk/client-s3");
var PROP_EMAILBUCKET_NAME = "EmailBucketName";
var fileKey = "RootMail/AMAZON_SES_SETUP_NOTIFICATION";
var s3 = new import_client_s3.S3();
async function handler(event) {
  const emailBucketName = event.ResourceProperties[PROP_EMAILBUCKET_NAME];
  switch (event.RequestType) {
    case "Create":
      console.log(`Testing if '${fileKey}' file is present in the S3 bucket: ${emailBucketName}`);
      const result = await s3.headObject({
        Bucket: emailBucketName,
        Key: fileKey
      });
      if (result.$metadata.httpStatusCode === 404) {
        console.log(`File ${fileKey} NOT found. IsComplete: false`);
        return {
          IsComplete: false
        };
      }
      console.log(`File ${fileKey} found. SES setup complete. Proceeding`);
      return {
        IsComplete: true
      };
    case "Update":
    case "Delete":
      return {
        IsComplete: true
      };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PROP_EMAILBUCKET_NAME,
  handler
});
