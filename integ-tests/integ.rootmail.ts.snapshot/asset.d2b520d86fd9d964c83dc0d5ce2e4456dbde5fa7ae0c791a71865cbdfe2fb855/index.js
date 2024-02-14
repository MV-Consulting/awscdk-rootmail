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

// integ-tests/functions/send-email-handler.ts
var send_email_handler_exports = {};
__export(send_email_handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(send_email_handler_exports);
var import_client_ses = require("@aws-sdk/client-ses");
var ses = new import_client_ses.SES();
var handler = async (event) => {
  const id = event.id || "test-id-1";
  const text = event.text || "test";
  const sourceMail = event.sourceMail || "test@example.com";
  const toMail = event.toMail || "root@example.com";
  const ruleAfter = await ses.describeReceiptRule({
    RuleSetName: "RootMail",
    RuleName: "Receive"
  });
  log({ message: "Rule:", rule: ruleAfter.Rule });
  const params = {
    Source: sourceMail,
    Destination: {
      ToAddresses: [toMail]
    },
    Message: {
      Subject: {
        Data: id
      },
      Body: {
        Text: {
          Data: text
        }
      }
    }
  };
  try {
    const res = await ses.sendEmail(params);
    if (res.$metadata.httpStatusCode !== 200) {
      log({
        message: "Error sending email",
        params,
        messageId: res.MessageId,
        err: `httpStatusCode: ${res.$metadata.httpStatusCode}`
      });
      return { sendStatusCode: 500, err: res.$metadata.httpStatusCode };
    }
    log({
      message: "Email sent",
      params,
      res
    });
    return { sendStatusCode: 200 };
  } catch (err) {
    log({
      message: "Error (catch) sending email",
      err
    });
    return { sendStatusCode: 500, err };
  }
};
function log(msg) {
  console.log(JSON.stringify(msg));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
