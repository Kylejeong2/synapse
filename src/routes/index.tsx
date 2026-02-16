import { useUser } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { LandingPage } from "@/components/landing/LandingPage";

export const Route = createFileRoute("/")({
	component: ConversationsPage,
});

function ConversationsPage() {
	const { isSignedIn, isLoaded } = useUser();

	if (!isLoaded) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	if (!isSignedIn) {
		return <LandingPage />;
	}

	return <DashboardPage />;
}
