import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

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
  },
  handler: async (ctx, args) => {
    const nodeId = await ctx.db.insert('nodes', args)
    return nodeId
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
  },
  handler: async (ctx, args) => {
    return getAncestorsInternal(ctx, args.nodeId)
  },
})

// Get children of a node
export const getChildren = query({
  args: {
    parentId: v.id('nodes'),
  },
  handler: async (ctx, args) => {
    const children = await ctx.db
      .query('nodes')
      .withIndex('parentId', (q) => q.eq('parentId', args.parentId))
      .collect()

    return children
  },
})

// Get a single node
export const getNode = query({
  args: {
    nodeId: v.id('nodes'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.nodeId)
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
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.nodeId, {
      position: args.position,
    })
  },
})

// Get the full context chain with cumulative tokens
export const getContextChain = query({
  args: {
    nodeId: v.id('nodes'),
  },
  handler: async (ctx, args) => {
    const ancestors = await getAncestorsInternal(ctx, args.nodeId)

    let cumulativeTokens = 0
    const chain = ancestors.map((node) => {
      cumulativeTokens += node.tokensUsed
      return {
        ...node,
        cumulativeTokens,
      }
    })

    return {
      chain,
      totalTokens: cumulativeTokens,
    }
  },
})

