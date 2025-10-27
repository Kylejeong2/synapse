import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  conversations: defineTable({
    userId: v.string(), // Clerk user ID
    title: v.string(), // Auto-generated from first prompt
    rootNodeId: v.optional(v.id('nodes')), // Entry point (optional initially)
    lastAccessedAt: v.number(),
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
  })
    .index('conversationId', ['conversationId'])
    .index('parentId', ['parentId']),
})
