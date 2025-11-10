import {
	QueryCache,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { toast } from "sonner";

export function getContext() {
	const queryClient = new QueryClient({
		queryCache: new QueryCache({
			onError: (error: unknown) => {
				const message =
					error instanceof Error ? error.message : "Request failed";
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
