/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as billing from "../billing.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as logger from "../logger.js";
import type * as nodes from "../nodes.js";
import type * as rateLimiting from "../rateLimiting.js";
import type * as stripe from "../stripe.js";
import type * as stripeWebhooks from "../stripeWebhooks.js";
import type * as subscriptions from "../subscriptions.js";
import type * as tokenPricing from "../tokenPricing.js";
import type * as usage from "../usage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  billing: typeof billing;
  conversations: typeof conversations;
  crons: typeof crons;
  logger: typeof logger;
  nodes: typeof nodes;
  rateLimiting: typeof rateLimiting;
  stripe: typeof stripe;
  stripeWebhooks: typeof stripeWebhooks;
  subscriptions: typeof subscriptions;
  tokenPricing: typeof tokenPricing;
  usage: typeof usage;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
