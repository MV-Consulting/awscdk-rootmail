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

// integ-tests/functions/close-opsitem-handler.ts
var close_opsitem_handler_exports = {};
__export(close_opsitem_handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(close_opsitem_handler_exports);
var import_client_ssm = require("@aws-sdk/client-ssm");
var ssm = new import_client_ssm.SSM();
async function getOpsItem(title) {
  const maxRetries = 30;
  const delaySeconds = 5;
  for (let i = 1; i <= maxRetries; i++) {
    log({
      message: `Getting opsItem with title ${title} at try ${i}/${maxRetries} with delay ${delaySeconds}s`,
      title
    });
    const res = await ssm.getOpsSummary({
      Filters: [
        {
          Key: "AWS:OpsItem.Title",
          Values: [title],
          Type: "Equal"
        },
        {
          Key: "AWS:OpsItem.Status",
          Values: ["Open"],
          Type: "Equal"
        }
      ]
    });
    if (res.$metadata.httpStatusCode !== 200) {
      log({
        message: "Error getOpsSummary",
        title,
        err: `httpStatusCode: ${res.$metadata.httpStatusCode}`
      });
      return void 0;
    }
    if (res.Entities === void 0 || res.Entities.length === 0) {
      log({
        message: `No opsItem entity for title. Next try in ${delaySeconds}s`,
        title,
        res
      });
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1e3));
      continue;
    }
    if (res.Entities.length > 1) {
      log({
        message: `Too many opsItems: ${res.Entities.length}`,
        title,
        res
      });
      return void 0;
    }
    return res.Entities[0];
  }
  log({
    message: "No opsItem entities at all",
    title
  });
  return void 0;
}
var handler = async (event) => {
  const title = event.title || "test";
  const source = event.source || "source";
  const description = event.description || "description";
  log({
    message: "Closing opsItem",
    event,
    title,
    source,
    description
  });
  try {
    const opsEntity = await getOpsItem(title);
    if (opsEntity === void 0) {
      log({
        message: "opsItem undefined"
      });
      return { closeStatusCode: 500 };
    }
    log({
      message: "Got opsItem",
      title
    });
    const opsItemId = opsEntity.Id;
    const opsItemContent = opsEntity.Data["AWS:OpsItem"].Content[0];
    const opsItemTitle = opsItemContent.Title;
    const opsItemSource = opsItemContent.Source;
    const opsItemDescription = opsItemContent.Description;
    if (opsItemTitle !== title.substring(0, 1020) + (title.length > 1020 ? " ..." : "") || opsItemSource !== source.substring(0, 60) + (source.length > 60 ? " ..." : ""), opsItemDescription !== description.substring(0, 1020) + (description.length > 1020 ? " ..." : "")) {
      log({
        message: "OpsItem did not match",
        expected: `title: '${title}', source: '${source}', description: '${description}'`,
        got: `title: '${opsItemTitle}', source: '${opsItemSource}', description: '${opsItemDescription}'`
      });
      return { closeStatusCode: 500 };
    }
    const resUpdate = await ssm.updateOpsItem({
      OpsItemId: opsItemId,
      Status: "Resolved"
    });
    if (resUpdate.$metadata.httpStatusCode !== 200) {
      log({
        message: "Error updateOpsItem",
        title,
        err: `httpStatusCode: ${resUpdate.$metadata.httpStatusCode}`
      });
      return { closeStatusCode: 500, err: resUpdate.$metadata.httpStatusCode };
    }
    log({
      message: "Updated opsItem",
      title,
      id: opsItemId,
      res: resUpdate
    });
    return { closeStatusCode: 200 };
  } catch (err) {
    log({
      message: "Error (catch) getting and closing opsItem",
      err
    });
    return { closeStatusCode: 500, err };
  }
};
function log(msg) {
  console.log(JSON.stringify(msg));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
