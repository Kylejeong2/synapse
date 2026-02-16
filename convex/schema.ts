import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  conversations: defineTable({
    userId: v.string(), // Clerk user ID
    title: v.string(), // Auto-generated from first prompt
    rootNodeId: v.optional(v.id('nodes')), // Entry point (optional initially)
    lastAccessedAt: v.number(),
    defaultModel: v.optional(v.string()), // User's selected model for this conversation
    isPinned: v.optional(v.boolean()), // Pinned to top of dashboard
    tags: v.optional(v.array(v.string())), // User-assigned tags for organization
    isFreeTier: v.optional(v.boolean()), // True if this is a free tier conversation
  })
    .index('userId', ['userId'])
    .index('lastAccessed', ['userId', 'lastAccessedAt'])
    .searchIndex('search_title', {
      searchField: 'title',
      filterFields: ['userId'],
    }),

  nodes: defineTable({
    conversationId: v.id('conversations'),
    parentId: v.optional(v.id('nodes')), // null for root
    userPrompt: v.string(),
    assistantResponse: v.string(),
    model: v.string(), // "gpt-5-pro" for now
    tokensUsed: v.number(), // For context tracking
    depth: v.number(), // Tree depth from root
    position: v.object({
      // For React Flow layout
      x: v.number(),
      y: v.number(),
    }),
    toolCalls: v.optional(v.array(v.any())), // Store tool call metadata
    toolResults: v.optional(v.array(v.any())), // Store tool results
  })
    .index('conversationId', ['conversationId'])
    .index('parentId', ['parentId'])
    .searchIndex('search_content', {
      searchField: 'userPrompt',
      filterFields: ['conversationId'],
    }),

  subscriptions: defineTable({
    userId: v.string(), // Clerk user ID
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('canceled'),
      v.literal('past_due'),
      v.literal('unpaid'),
      v.literal('incomplete'),
      v.literal('incomplete_expired'),
      v.literal('paused'),
      v.literal('trialing'),
    ),
    currentPeriodStart: v.number(), // Unix timestamp in milliseconds
    currentPeriodEnd: v.number(), // Unix timestamp in milliseconds
    includedTokenCredit: v.number(), // $10 in tokens (dollar amount)
    monthlySpendCap: v.optional(v.number()), // Optional hard spend cap in USD per cycle
    cancelAtPeriodEnd: v.optional(v.boolean()),
    lastInvoicePaymentStatus: v.optional(
      v.union(
        v.literal('paid'),
        v.literal('failed'),
        v.literal('open'),
      ),
    ),
    planType: v.literal('paid'),
  })
    .index('userId', ['userId'])
    .index('stripeSubscriptionId', ['stripeSubscriptionId'])
    .index('stripeCustomerId', ['stripeCustomerId']),

  billing_customers: defineTable({
    userId: v.string(),
    stripeCustomerId: v.string(),
    email: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('userId', ['userId'])
    .index('stripeCustomerId', ['stripeCustomerId']),

  usage_records: defineTable({
    userId: v.string(), // Clerk user ID
    conversationId: v.id('conversations'),
    nodeId: v.id('nodes'),
    model: v.string(), // Model identifier
    tokensUsed: v.number(), // Total tokens used (input + output + thinking)
    tokenCost: v.number(), // Actual cost in dollars
    timestamp: v.number(), // Unix timestamp in milliseconds
    billingCycleId: v.optional(v.id('billing_cycles')), // Link to billing cycle
  })
    .index('userId', ['userId'])
    .index('conversationId', ['conversationId'])
    .index('timestamp', ['timestamp'])
    .index('billingCycleId', ['billingCycleId']),

  billing_cycles: defineTable({
    userId: v.string(), // Clerk user ID
    subscriptionId: v.id('subscriptions'),
    periodStart: v.number(), // Unix timestamp in milliseconds
    periodEnd: v.number(), // Unix timestamp in milliseconds
    tokensUsed: v.number(), // Total tokens used in this cycle
    tokenCost: v.number(), // Total cost in dollars
    includedCredit: v.number(), // $10 credit amount
    overageAmount: v.number(), // Amount over the included credit
    stripeInvoiceId: v.optional(v.string()), // Stripe invoice ID if billed
    status: v.union(
      v.literal('active'), // Current billing period
      v.literal('completed'), // Past period, billed
      v.literal('pending'), // Period ended, billing pending
    ),
  })
    .index('userId', ['userId'])
    .index('subscriptionId', ['subscriptionId'])
    .index('periodStart', ['periodStart'])
    .index('periodEnd', ['periodEnd']),

  free_tier_usage: defineTable({
    userId: v.string(), // Clerk user ID
    conversationId: v.id('conversations'),
    tokensUsed: v.number(), // Tokens used for this conversation
    createdAt: v.number(), // Unix timestamp in milliseconds
    isLocked: v.literal(true), // Cannot be deleted
  })
    .index('userId', ['userId'])
    .index('conversationId', ['conversationId']),

  token_pricing: defineTable({
    model: v.string(), // Model identifier 
    providerCostPer1kInput: v.number(), // Provider cost per 1k input tokens
    providerCostPer1kOutput: v.number(), // Provider cost per 1k output tokens
    providerCostPer1kThinking: v.optional(v.number()), // Provider cost per 1k thinking tokens (if applicable)
    markupMultiplier: v.number(), // Markup multiplier (e.g., 2.5 for 2.5x)
    pricePerTokenInput: v.number(), // Final price per input token
    pricePerTokenOutput: v.number(), // Final price per output token
    pricePerTokenThinking: v.optional(v.number()), // Final price per thinking token
    isActive: v.boolean(), // Whether this pricing is currently active
    updatedAt: v.number(), // Unix timestamp in milliseconds
  })
    .index('model', ['model'])
    .index('isActive', ['isActive']),

  stripe_events: defineTable({
    eventId: v.string(), // Stripe event ID for idempotency
    type: v.string(), // Stripe event type
    createdAt: v.number(), // Stripe event creation timestamp in ms
    status: v.union(
      v.literal('processing'),
      v.literal('processed'),
      v.literal('failed'),
    ),
    processedAt: v.optional(v.number()), // Local processing timestamp in ms
    lastError: v.optional(v.string()),
    attempts: v.number(),
    lastAttemptAt: v.number(),
  })
    .index('eventId', ['eventId'])
    .index('createdAt', ['createdAt'])
    .index('status', ['status']),

  stripe_webhook_failures: defineTable({
    eventId: v.string(),
    type: v.string(),
    payload: v.optional(v.string()),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    retryCount: v.number(),
    lastError: v.string(),
    resolvedAt: v.optional(v.number()),
  })
    .index('eventId', ['eventId'])
    .index('resolvedAt', ['resolvedAt']),

  billing_alerts: defineTable({
    source: v.union(
      v.literal('webhook'),
      v.literal('overage_cron'),
      v.literal('invoice'),
    ),
    severity: v.union(
      v.literal('info'),
      v.literal('warning'),
      v.literal('error'),
    ),
    message: v.string(),
    context: v.optional(v.string()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index('source', ['source'])
    .index('severity', ['severity'])
    .index('createdAt', ['createdAt']),
})
