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

// asset-input/src/rootmail-autowire-dns.is-complete-handler.ts
var rootmail_autowire_dns_is_complete_handler_exports = {};
__export(rootmail_autowire_dns_is_complete_handler_exports, {
  PROP_DOMAIN: () => PROP_DOMAIN,
  PROP_PARENT_HOSTED_ZONE_ID: () => PROP_PARENT_HOSTED_ZONE_ID,
  PROP_R53_HANGEINFO_ID_PARAMETER_NAME: () => PROP_R53_HANGEINFO_ID_PARAMETER_NAME,
  PROP_SUB_DOMAIN: () => PROP_SUB_DOMAIN,
  handler: () => handler
});
module.exports = __toCommonJS(rootmail_autowire_dns_is_complete_handler_exports);
var import_client_route_53 = require("@aws-sdk/client-route-53");
var import_client_ssm = require("@aws-sdk/client-ssm");
var PROP_DOMAIN = "Domain";
var PROP_SUB_DOMAIN = "Subdomain";
var PROP_R53_HANGEINFO_ID_PARAMETER_NAME = "R53ChangeInfoIdParameterName";
var PROP_PARENT_HOSTED_ZONE_ID = "ParentHostedZoneId";
var route53 = new import_client_route_53.Route53();
var ssm = new import_client_ssm.SSM();
async function handler(event) {
  const domain = event.ResourceProperties[PROP_DOMAIN];
  const subdomain = event.ResourceProperties[PROP_SUB_DOMAIN];
  const hostedZoneParameterName = event.ResourceProperties[PROP_R53_HANGEINFO_ID_PARAMETER_NAME];
  const parentHostedZoneId = event.ResourceProperties[PROP_PARENT_HOSTED_ZONE_ID];
  if (parentHostedZoneId === void 0 || parentHostedZoneId === "") {
    log(`Skipping autoDNS wiring on '${event.RequestType}' for domain '${subdomain}.${domain}' as no parentHostedZoneId is given!`);
    return {
      IsComplete: true
    };
  }
  const recordSetCreationResponseChangeInfoIdParam = await ssm.getParameter({
    Name: hostedZoneParameterName
  });
  const recordSetCreationResponseChangeInfoId = recordSetCreationResponseChangeInfoIdParam.Parameter?.Value;
  log(`got R53 change info id: ${recordSetCreationResponseChangeInfoId} for event type ${event.RequestType}`);
  log({
    msg: "event",
    event
  });
  switch (event.RequestType) {
    case "Create":
      log("waiting for DNS to propagate");
      try {
        const res = await (0, import_client_route_53.waitUntilResourceRecordSetsChanged)({
          client: route53,
          minDelay: 2,
          maxWaitTime: 4
        }, {
          Id: recordSetCreationResponseChangeInfoId
        });
        switch (res.state) {
          case "SUCCESS":
            log(`DNS propagated with status '${res.state}'`);
            return { IsComplete: true };
          case "RETRY":
            log(`DNS propagation not in sync yet. Has status '${res.state}'`);
            return { IsComplete: false };
          case "ABORTED":
          case "FAILURE":
          case "TIMEOUT":
            log(`DNS propagation state failed '${res.state}'`);
            return { IsComplete: false };
          default:
            log(`DNS propagation state unknow '${res.state}'`);
            return { IsComplete: false };
        }
      } catch (e) {
        log(`DNS propagation errored. Has message ${e}`);
        return { IsComplete: false };
      }
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PROP_DOMAIN,
  PROP_PARENT_HOSTED_ZONE_ID,
  PROP_R53_HANGEINFO_ID_PARAMETER_NAME,
  PROP_SUB_DOMAIN,
  handler
});
