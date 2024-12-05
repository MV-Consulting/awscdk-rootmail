"use strict";Object.defineProperty(exports,"__esModule",{value:!0}),exports.withRetries=exports.log=exports.getEnv=void 0;function getEnv(name){const value=process.env[name];if(!value)throw new Error(`The environment variable "${name}" is not defined`);return value}exports.getEnv=getEnv;function log(title,...args){console.log("[provider-framework]",title,...args.map(x=>typeof x=="object"?JSON.stringify(x,void 0,2):x))}exports.log=log;function withRetries(options,fn){return async(...xs)=>{let attempts=options.attempts,ms=options.sleep;for(;;)try{return await fn(...xs)}catch(e){if(attempts--<=0)throw e;await sleep(Math.floor(Math.random()*ms)),ms*=2}}}exports.withRetries=withRetries;async function sleep(ms){return new Promise(ok=>setTimeout(ok,ms))}
