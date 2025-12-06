import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Toaster } from "@/components/ui/sonner";
import ClerkProvider from "../integrations/clerk/provider";
import ConvexProvider from "../integrations/convex/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

/**
 * Router context interface containing shared dependencies
 * @interface MyRouterContext
 * @property {QueryClient} queryClient - TanStack Query client instance for data fetching
 */
interface MyRouterContext {
	queryClient: QueryClient;
}

/**
 * Root route configuration for the application
 * Sets up document structure, meta tags, providers, and devtools
 */
export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Synapse - Fork Your Conversations",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	component: RootComponent,
	notFoundComponent: () => (
		<div className="flex items-center justify-center h-screen">
			<div className="text-center">
				<h1 className="text-4xl font-bold mb-2">404</h1>
				<p className="text-muted-foreground">Page not found</p>
			</div>
		</div>
	),
	shellComponent: RootDocument,
});

function RootComponent() {
	return <Outlet />;
}

/**
 * Root document component that wraps the entire application
 * Provides HTML structure and initializes all providers (Convex, Clerk)
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @returns {JSX.Element} The root HTML document with all providers
 */
function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<ConvexProvider>
					<ClerkProvider>
						{children}
						<Toaster />
						<TanStackDevtools
							config={{
								position: "bottom-right",
							}}
							plugins={[
								{
									name: "Tanstack Router",
									render: <TanStackRouterDevtoolsPanel />,
								},
								TanStackQueryDevtools,
							]}
						/>
					</ClerkProvider>
				</ConvexProvider>
				<Scripts />
			</body>
		</html>
	);
}
