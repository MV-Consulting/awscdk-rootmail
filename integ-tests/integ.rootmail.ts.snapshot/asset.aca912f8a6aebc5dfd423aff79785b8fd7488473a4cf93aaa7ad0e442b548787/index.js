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

// asset-input/src/rootmail-autowire-dns.on-event-handler.ts
var rootmail_autowire_dns_on_event_handler_exports = {};
__export(rootmail_autowire_dns_on_event_handler_exports, {
  PROP_DOMAIN: () => PROP_DOMAIN,
  PROP_HOSTED_ZONE_PARAMETER_NAME: () => PROP_HOSTED_ZONE_PARAMETER_NAME,
  PROP_PARENT_HOSTED_ZONE_ID: () => PROP_PARENT_HOSTED_ZONE_ID,
  PROP_R53_CHANGEINFO_ID_PARAMETER_NAME: () => PROP_R53_CHANGEINFO_ID_PARAMETER_NAME,
  PROP_SUB_DOMAIN: () => PROP_SUB_DOMAIN,
  handler: () => handler
});
module.exports = __toCommonJS(rootmail_autowire_dns_on_event_handler_exports);
var import_client_route_53 = require("@aws-sdk/client-route-53");
var import_client_ssm = require("@aws-sdk/client-ssm");
var PROP_DOMAIN = "Domain";
var PROP_SUB_DOMAIN = "Subdomain";
var PROP_PARENT_HOSTED_ZONE_ID = "ParentHostedZoneId";
var PROP_HOSTED_ZONE_PARAMETER_NAME = "HostedZoneParameterName";
var PROP_R53_CHANGEINFO_ID_PARAMETER_NAME = "R53ChangeInfoIdParameterName";
var route53 = new import_client_route_53.Route53();
var ssm = new import_client_ssm.SSM();
async function handler(event) {
  const domain = event.ResourceProperties[PROP_DOMAIN];
  const parentHostedZoneId = event.ResourceProperties[PROP_PARENT_HOSTED_ZONE_ID];
  if (parentHostedZoneId === void 0 || parentHostedZoneId.trim().length === 0) {
    switch (event.RequestType) {
      case "Create":
        log(`${event.RequestType}: Autowire DNS is disabled for '${domain}'. Skipping. PhysicalResourceId: ${event.RequestId}`);
        return {
          PhysicalResourceId: event.RequestId
        };
      case "Update":
      case "Delete":
        log(`${event.RequestType}: Autowire DNS is disabled for '${domain}'. Skipping. PhysicalResourceId: ${event.PhysicalResourceId}`);
        return {
          PhysicalResourceId: event.PhysicalResourceId
        };
    }
  }
  const subdomain = event.ResourceProperties[PROP_SUB_DOMAIN];
  const hostedZoneParameterName = event.ResourceProperties[PROP_HOSTED_ZONE_PARAMETER_NAME];
  const r53ChangeInfoIdParameterName = event.ResourceProperties[PROP_R53_CHANGEINFO_ID_PARAMETER_NAME];
  switch (event.RequestType) {
    case "Create":
      const hostedZoneNameServerParameterResponse = await ssm.getParameter({
        Name: hostedZoneParameterName
      });
      const hostedZoneNameServersAsString = hostedZoneNameServerParameterResponse.Parameter?.Value;
      log({
        event: hostedZoneNameServersAsString,
        level: "debug"
      });
      if (hostedZoneNameServersAsString === void 0 || hostedZoneNameServersAsString === "") {
        throw new Error(`hosted zone name servers not found or empty in parameter store for ${domain}: ${hostedZoneNameServersAsString}`);
      }
      const hostedZoneNameServers = hostedZoneNameServersAsString?.split(",");
      if (hostedZoneNameServers.length !== 4) {
        throw new Error(`expected exactly 4 hosted zone name servers for ${domain}. Got ${hostedZoneNameServers.length}: ${hostedZoneNameServers}`);
      }
      const hostedZoneResponse = await route53.listHostedZonesByName({
        DNSName: domain
      });
      if (hostedZoneResponse.HostedZones === void 0 || hostedZoneResponse.HostedZones?.length === 0) {
        log({
          event: hostedZoneResponse,
          level: "debug"
        });
        throw new Error(`expected to find at least one hosted zone for ${domain}`);
      }
      const filteredHostedZones = hostedZoneResponse.HostedZones?.filter((hostedZone) => {
        return hostedZone.Id === `/hostedzone/${parentHostedZoneId}`;
      });
      if (filteredHostedZones.length !== 1) {
        log({
          event: hostedZoneResponse,
          level: "debug"
        });
        throw new Error(`expected to find & filter exactly 1 hosted zone for ${domain}. Got ${filteredHostedZones.length}`);
      }
      const listResourceRecordSetsResponse = await route53.listResourceRecordSets({
        // remove the prefix for using it as parameter
        HostedZoneId: parentHostedZoneId.replace("/hostedzone/", "")
      });
      if (listResourceRecordSetsResponse.ResourceRecordSets === void 0) {
        log({
          event: listResourceRecordSetsResponse,
          level: "debug"
        });
        throw new Error(`expected to find at least one resource record set for ${domain}`);
      }
      const existingNSRecordSet = listResourceRecordSetsResponse.ResourceRecordSets?.find((recordSet) => {
        return recordSet.Name === `${subdomain}.${domain}.` && recordSet.Type === "NS";
      });
      if (existingNSRecordSet !== void 0) {
        log({
          event: existingNSRecordSet,
          level: "debug"
        });
        log(`NS record for Name '${subdomain}.${domain}' and type NS already exists. Skipping.`);
        return {
          PhysicalResourceId: event.RequestId
        };
      }
      log(`NS record for Name '${subdomain}.${domain}' and type NS does not exist. Creating.`);
      const recordSetCreationResponse = await route53.changeResourceRecordSets({
        HostedZoneId: parentHostedZoneId,
        ChangeBatch: {
          Comment: "rootmail-autowire-dns",
          Changes: [
            {
              Action: "CREATE",
              ResourceRecordSet: {
                Name: `${subdomain}.${domain}`,
                Type: "NS",
                TTL: 60,
                ResourceRecords: [
                  // are always 4
                  { Value: hostedZoneNameServers[0] },
                  { Value: hostedZoneNameServers[1] },
                  { Value: hostedZoneNameServers[2] },
                  { Value: hostedZoneNameServers[3] }
                ]
              }
            }
          ]
        }
      });
      await ssm.putParameter({
        Name: r53ChangeInfoIdParameterName,
        Value: recordSetCreationResponse.ChangeInfo.Id,
        Overwrite: true
      });
      return {
        PhysicalResourceId: event.RequestId
      };
    case "Update":
      log(`Skipping update for NS record for Name '${subdomain}.${domain}'`);
      return {
        PhysicalResourceId: event.PhysicalResourceId
      };
    case "Delete":
      log(`Deleting NS record for Name '${subdomain}.${domain}' in the hosted zone with ID ${parentHostedZoneId}`);
      const recordName = `${subdomain}.${domain}`;
      try {
        let nextRecordName;
        let isRecordDeleted = false;
        do {
          const recordsResponse = await route53.listResourceRecordSets({
            HostedZoneId: parentHostedZoneId,
            StartRecordName: nextRecordName
          });
          for (const recordSet of recordsResponse.ResourceRecordSets || []) {
            if (recordSet.Name === `${recordName}.` && recordSet.Type === "NS") {
              console.log(`Deleting record: ${recordSet.Name} ${recordSet.Type}`);
              await route53.changeResourceRecordSets({
                HostedZoneId: parentHostedZoneId,
                ChangeBatch: {
                  Changes: [
                    {
                      Action: "DELETE",
                      ResourceRecordSet: recordSet
                    }
                  ]
                }
              });
              console.log(`Deleted record: ${recordSet.Name} ${recordSet.Type}. Stopping here.`);
              isRecordDeleted = true;
              break;
            }
          }
          nextRecordName = recordsResponse.NextRecordName;
          if (isRecordDeleted) {
            console.log(`Record deleted: ${recordName} type 'NS'. Quitting.`);
            break;
          }
        } while (nextRecordName);
      } catch (err) {
        console.log(`Error deleting records: ${err}`);
        throw err;
      }
      return {
        PhysicalResourceId: event.PhysicalResourceId
      };
  }
}
function log(msg) {
  console.log(JSON.stringify(msg));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PROP_DOMAIN,
  PROP_HOSTED_ZONE_PARAMETER_NAME,
  PROP_PARENT_HOSTED_ZONE_ID,
  PROP_R53_CHANGEINFO_ID_PARAMETER_NAME,
  PROP_SUB_DOMAIN,
  handler
});
