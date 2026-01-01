import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  conversations: defineTable({
    userId: v.string(), // Clerk user ID
    title: v.string(), // Auto-generated from first prompt
    rootNodeId: v.optional(v.id('nodes')), // Entry point (optional initially)
    lastAccessedAt: v.number(),
    defaultModel: v.optional(v.string()), // User's selected model for this conversation
    isFreeTier: v.optional(v.boolean()), // True if this is a free tier conversation
  })
    .index('userId', ['userId'])
    .index('lastAccessed', ['userId', 'lastAccessedAt']),

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
    .index('parentId', ['parentId']),

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
      v.literal('trialing'),
    ),
    currentPeriodStart: v.number(), // Unix timestamp in milliseconds
    currentPeriodEnd: v.number(), // Unix timestamp in milliseconds
    includedTokenCredit: v.number(), // $10 in tokens (dollar amount)
    planType: v.literal('paid'),
  })
    .index('userId', ['userId'])
    .index('stripeSubscriptionId', ['stripeSubscriptionId'])
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
})
