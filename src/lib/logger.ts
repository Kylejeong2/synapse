/**
 * Wide Event Logging System
 *
 * Emits structured, context-rich log events instead of scattered console.log statements.
 * Each log is a "wide event" containing all context needed for debugging.
 *
 * Features:
 * - Dev mode: Pretty colored output with grouping for easy reading
 * - Prod mode: JSON structured logs with sampling to avoid Vercel limits
 * - Log levels: debug, info, warn, error
 * - Sampling: Configurable rate for success logs in production
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
	/** Sample rate for success logs (0-1). Errors always logged. */
	sampleRate: number;
	/** Enable verbose dev mode with extra context */
	devMode: boolean;
}

// ANSI color codes for terminal/console
const COLORS = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	gray: "\x1b[90m",
} as const;

const LEVEL_COLORS: Record<LogLevel, string> = {
	debug: COLORS.gray,
	info: COLORS.cyan,
	warn: COLORS.yellow,
	error: COLORS.red,
};

const LEVEL_ICONS: Record<LogLevel, string> = {
	debug: "🔍",
	info: "ℹ️ ",
	warn: "⚠️ ",
	error: "❌",
};

/**
 * Logger class for wide event logging
 */
export class Logger {
	private config: LoggerConfig;
	private static instance: Logger;
	private logCount = 0;
	private droppedCount = 0;

	constructor(config?: Partial<LoggerConfig>) {
		const isDev = this.checkIsDev();
		this.config = {
			level: config?.level || this.getDefaultLogLevel(),
			format: config?.format || this.getDefaultLogFormat(),
			environment: config?.environment || this.getEnvironment(),
			serviceName: config?.serviceName || "synapse",
			// In prod, sample 10% of success logs to avoid Vercel limits
			sampleRate: config?.sampleRate ?? this.getDefaultSampleRate(isDev),
			devMode: config?.devMode ?? isDev,
		};
	}

	private getDefaultSampleRate(isDev: boolean): number {
		try {
			const envRate = import.meta.env.VITE_LOG_SAMPLE_RATE;
			if (envRate !== undefined && !Number.isNaN(Number(envRate))) {
				return Math.max(0, Math.min(1, Number(envRate)));
			}
		} catch {
			// ignore
		}
		return isDev ? 1.0 : 0.1;
	}

	private checkIsDev(): boolean {
		try {
			return import.meta.env.DEV === true;
		} catch {
			return false;
		}
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

	/**
	 * Reset the singleton (useful for testing)
	 */
	static resetInstance(): void {
		Logger.instance = undefined as unknown as Logger;
	}

	private getDefaultLogLevel(): LogLevel {
		try {
			const envLevel = import.meta.env.VITE_LOG_LEVEL;
			if (envLevel && ["debug", "info", "warn", "error"].includes(envLevel)) {
				return envLevel as LogLevel;
			}
		} catch {
			// ignore
		}
		return this.checkIsDev() ? "debug" : "info";
	}

	private getDefaultLogFormat(): LogFormat {
		try {
			const envFormat = import.meta.env.VITE_LOG_FORMAT;
			if (envFormat && ["json", "pretty"].includes(envFormat)) {
				return envFormat as LogFormat;
			}
		} catch {
			// ignore
		}
		return this.checkIsDev() ? "pretty" : "json";
	}

	private getEnvironment(): "development" | "production" | "test" {
		try {
			if (import.meta.env.MODE === "test") return "test";
			return import.meta.env.DEV ? "development" : "production";
		} catch {
			return "production";
		}
	}

	private shouldLog(level: LogLevel): boolean {
		const levels: LogLevel[] = ["debug", "info", "warn", "error"];
		const configLevelIndex = levels.indexOf(this.config.level);
		const messageLevelIndex = levels.indexOf(level);
		return messageLevelIndex >= configLevelIndex;
	}

	/**
	 * Check if we should sample this log (for Vercel log dropping prevention)
	 */
	private shouldSample(isError: boolean): boolean {
		// Always log errors
		if (isError) return true;

		// In dev mode, log everything
		if (this.config.devMode) return true;

		// Sample based on rate
		return Math.random() < this.config.sampleRate;
	}

	private formatPretty(level: LogLevel, event: Record<string, unknown>): void {
		const color = LEVEL_COLORS[level];
		const icon = LEVEL_ICONS[level];
		const timestamp = new Date().toLocaleTimeString();
		const eventType = event.event_type || "log";

		// Header line with color
		const header = `${icon} ${color}[${level.toUpperCase()}]${COLORS.reset} ${COLORS.dim}${timestamp}${COLORS.reset} ${COLORS.bright}${eventType}${COLORS.reset}`;

		console.group(header);

		// Show key fields prominently
		const keyFields = [
			"message",
			"request_id",
			"operation_name",
			"duration_ms",
			"status",
			"error_message",
		];
		const shownFields = new Set<string>(["event_type", "timestamp", "level"]);

		for (const field of keyFields) {
			if (field in event && event[field] !== undefined) {
				const value = event[field];
				shownFields.add(field);

				if (field === "error_message" || field === "error_type") {
					console.log(`  ${COLORS.red}${field}:${COLORS.reset}`, value);
				} else if (field === "duration_ms") {
					const duration = value as number;
					const durationColor =
						duration > 1000
							? COLORS.red
							: duration > 200
								? COLORS.yellow
								: COLORS.green;
					console.log(
						`  ${field}: ${durationColor}${duration}ms${COLORS.reset}`,
					);
				} else if (field === "status") {
					const statusColor =
						value === "success"
							? COLORS.green
							: value === "error"
								? COLORS.red
								: COLORS.yellow;
					console.log(`  ${field}: ${statusColor}${value}${COLORS.reset}`);
				} else {
					console.log(`  ${COLORS.cyan}${field}:${COLORS.reset}`, value);
				}
			}
		}

		// Show remaining fields collapsed in dev mode
		const remaining: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(event)) {
			if (!shownFields.has(key) && value !== undefined) {
				remaining[key] = value;
			}
		}

		if (Object.keys(remaining).length > 0) {
			console.groupCollapsed(
				`  ${COLORS.dim}+ ${Object.keys(remaining).length} more fields${COLORS.reset}`,
			);
			console.log(remaining);
			console.groupEnd();
		}

		// Show stack trace for errors
		if (event.error_stack) {
			console.groupCollapsed(`  ${COLORS.red}Stack trace${COLORS.reset}`);
			console.log(event.error_stack);
			console.groupEnd();
		}

		console.groupEnd();
	}

