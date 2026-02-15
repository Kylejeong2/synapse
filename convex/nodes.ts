import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { ConvexTimer, generateOperationId, logConvexOperation } from './logger'
import { FREE_TIER_MAX_TOKENS } from './pricing'

// Create a new node
export const create = mutation({
  args: {
    conversationId: v.id('conversations'),
    parentId: v.optional(v.id('nodes')),
    userPrompt: v.string(),
    assistantResponse: v.string(),
    model: v.string(),
    tokensUsed: v.number(),
    depth: v.number(),
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      // Get conversation to check free tier status
      const conversation = await ctx.db.get(args.conversationId)
      if (!conversation) {
        throw new Error('Conversation not found')
      }

      // Check if user is free tier
      const subscription = await ctx.db
        .query('subscriptions')
        .withIndex('userId', (q) => q.eq('userId', conversation.userId))
        .filter((q) => q.eq(q.field('status'), 'active'))
        .first()

      if (!subscription && conversation.isFreeTier) {
        // Free tier: Check total token usage
        const freeTierUsage = await ctx.db
          .query('free_tier_usage')
          .withIndex('userId', (q) => q.eq('userId', conversation.userId))
          .collect()

        const totalTokensUsed = freeTierUsage.reduce(
          (sum, usage) => sum + usage.tokensUsed,
          0,
        )

        if (totalTokensUsed + args.tokensUsed > FREE_TIER_MAX_TOKENS) {
          throw new Error(
            `Free tier token limit exceeded. You have reached the ${FREE_TIER_MAX_TOKENS.toLocaleString()} token limit. Please upgrade to continue.`,
          )
        }
      }

      const { requestId, ...nodeData } = args
      const nodeId = await ctx.db.insert('nodes', nodeData)
      
      logConvexOperation({
        operation_id: operationId,
        request_id: requestId,
        operation_type: 'mutation',
        operation_name: 'nodes.create',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        conversation_id: args.conversationId,
        document_id: nodeId,
        status: 'success',
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      
      return nodeId
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'nodes.create',
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

// Internal helper to get ancestors
async function getAncestorsInternal(ctx: any, nodeId?: Id<'nodes'>) {
  if (!nodeId) return []

  const ancestors: Doc<'nodes'>[] = []

  let currentNodeId: Id<'nodes'> | undefined = nodeId
  while (currentNodeId) {
    const node: Doc<'nodes'> | null = await ctx.db.get(currentNodeId)
    if (!node) break
    ancestors.unshift(node)
    currentNodeId = node.parentId
  }

  return ancestors
}

// Get all ancestor nodes (for building context)
export const getAncestors = query({
  args: {
    nodeId: v.optional(v.id('nodes')),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const result = await getAncestorsInternal(ctx, args.nodeId)
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'query',
        operation_name: 'nodes.getAncestors',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        document_id: args.nodeId,
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
        operation_name: 'nodes.getAncestors',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        document_id: args.nodeId,
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

// Get children of a node
export const getChildren = query({
  args: {
    parentId: v.id('nodes'),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const children = await ctx.db
        .query('nodes')
        .withIndex('parentId', (q) => q.eq('parentId', args.parentId))
        .collect()
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'query',
        operation_name: 'nodes.getChildren',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        document_id: args.parentId,
        status: 'success',
        records_affected: children.length,
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      
      return children
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'query',
        operation_name: 'nodes.getChildren',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        document_id: args.parentId,
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

// Get a single node
export const getNode = query({
  args: {
    nodeId: v.id('nodes'),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const node = await ctx.db.get(args.nodeId)
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'query',
        operation_name: 'nodes.getNode',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        document_id: args.nodeId,
        status: 'success',
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      
      return node
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'query',
        operation_name: 'nodes.getNode',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        document_id: args.nodeId,
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

// Update node position (for React Flow layout persistence)
export const updatePosition = mutation({
  args: {
    nodeId: v.id('nodes'),
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const { nodeId, position } = args
      await ctx.db.patch(nodeId, { position })
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'nodes.updatePosition',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        document_id: nodeId,
        status: 'success',
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'nodes.updatePosition',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        document_id: args.nodeId,
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

// Update node content after/while streaming
export const updateContent = mutation({
  args: {
    nodeId: v.id('nodes'),
    assistantResponse: v.string(),
    tokensUsed: v.number(),
    model: v.optional(v.string()),
    toolCalls: v.optional(v.array(v.any())),
    toolResults: v.optional(v.array(v.any())),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const { nodeId, assistantResponse, tokensUsed, model, toolCalls, toolResults } = args
      await ctx.db.patch(nodeId, {
        assistantResponse,
        tokensUsed,
        model: model ?? undefined,
        toolCalls: toolCalls ?? undefined,
        toolResults: toolResults ?? undefined,
      })
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'nodes.updateContent',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        document_id: nodeId,
        status: 'success',
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'nodes.updateContent',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        document_id: args.nodeId,
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

// Get the full context chain with cumulative tokens
export const getContextChain = query({
  args: {
    nodeId: v.id('nodes'),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const ancestors = await getAncestorsInternal(ctx, args.nodeId)

      let cumulativeTokens = 0
      const chain = ancestors.map((node) => {
        cumulativeTokens += node.tokensUsed
        return {
          ...node,
          cumulativeTokens,
        }
      })

      const result = {
        chain,
        totalTokens: cumulativeTokens,
      }
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'query',
        operation_name: 'nodes.getContextChain',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        document_id: args.nodeId,
        status: 'success',
        records_affected: chain.length,
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      
      return result
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'query',
        operation_name: 'nodes.getContextChain',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        document_id: args.nodeId,
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
