/**
 * Wide Event Logging System
 * Based on principles from loggingsucks.com
 *
 * Emits structured, context-rich log events instead of scattered console.log statements.
 * Each log is a "wide event" containing all context needed for debugging.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFormat = "json" | "pretty";
export type LogStatus = "success" | "error" | "partial";

/**
 * Wide event schema for chat requests
 * One log per chat request with complete context
 */
export interface ChatRequestLog {
	// Request Identifiers
	request_id: string;
	conversation_id: string;
	node_id?: string;
	parent_node_id?: string;

	// User Context
	user_id?: string;
	session_id?: string;

	// Request Details
	timestamp: number;
	duration_ms: number;
	model: string;
	model_provider: string;
	prompt_length: number;

	// Response Details
	response_length: number;
	tokens_prompt: number;
	tokens_completion: number;
	tokens_thinking?: number;
	tokens_total: number;
	streaming: boolean;

	// Performance Metrics
	convex_query_duration_ms?: number;
	model_ttfb_ms?: number; // time to first byte
	convex_mutation_duration_ms?: number;

	// Business Context
	ancestor_count: number;
	depth: number;
	is_fork: boolean;
	is_root: boolean;

	// Status & Errors
	status: LogStatus;
	error_type?: string;
	error_message?: string;
	error_stack?: string;

	// Infrastructure
	service_name: string;
	environment: "development" | "production" | "test";
	vite_mode?: string;
}

/**
 * Wide event schema for Convex database operations
 */
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
	status: LogStatus;
	records_affected?: number;
	error_type?: string;
	error_message?: string;
	error_stack?: string;

	// Infrastructure
	service_name: string;
	environment: "development" | "production" | "test";
}

/**
 * Wide event schema for frontend errors
 */
export interface FrontendErrorLog {
	// Error Identifiers
	error_id: string;
	request_id?: string;
	timestamp: number;

	// Error Details
	error_type: string;
	error_message: string;
	error_stack?: string;

	// Context
	component?: string;
	user_action?: string;
	query_key?: string;
	variables?: Record<string, unknown>;

	// User Context
	user_id?: string;
	conversation_id?: string;
	pathname?: string;

	// Browser Context
	user_agent?: string;
	viewport?: { width: number; height: number };

	// Infrastructure
	service_name: string;
	environment: "development" | "production" | "test";
}

/**
 * Performance tracking helper
 */
export interface PerformanceLog {
	operation: string;
	duration_ms: number;
	timestamp: number;
	request_id?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Logger Configuration
 */
export interface LoggerConfig {
	level: LogLevel;
	format: LogFormat;
	environment: "development" | "production" | "test";
	serviceName: string;
}

/**
 * Logger class for wide event logging
 */
export class Logger {
	private config: LoggerConfig;
	private static instance: Logger;

	constructor(config?: Partial<LoggerConfig>) {
		this.config = {
			level: config?.level || this.getDefaultLogLevel(),
			format: config?.format || this.getDefaultLogFormat(),
			environment: config?.environment || this.getEnvironment(),
			serviceName: config?.serviceName || "synapse",
		};
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(config?: Partial<LoggerConfig>): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger(config);
		}
		return Logger.instance;
	}

	private getDefaultLogLevel(): LogLevel {
		const envLevel = import.meta.env.VITE_LOG_LEVEL;
		if (envLevel && ["debug", "info", "warn", "error"].includes(envLevel)) {
			return envLevel as LogLevel;
		}
		return import.meta.env.DEV ? "debug" : "info";
	}

	private getDefaultLogFormat(): LogFormat {
		const envFormat = import.meta.env.VITE_LOG_FORMAT;
		if (envFormat && ["json", "pretty"].includes(envFormat)) {
			return envFormat as LogFormat;
		}
		return import.meta.env.DEV ? "pretty" : "json";
	}

	private getEnvironment(): "development" | "production" | "test" {
		if (import.meta.env.MODE === "test") return "test";
		return import.meta.env.DEV ? "development" : "production";
	}

