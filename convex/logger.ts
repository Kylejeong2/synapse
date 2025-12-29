/**
 * Convex-compatible logging utilities
 * Uses console.log with structured JSON for wide events
 *
 * Features:
 * - Log level filtering based on environment
 * - Pretty dev mode for local Convex dashboard
 * - Sampling for production to avoid log limits
 * - Structured JSON output for production observability
 */

export type ConvexLogLevel = "debug" | "info" | "warn" | "error";
export type ConvexLogStatus = "success" | "error" | "partial";

export interface ConvexOperationLog {
	// Operation Identifiers
	operation_id: string;
	request_id?: string; // Correlation with parent request
	operation_type: "query" | "mutation";
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
 * Logger configuration for Convex
 */
interface ConvexLoggerConfig {
	level: ConvexLogLevel;
	format: "json" | "pretty";
	sampleRate: number;
	environment: string;
}

/**
 * Get logger configuration based on environment
 */
function getLoggerConfig(): ConvexLoggerConfig {
	const env = process.env.NODE_ENV || "development";
	const isDev = env === "development";

	return {
		level: (process.env.LOG_LEVEL as ConvexLogLevel) || (isDev ? "debug" : "info"),
		format: isDev ? "pretty" : "json",
		// In prod, sample 10% of success logs
		sampleRate: isDev ? 1.0 : 0.1,
		environment: env,
	};
}

const LOG_LEVELS: ConvexLogLevel[] = ["debug", "info", "warn", "error"];

function shouldLog(level: ConvexLogLevel, configLevel: ConvexLogLevel): boolean {
	return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(configLevel);
}

function shouldSample(isError: boolean, sampleRate: number): boolean {
	// Always log errors
	if (isError) return true;
	return Math.random() < sampleRate;
}

/**
 * Format log in pretty mode for dev
 */
function formatPretty(level: ConvexLogLevel, event: Record<string, unknown>): void {
	const icons: Record<ConvexLogLevel, string> = {
		debug: "🔍",
		info: "ℹ️",
		warn: "⚠️",
		error: "❌",
	};

	const icon = icons[level];
	const eventType = event.event_type || "log";
	const timestamp = new Date().toISOString().split("T")[1].split(".")[0];

	// Build a readable summary line
	const parts: string[] = [`${icon} [${level.toUpperCase()}] ${timestamp} ${eventType}`];

	// Add key fields inline
	if (event.operation_name) parts.push(`op=${event.operation_name}`);
	if (event.duration_ms !== undefined) parts.push(`${event.duration_ms}ms`);
	if (event.status) parts.push(`status=${event.status}`);
	if (event.table) parts.push(`table=${event.table}`);

	console.log(parts.join(" | "));

	// For errors, show more details
	if (level === "error" && (event.error_message || event.error_stack)) {
		console.log(`  └─ Error: ${event.error_message}`);
		if (event.error_stack) {
			console.log(`  └─ Stack: ${String(event.error_stack).split("\n")[0]}`);
		}
	}

	// Show additional context for debug level
	if (level === "debug") {
		const context: Record<string, unknown> = {};
		const skipFields = new Set([
			"event_type",
			"operation_name",
			"duration_ms",
			"status",
			"table",
			"timestamp",
			"service_name",
			"environment",
		]);
		for (const [key, value] of Object.entries(event)) {
			if (!skipFields.has(key) && value !== undefined) {
				context[key] = value;
			}
		}
		if (Object.keys(context).length > 0) {
			console.log("  └─ Context:", JSON.stringify(context));
		}
	}
}

/**
 * Format log as JSON for production
 */
function formatJson(level: ConvexLogLevel, event: Record<string, unknown>): void {
	console.log(
		JSON.stringify({
			level,
			ts: Date.now(),
			...event,
		}),
	);
}

/**
 * Log a Convex operation with structured data
 */
export function logConvexOperation(event: ConvexOperationLog): void {
	const config = getLoggerConfig();
	const level: ConvexLogLevel = event.status === "error" ? "error" : "debug";
	const isError = event.status === "error";

	// Check log level
	if (!shouldLog(level, config.level)) return;

	// Check sampling
	if (!shouldSample(isError, config.sampleRate)) return;

	const logEvent = {
		event_type: "convex_operation",
		...event,
	};

	if (config.format === "pretty") {
		formatPretty(level, logEvent);
	} else {
		formatJson(level, logEvent);
	}
}

/**
 * Simple logging functions for Convex
 */
export const convexLog = {
	debug: (message: string, metadata?: Record<string, unknown>) => {
		const config = getLoggerConfig();
		if (!shouldLog("debug", config.level)) return;
		if (!shouldSample(false, config.sampleRate)) return;

		const event = { event_type: "debug", message, timestamp: Date.now(), ...metadata };
		if (config.format === "pretty") {
			formatPretty("debug", event);
		} else {
			formatJson("debug", event);
		}
	},

	info: (message: string, metadata?: Record<string, unknown>) => {
		const config = getLoggerConfig();
		if (!shouldLog("info", config.level)) return;
		if (!shouldSample(false, config.sampleRate)) return;

		const event = { event_type: "info", message, timestamp: Date.now(), ...metadata };
		if (config.format === "pretty") {
			formatPretty("info", event);
		} else {
			formatJson("info", event);
		}
	},

	warn: (message: string, metadata?: Record<string, unknown>) => {
		const config = getLoggerConfig();
		if (!shouldLog("warn", config.level)) return;

		const event = { event_type: "warn", message, timestamp: Date.now(), ...metadata };
		if (config.format === "pretty") {
			formatPretty("warn", event);
		} else {
			formatJson("warn", event);
		}
	},

	error: (message: string, error?: Error, metadata?: Record<string, unknown>) => {
		const config = getLoggerConfig();
		// Errors always logged
		const event = {
			event_type: "error",
			message,
			timestamp: Date.now(),
			error_type: error?.name,
			error_message: error?.message,
			error_stack: error?.stack,
			...metadata,
		};
		if (config.format === "pretty") {
			formatPretty("error", event);
		} else {
			formatJson("error", event);
		}
	},
};

/**
 * Generate a unique operation ID
 */
export function generateOperationId(prefix = "op"): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
export function withLogging<TArgs extends Record<string, unknown>, TReturn>(
	operationName: string,
	operationType: "query" | "mutation",
	handler: (ctx: unknown, args: TArgs) => Promise<TReturn>,
) {
	return async (ctx: unknown, args: TArgs): Promise<TReturn> => {
		const operationId = generateOperationId();
		const timer = new ConvexTimer();
		const env = process.env.NODE_ENV || "development";

		const logContext: ConvexOperationLog = {
			operation_id: operationId,
			operation_type: operationType,
			operation_name: operationName,
			timestamp: Date.now(),
			duration_ms: 0,
			status: "success",
			service_name: "synapse-convex",
			environment: env,
		};

		// Extract request_id from args if available
		const argsObj = args as Record<string, unknown>;
		if (argsObj?.requestId) {
			logContext.request_id = argsObj.requestId as string;
		}

		// Extract common IDs from args
		if (argsObj?.conversationId) {
			logContext.conversation_id = argsObj.conversationId as string;
		}
		if (argsObj?.userId) {
			logContext.user_id = argsObj.userId as string;
		}
		if (argsObj?.nodeId) {
			logContext.document_id = argsObj.nodeId as string;
		}

		try {
			const result = await handler(ctx, args);
			logContext.duration_ms = timer.elapsed();
			logContext.status = "success";
			logConvexOperation(logContext);
			return result;
		} catch (error) {
			logContext.duration_ms = timer.elapsed();
			logContext.status = "error";
			logContext.error_type = error instanceof Error ? error.name : "Unknown";
			logContext.error_message =
				error instanceof Error ? error.message : String(error);
			logContext.error_stack = error instanceof Error ? error.stack : undefined;
			logConvexOperation(logContext);
			throw error;
		}
	};
}