	private formatJson(level: LogLevel, event: Record<string, unknown>): void {
		const logEntry = {
			level,
			ts: Date.now(),
			...event,
		};
		console.log(JSON.stringify(logEntry));
	}

	private formatLog(
		level: LogLevel,
		event: Record<string, unknown>,
		isError = false,
	): void {
		if (!this.shouldLog(level)) return;

		// Check sampling (track dropped logs)
		if (!this.shouldSample(isError)) {
			this.droppedCount++;
			return;
		}

		this.logCount++;

		if (this.config.format === "json") {
			this.formatJson(level, event);
		} else {
			this.formatPretty(level, event);
		}
	}

	/**
	 * Log a chat request (wide event)
	 */
	logChatRequest(event: ChatRequestLog): void {
		const level: LogLevel = event.status === "error" ? "error" : "info";
		this.formatLog(
			level,
			{
				event_type: "chat_request",
				...event,
			},
			event.status === "error",
		);
	}

	/**
	 * Log a Convex operation (wide event)
	 */
	logConvexOperation(event: ConvexOperationLog): void {
		const level: LogLevel = event.status === "error" ? "error" : "debug";
		this.formatLog(
			level,
			{
				event_type: "convex_operation",
				...event,
			},
			event.status === "error",
		);
	}

	/**
	 * Log a frontend error (wide event)
	 */
	logFrontendError(event: FrontendErrorLog): void {
		this.formatLog(
			"error",
			{
				event_type: "frontend_error",
				...event,
			},
			true,
		);
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
	 * Generic debug log - use for local debugging
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
		this.formatLog(
			"warn",
			{
				event_type: "warn",
				message,
				timestamp: Date.now(),
				...metadata,
			},
			false,
		);
	}

	/**
	 * Generic error log - always logged, never sampled
	 */
	error(
		message: string,
		error?: Error,
		metadata?: Record<string, unknown>,
	): void {
		this.formatLog(
			"error",
			{
				event_type: "error",
				message,
				timestamp: Date.now(),
				error_type: error?.name,
				error_message: error?.message,
				error_stack: error?.stack,
				...metadata,
			},
			true,
		);
	}

	/**
	 * Get logging stats (useful for debugging the logger itself)
	 */
	getStats(): { logged: number; dropped: number; sampleRate: number } {
		return {
			logged: this.logCount,
			dropped: this.droppedCount,
			sampleRate: this.config.sampleRate,
		};
	}

	/**
	 * Update sample rate dynamically (e.g., if approaching Vercel limits)
	 */
	setSampleRate(rate: number): void {
		this.config.sampleRate = Math.max(0, Math.min(1, rate));
	}
}

/**
 * Default logger instance
 */
export const logger = Logger.getInstance();

/**
 * Quick debug helper - logs with caller location in dev mode
 * Usage: log.debug("my message", { anyData })
 */
export const log = {
	debug: (message: string, data?: Record<string, unknown>) =>
		logger.debug(message, data),
	info: (message: string, data?: Record<string, unknown>) =>
		logger.info(message, data),
	warn: (message: string, data?: Record<string, unknown>) =>
		logger.warn(message, data),
	error: (message: string, error?: Error, data?: Record<string, unknown>) =>
		logger.error(message, error, data),
};

/**
 * Generate a unique request ID
 */
export function generateRequestId(prefix = "req"): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a unique operation ID
 */
export function generateOperationId(prefix = "op"): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a unique error ID
 */
export function generateErrorId(prefix = "err"): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
