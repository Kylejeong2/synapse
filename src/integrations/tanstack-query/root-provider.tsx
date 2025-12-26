import {
	QueryCache,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { generateErrorId, logger } from "../../lib/logger";

export function getContext() {
	const queryClient = new QueryClient({
		queryCache: new QueryCache({
			onError: (error: unknown, query) => {
				const message =
					error instanceof Error ? error.message : "Request failed";

				// Log structured error with full context
				const errorId = generateErrorId();
				logger.logFrontendError({
					error_id: errorId,
					timestamp: Date.now(),
					error_type: error instanceof Error ? error.name : "UnknownError",
					error_message: message,
					error_stack: error instanceof Error ? error.stack : undefined,
					query_key: JSON.stringify(query.queryKey),
					variables: query.state.data as Record<string, unknown> | undefined,
					pathname: window.location.pathname,
					user_agent: navigator.userAgent,
					viewport: {
						width: window.innerWidth,
						height: window.innerHeight,
					},
					service_name: "synapse-frontend",
					environment: import.meta.env.DEV ? "development" : "production",
				});

				// Still show toast to user
				toast.error(message);
			},
		}),
		defaultOptions: {
			queries: {
				staleTime: 60_000,
				refetchOnWindowFocus: false,
				retry: 1,
			},
			mutations: {
				retry: 0,
			},
		},
	});
	return {
		queryClient,
	};
}

export function Provider({
	children,
	queryClient,
}: {
	children: React.ReactNode;
	queryClient: QueryClient;
}) {
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
