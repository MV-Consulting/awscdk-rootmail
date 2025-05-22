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

// asset-input/src/hosted-zone-dkim-propagation.on-event-handler.ts
var hosted_zone_dkim_propagation_on_event_handler_exports = {};
__export(hosted_zone_dkim_propagation_on_event_handler_exports, {
  PROP_DOMAIN: () => PROP_DOMAIN,
  handler: () => handler
});
module.exports = __toCommonJS(hosted_zone_dkim_propagation_on_event_handler_exports);
var PROP_DOMAIN = "Domain";
async function handler(event) {
  switch (event.RequestType) {
    case "Create":
      console.log(`${event.RequestType} DKIM propagation. PhysicalResourceId: ${event.RequestId}`);
      return {
        PhysicalResourceId: event.RequestId
      };
    case "Update":
    case "Delete":
      console.log(`${event.RequestType} DKIM propagation, doing nothing. PhysicalResourceId: ${event.PhysicalResourceId}`);
      return {
        PhysicalResourceId: event.PhysicalResourceId
      };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PROP_DOMAIN,
  handler
});
