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
})
