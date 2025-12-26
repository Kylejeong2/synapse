/**
 * Convex-compatible logging utilities
 * Uses console.log with structured JSON for wide events
 */

export type ConvexLogStatus = 'success' | 'error' | 'partial';

export interface ConvexOperationLog {
	// Operation Identifiers
	operation_id: string;
	request_id?: string; // Correlation with parent request
	operation_type: 'query' | 'mutation';
	operation_name: string;

	// Timing
	timestamp: number;
	duration_ms: number;

	// Context
	table?: string;
	document_id?: string;
	user_id?: string;
	conversation_id?: string;

	// Results
	status: ConvexLogStatus;
	records_affected?: number;
	error_type?: string;
	error_message?: string;
	error_stack?: string;

	// Infrastructure
	service_name: string;
	environment: string;
}

/**
 * Log a Convex operation with structured data
 */
export function logConvexOperation(event: ConvexOperationLog): void {
	console.log(JSON.stringify({
		event_type: 'convex_operation',
		...event,
	}));
}

/**
 * Generate a unique operation ID
 */
export function generateOperationId(prefix = 'op'): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Timer utility for tracking operation duration
 */
export class ConvexTimer {
	private startTime: number;

	constructor() {
		this.startTime = Date.now();
	}

	/**
	 * Get duration from start in milliseconds
	 */
	elapsed(): number {
		return Date.now() - this.startTime;
	}
}

/**
 * Wrap a Convex handler with logging
 */
export function withLogging<TArgs extends Record<string, any>, TReturn>(
	operationName: string,
	operationType: 'query' | 'mutation',
	handler: (ctx: any, args: TArgs) => Promise<TReturn>,
) {
	return async (ctx: any, args: TArgs): Promise<TReturn> => {
		const operationId = generateOperationId();
		const timer = new ConvexTimer();
		const logContext: ConvexOperationLog = {
			operation_id: operationId,
			operation_type: operationType,
			operation_name: operationName,
			timestamp: Date.now(),
			duration_ms: 0,
			status: 'success',
			service_name: 'synapse-convex',
			environment: process.env.NODE_ENV || 'development',
		};

		// Extract request_id from args if available
		const requestId = (args as any)?.requestId;
		if (requestId) {
			logContext.request_id = requestId;
		}

		// Extract common IDs from args
		const argsObj = args as any;
		if (argsObj?.conversationId) {
			logContext.conversation_id = argsObj.conversationId;
		}
		if (argsObj?.userId) {
			logContext.user_id = argsObj.userId;
		}
		if (argsObj?.nodeId) {
			logContext.document_id = argsObj.nodeId;
		}

		try {
			const result = await handler(ctx, args);
			logContext.duration_ms = timer.elapsed();
			logContext.status = 'success';
			logConvexOperation(logContext);
			return result;
		} catch (error) {
			logContext.duration_ms = timer.elapsed();
			logContext.status = 'error';
			logContext.error_type = error instanceof Error ? error.name : 'Unknown';
			logContext.error_message = error instanceof Error ? error.message : String(error);
			logContext.error_stack = error instanceof Error ? error.stack : undefined;
			logConvexOperation(logContext);
			throw error;
		}
	};
}

