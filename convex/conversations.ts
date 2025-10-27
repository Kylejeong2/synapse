import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

// Create a new conversation
export const create = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const conversationId = await ctx.db.insert('conversations', {
      userId: args.userId,
      title: args.title,
      lastAccessedAt: Date.now(),
    })
    return conversationId
  },
})

// Update conversation's root node
export const updateRootNode = mutation({
  args: {
    conversationId: v.id('conversations'),
    rootNodeId: v.id('nodes'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      rootNodeId: args.rootNodeId,
    })
  },
})

// Update last accessed time
export const updateLastAccessed = mutation({
  args: {
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      lastAccessedAt: Date.now(),
    })
  },
})

// Get all conversations for a user
export const getUserConversations = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query('conversations')
      .withIndex('userId', (q) => q.eq('userId', args.userId))
      .collect()

    // Get node count for each conversation
    const conversationsWithCounts = await Promise.all(
      conversations.map(async (conv) => {
        const nodes = await ctx.db
          .query('nodes')
          .withIndex('conversationId', (q) =>
            q.eq('conversationId', conv._id),
          )
          .collect()
        return {
          ...conv,
          nodeCount: nodes.length,
        }
      }),
    )

    // Sort by last accessed
    return conversationsWithCounts.sort(
      (a, b) => b.lastAccessedAt - a.lastAccessedAt,
    )
  },
})

// Get a single conversation with all its nodes
export const getConversation = query({
  args: {
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) return null

    const nodes = await ctx.db
      .query('nodes')
      .withIndex('conversationId', (q) =>
        q.eq('conversationId', args.conversationId),
      )
      .collect()

    return {
      ...conversation,
      nodes,
    }
  },
})

// Delete a conversation and all its nodes
export const deleteConversation = mutation({
  args: {
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    // Delete all nodes first
    const nodes = await ctx.db
      .query('nodes')
      .withIndex('conversationId', (q) =>
        q.eq('conversationId', args.conversationId),
      )
      .collect()

    for (const node of nodes) {
      await ctx.db.delete(node._id)
    }

    // Delete the conversation
    await ctx.db.delete(args.conversationId)
  },
})

