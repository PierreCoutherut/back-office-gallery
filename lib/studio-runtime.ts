// This adapter is used only by the independent Node.js export.
// Incoming ChatGPT identity headers are untrusted and never authenticate a user.
export const IS_SITES=false;
export function setting(name:string):string{return process.env[name]||'';}
