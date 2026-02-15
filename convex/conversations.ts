import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { ConvexTimer, generateOperationId, logConvexOperation } from './logger'
import { FREE_TIER_MAX_CONVERSATIONS } from './pricing'

// Create a new conversation
export const create = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      // Check if user has active subscription
      const subscription = await ctx.db
        .query('subscriptions')
        .withIndex('userId', (q) => q.eq('userId', args.userId))
        .filter((q) => q.eq(q.field('status'), 'active'))
        .first()

      // If no subscription, check free tier limits
      if (!subscription) {
        const existingFreeTierConversations = await ctx.db
          .query('conversations')
          .withIndex('userId', (q) => q.eq('userId', args.userId))
          .filter((q) => q.eq(q.field('isFreeTier'), true))
          .collect()

        if (existingFreeTierConversations.length >= FREE_TIER_MAX_CONVERSATIONS) {
          throw new Error(
            `Free tier users are limited to ${FREE_TIER_MAX_CONVERSATIONS} conversation${FREE_TIER_MAX_CONVERSATIONS === 1 ? '' : 's'}. Please upgrade to create more conversations.`,
          )
        }
      }

      const conversationId = await ctx.db.insert('conversations', {
        userId: args.userId,
        title: args.title,
        lastAccessedAt: Date.now(),
        isFreeTier: !subscription, // Mark as free tier if no subscription
      })
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'conversations.create',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        user_id: args.userId,
        conversation_id: conversationId,
        status: 'success',
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      
      return conversationId
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'conversations.create',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        user_id: args.userId,
        status: 'error',
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_message: error instanceof Error ? error.message : String(error),
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      throw error
    }
  },
})

// Update conversation's root node
export const updateRootNode = mutation({
  args: {
    conversationId: v.id('conversations'),
    rootNodeId: v.id('nodes'),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const { conversationId, rootNodeId } = args
      await ctx.db.patch(conversationId, { rootNodeId })
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'conversations.updateRootNode',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        conversation_id: conversationId,
        status: 'success',
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'conversations.updateRootNode',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        conversation_id: args.conversationId,
        status: 'error',
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_message: error instanceof Error ? error.message : String(error),
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      throw error
    }
  },
})

// Update last accessed time
export const updateLastAccessed = mutation({
  args: {
    conversationId: v.id('conversations'),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const { conversationId } = args
      await ctx.db.patch(conversationId, {
        lastAccessedAt: Date.now(),
      })
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'conversations.updateLastAccessed',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        conversation_id: conversationId,
        status: 'success',
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'conversations.updateLastAccessed',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        conversation_id: args.conversationId,
        status: 'error',
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_message: error instanceof Error ? error.message : String(error),
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      throw error
    }
  },
})

// Get all conversations for a user
export const getUserConversations = query({
  args: {
    userId: v.string(),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const { userId } = args
      const conversations = await ctx.db
        .query('conversations')
        .withIndex('userId', (q) => q.eq('userId', userId))
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
      const result = conversationsWithCounts.sort(
        (a, b) => b.lastAccessedAt - a.lastAccessedAt,
      )
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'query',
        operation_name: 'conversations.getUserConversations',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        user_id: userId,
        status: 'success',
        records_affected: result.length,
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      
      return result
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'query',
        operation_name: 'conversations.getUserConversations',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        user_id: args.userId,
        status: 'error',
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_message: error instanceof Error ? error.message : String(error),
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      throw error
    }
  },
})

// Get a single conversation with all its nodes
export const getConversation = query({
  args: {
    conversationId: v.id('conversations'),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const { conversationId } = args
      const conversation = await ctx.db.get(conversationId)
      if (!conversation) return null

      const nodes = await ctx.db
        .query('nodes')
        .withIndex('conversationId', (q) =>
          q.eq('conversationId', conversationId),
        )
        .collect()

      const result = {
        ...conversation,
        nodes,
      }
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'query',
        operation_name: 'conversations.getConversation',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        conversation_id: conversationId,
        status: 'success',
        records_affected: nodes.length,
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      
      return result
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'query',
        operation_name: 'conversations.getConversation',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        conversation_id: args.conversationId,
        status: 'error',
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_message: error instanceof Error ? error.message : String(error),
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      throw error
    }
  },
})

// Delete a conversation and all its nodes
export const deleteConversation = mutation({
  args: {
    conversationId: v.id('conversations'),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const { conversationId } = args
      
      // Check if this is a free tier conversation
      const conversation = await ctx.db.get(conversationId)
      if (!conversation) {
        throw new Error('Conversation not found')
      }

      if (conversation.isFreeTier) {
        throw new Error(
          'Free tier conversations cannot be deleted. Please upgrade to manage your conversations.',
        )
      }

      // Delete all nodes first
      const nodes = await ctx.db
        .query('nodes')
        .withIndex('conversationId', (q) =>
          q.eq('conversationId', conversationId),
        )
        .collect()

      for (const node of nodes) {
        await ctx.db.delete(node._id)
      }

      // Delete the conversation
      await ctx.db.delete(conversationId)
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'conversations.deleteConversation',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        conversation_id: conversationId,
        status: 'success',
        records_affected: nodes.length + 1,
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'conversations.deleteConversation',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        conversation_id: args.conversationId,
        status: 'error',
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_message: error instanceof Error ? error.message : String(error),
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      throw error
    }
  },
})

// Update the default model for a conversation
export const updateDefaultModel = mutation({
  args: {
    conversationId: v.id('conversations'),
    model: v.string(),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const { conversationId, model } = args
      await ctx.db.patch(conversationId, { defaultModel: model })
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'conversations.updateDefaultModel',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        conversation_id: conversationId,
        status: 'success',
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'conversations.updateDefaultModel',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        conversation_id: args.conversationId,
        status: 'error',
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_message: error instanceof Error ? error.message : String(error),
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      throw error
    }
  },
})
