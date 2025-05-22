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

// asset-input/src/hosted-zone-dkim-verification-records.on-event-handler.ts
var hosted_zone_dkim_verification_records_on_event_handler_exports = {};
__export(hosted_zone_dkim_verification_records_on_event_handler_exports, {
  ATTR_DKIM_TOKENS: () => ATTR_DKIM_TOKENS,
  ATTR_VERIFICATION_TOKEN: () => ATTR_VERIFICATION_TOKEN,
  PROP_DOMAIN: () => PROP_DOMAIN,
  handler: () => handler
});
module.exports = __toCommonJS(hosted_zone_dkim_verification_records_on_event_handler_exports);
var import_client_ses = require("@aws-sdk/client-ses");
var PROP_DOMAIN = "Domain";
var ATTR_VERIFICATION_TOKEN = "VerificationToken";
var ATTR_DKIM_TOKENS = "DkimTokens";
var ses = new import_client_ses.SES();
async function handler(event) {
  const domain = event.ResourceProperties[PROP_DOMAIN];
  switch (event.RequestType) {
    case "Create":
    case "Update":
      let physicalResourceId = event.PhysicalResourceId;
      if (event.RequestType === "Create") {
        physicalResourceId = event.RequestId;
      }
      console.log(`${event.RequestType}: Do Domain verification and DKIM records for ${event.LogicalResourceId} and domain '${domain}' with PhysicalResourceId '${physicalResourceId}'`);
      const verifyDomainResponse = await ses.verifyDomainIdentity({ Domain: domain });
      const verificationToken = verifyDomainResponse.VerificationToken;
      console.log(`${event.RequestType}: Got verification token '${verificationToken}' for domain '${domain}'`);
      const verifyDomainDkimResponse = await ses.verifyDomainDkim({ Domain: domain });
      const dkimTokens = verifyDomainDkimResponse.DkimTokens;
      console.log(`${event.RequestType}: Got DKIM tokens '${dkimTokens}' for domain '${domain}'`);
      return {
        PhysicalResourceId: physicalResourceId,
        Data: {
          [ATTR_VERIFICATION_TOKEN]: verificationToken,
          [ATTR_DKIM_TOKENS]: dkimTokens
        }
      };
    case "Delete":
      console.log(`Deleting Domain identity for domain '${domain}' with PhysicalResourceId '${event.PhysicalResourceId}'`);
      const deleteResponse = await ses.deleteIdentity({ Identity: domain });
      console.log(`Deleted Domain identity for domain '${domain}'`, deleteResponse);
      return {
        PhysicalResourceId: event.PhysicalResourceId
      };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ATTR_DKIM_TOKENS,
  ATTR_VERIFICATION_TOKEN,
  PROP_DOMAIN,
  handler
});
