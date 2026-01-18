import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { ConvexTimer, generateOperationId, logConvexOperation } from './logger'

// Basic email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Add email to waitlist
export const addEmail = mutation({
  args: {
    email: v.string(),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operationId = generateOperationId()
    const timer = new ConvexTimer()
    
    try {
      const { email } = args
      
      // Validate email format
      if (!EMAIL_REGEX.test(email)) {
        throw new Error('Invalid email format')
      }
      
      // Normalize email (lowercase)
      const normalizedEmail = email.toLowerCase().trim()
      
      // Check for duplicates
      const existing = await ctx.db
        .query('waitlist')
        .withIndex('email', (q) => q.eq('email', normalizedEmail))
        .first()
      
      if (existing) {
        // Return success even if duplicate (don't reveal if email exists)
        logConvexOperation({
          operation_id: operationId,
          request_id: args.requestId,
          operation_type: 'mutation',
          operation_name: 'waitlist.addEmail',
          timestamp: Date.now(),
          duration_ms: timer.elapsed(),
          table: 'waitlist',
          status: 'success',
          records_affected: 0,
          service_name: 'synapse-convex',
          environment: process.env.NODE_ENV || 'development',
        })
        return { success: true, duplicate: true }
      }
      
      // Insert new email
      await ctx.db.insert('waitlist', {
        email: normalizedEmail,
        createdAt: Date.now(),
      })
      
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'waitlist.addEmail',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        table: 'waitlist',
        status: 'success',
        records_affected: 1,
        service_name: 'synapse-convex',
        environment: process.env.NODE_ENV || 'development',
      })
      
      return { success: true, duplicate: false }
    } catch (error) {
      logConvexOperation({
        operation_id: operationId,
        request_id: args.requestId,
        operation_type: 'mutation',
        operation_name: 'waitlist.addEmail',
        timestamp: Date.now(),
        duration_ms: timer.elapsed(),
        table: 'waitlist',
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
