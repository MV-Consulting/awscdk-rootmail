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

// src/hosted-zone-dkim-propagation.is-complete-handler.ts
var hosted_zone_dkim_propagation_is_complete_handler_exports = {};
__export(hosted_zone_dkim_propagation_is_complete_handler_exports, {
  PROP_DOMAIN: () => PROP_DOMAIN,
  handler: () => handler
});
module.exports = __toCommonJS(hosted_zone_dkim_propagation_is_complete_handler_exports);
var import_client_ses = require("@aws-sdk/client-ses");
var PROP_DOMAIN = "Domain";
var ses = new import_client_ses.SES();
async function handler(event) {
  const domain = event.ResourceProperties[PROP_DOMAIN];
  switch (event.RequestType) {
    case "Create":
      const isReady = await internalHandler(domain);
      return { IsComplete: isReady };
    case "Update":
    case "Delete":
      return {
        IsComplete: true
      };
  }
}
function log(msg) {
  console.log(JSON.stringify(msg));
}
async function internalHandler(domain) {
  log({
    domain,
    level: "debug"
  });
  const sendingResponse = await ses.getAccountSendingEnabled({});
  if (!sendingResponse.Enabled) {
    return false;
  }
  log("sending enabled");
  const identityVerificationResponse = await ses.getIdentityVerificationAttributes({ Identities: [domain] });
  const identityVerificationStatus = identityVerificationResponse.VerificationAttributes[domain].VerificationStatus;
  if (identityVerificationStatus !== "Success") {
    log(`Identity Verification status not successful. Was '${identityVerificationStatus}'`);
    return false;
  }
  log("identitity verification successful");
  const identityDkimRes = await ses.getIdentityDkimAttributes({ Identities: [domain] });
  const identityDkimStatus = identityDkimRes.DkimAttributes[domain].DkimVerificationStatus;
  if (identityDkimStatus !== "Success") {
    log(`DKIM status not successful. Was '${identityDkimStatus}'`);
    return false;
  }
  log("DKIM verification successful");
  const identityNotificationRes = await ses.getIdentityNotificationAttributes({ Identities: [domain] });
  const forwardingEnabled = identityNotificationRes.NotificationAttributes[domain].ForwardingEnabled;
  if (!forwardingEnabled) {
    log(`Forwarding not enabled. Was '${forwardingEnabled}'`);
    return false;
  }
  log("forwarding enabled");
  return true;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PROP_DOMAIN,
  handler
});