	private shouldLog(level: LogLevel): boolean {
		const levels: LogLevel[] = ["debug", "info", "warn", "error"];
		const configLevelIndex = levels.indexOf(this.config.level);
		const messageLevelIndex = levels.indexOf(level);
		return messageLevelIndex >= configLevelIndex;
	}

	private formatLog(level: LogLevel, event: unknown): void {
		if (!this.shouldLog(level)) return;

		if (this.config.format === "json") {
			// Structured JSON logging for production
			const logEntry = {
				level,
				...(event as Record<string, unknown>),
			};
			console.log(JSON.stringify(logEntry));
		} else {
			// Pretty logging for development
			const timestamp = new Date().toISOString();

			console.group(`[${level.toUpperCase()}] ${timestamp}`);
			console.log(event);
			console.groupEnd();
		}
	}

	/**
	 * Log a chat request (wide event)
	 */
	logChatRequest(event: ChatRequestLog): void {
		const level: LogLevel = event.status === "error" ? "error" : "info";
		this.formatLog(level, {
			event_type: "chat_request",
			...event,
		});
	}

	/**
	 * Log a Convex operation (wide event)
	 */
	logConvexOperation(event: ConvexOperationLog): void {
		const level: LogLevel = event.status === "error" ? "error" : "debug";
		this.formatLog(level, {
			event_type: "convex_operation",
			...event,
		});
	}

	/**
	 * Log a frontend error (wide event)
	 */
	logFrontendError(event: FrontendErrorLog): void {
		this.formatLog("error", {
			event_type: "frontend_error",
			...event,
		});
	}

	/**
	 * Log a performance metric
	 */
	logPerformance(event: PerformanceLog): void {
		this.formatLog("debug", {
			event_type: "performance",
			...event,
		});
	}

	/**
	 * Generic debug log
	 */
	debug(message: string, metadata?: Record<string, unknown>): void {
		this.formatLog("debug", {
			event_type: "debug",
			message,
			timestamp: Date.now(),
			...metadata,
		});
	}

	/**
	 * Generic info log
	 */
	info(message: string, metadata?: Record<string, unknown>): void {
		this.formatLog("info", {
			event_type: "info",
			message,
			timestamp: Date.now(),
			...metadata,
		});
	}

	/**
	 * Generic warn log
	 */
	warn(message: string, metadata?: Record<string, unknown>): void {
		this.formatLog("warn", {
			event_type: "warn",
			message,
			timestamp: Date.now(),
			...metadata,
		});
	}

	/**
	 * Generic error log
	 */
	error(
		message: string,
		error?: Error,
		metadata?: Record<string, unknown>,
	): void {
		this.formatLog("error", {
			event_type: "error",
			message,
			timestamp: Date.now(),
			error_type: error?.name,
			error_message: error?.message,
			error_stack: error?.stack,
			...metadata,
		});
	}
}

/**
 * Default logger instance
 */
export const logger = Logger.getInstance();

/**
 * Generate a unique request ID
 */
export function generateRequestId(prefix = "req"): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique operation ID
 */
export function generateOperationId(prefix = "op"): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique error ID
 */
export function generateErrorId(prefix = "err"): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Timer utility for tracking operation duration
 */
export class Timer {
	private startTime: number;
	private marks: Map<string, number> = new Map();

	constructor() {
		this.startTime = Date.now();
	}

	/**
	 * Mark a point in time
	 */
	mark(name: string): void {
		this.marks.set(name, Date.now());
	}

	/**
	 * Get duration from start
	 */
	elapsed(): number {
		return Date.now() - this.startTime;
	}

	/**
	 * Get duration between two marks
	 */
	duration(startMark?: string, endMark?: string): number {
		const start = startMark
			? this.marks.get(startMark) || this.startTime
			: this.startTime;
		const end = endMark ? this.marks.get(endMark) || Date.now() : Date.now();
		return end - start;
	}

	/**
	 * Get all marks with durations
	 */
	getMarks(): Record<string, number> {
		const result: Record<string, number> = {};
		for (const [name, time] of this.marks.entries()) {
			result[name] = time - this.startTime;
		}
		return result;
	}
}
