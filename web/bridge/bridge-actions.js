import { registerActions as registerSiteActions } from "../site-actions.js";

// Both tools read the public fixtures. They never accept files or access page state.
export function registerActions(actions) {
  registerSiteActions(actions, {availability: "bridge", callerOrigins: ["*"]});
}
