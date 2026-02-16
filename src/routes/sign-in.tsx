import { SignIn } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, GitBranch } from "lucide-react";
import type { ComponentProps } from "react";
import "@/components/landing/landing.css";
import { useTheme } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/sign-in")({
	component: SignInPage,
});

type ClerkAppearance = ComponentProps<typeof SignIn>["appearance"];

const darkAppearance: ClerkAppearance = {
	variables: {
		colorBackground: "#2a2623",
		colorInputBackground: "#332e2b",
		colorText: "#f0ece4",
		colorTextSecondary: "#b5aea6",
		colorPrimary: "#d4773a",
		colorInputText: "#f0ece4",
		colorNeutral: "#f0ece4",
	},
	elements: {
		card: "shadow-none bg-transparent",
		headerTitle: "text-[#f0ece4]",
		headerSubtitle: "text-[#b5aea6]",
		socialButtonsBlockButton:
			"border-[#4a443f] bg-[#332e2b] text-[#f0ece4] hover:bg-[#3d3936]",
		formFieldLabel: "text-[#b5aea6]",
		formFieldInput:
			"bg-[#332e2b] border-[#4a443f] text-[#f0ece4] placeholder:text-[#9c958e]",
		formButtonPrimary: "bg-[#d4773a] hover:bg-[#c4642a]",
		footerActionLink: "text-[#d4773a] hover:text-[#c4642a]",
		footerActionText: "text-[#b5aea6]",
		dividerLine: "bg-[#4a443f]",
		dividerText: "text-[#9c958e]",
		footer: "hidden",
	},
};

const lightAppearance: ClerkAppearance = {
	variables: {
		colorBackground: "#faf8f3",
		colorInputBackground: "#ffffff",
		colorText: "#1a1715",
		colorTextSecondary: "#6b6560",
		colorPrimary: "#c4642a",
		colorInputText: "#1a1715",
		colorNeutral: "#1a1715",
	},
	elements: {
		card: "shadow-none bg-transparent",
		formButtonPrimary: "bg-[#1a1715] hover:bg-[#262220] text-[#faf8f3]",
		socialButtonsBlockButton:
			"border-[#e8e3d9] text-[#1a1715] hover:bg-[#f0ece4]",
		formFieldInput: "border-[#e8e3d9]",
		footerActionLink: "text-[#c4642a] hover:text-[#a8532a]",
		dividerLine: "bg-[#e8e3d9]",
		footer: "hidden",
	},
};

function SignInPage() {
	const { resolvedTheme } = useTheme();
	const clerkAppearance =
		resolvedTheme === "dark" ? darkAppearance : lightAppearance;

	return (
		<div className="landing min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)] flex flex-col">
			<nav className="sticky top-0 z-50 border-b border-[var(--landing-border)] bg-[var(--landing-bg)]/90 backdrop-blur-sm">
				<div className="w-full landing-section h-16 flex items-center justify-between">
					<Link to="/" className="flex items-center gap-3">
						<div className="h-9 w-9 rounded-md bg-[var(--landing-dark-bg)] flex items-center justify-center">
							<GitBranch className="h-4.5 w-4.5 text-[var(--landing-text-on-dark)]" />
						</div>
						<span className="text-xl font-semibold tracking-tight">
							Synapse
						</span>
					</Link>
					<div className="flex items-center gap-3">
						<ThemeToggle />
						<Link
							to="/"
							className="text-lg text-[var(--landing-text-secondary)] hover:text-[var(--landing-text)] px-3 py-2 hidden sm:flex items-center gap-2"
						>
							<ArrowLeft className="h-4 w-4" />
							Back
						</Link>
					</div>
				</div>
			</nav>

			<div className="flex-1 flex items-center justify-center py-16">
				<Card className="w-full max-w-md mx-4 border border-[var(--landing-border)] shadow-2xl bg-[var(--landing-bg)] text-[var(--landing-text)]">
					<CardHeader className="text-center space-y-2 pb-4">
						<CardTitle className="text-3xl font-semibold">
							Welcome to Synapse
						</CardTitle>
						<CardDescription className="text-lg text-[var(--landing-text-secondary)]">
							Sign in to start forking conversations
						</CardDescription>
					</CardHeader>
					<CardContent className="pb-8">
						<SignIn appearance={clerkAppearance} />
					</CardContent>
				</Card>
			</div>

			<footer className="border-t border-[var(--landing-border)] py-10 landing-section">
				<div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
					<div className="flex items-center gap-2.5">
						<div className="h-7 w-7 rounded bg-[var(--landing-dark-bg)] flex items-center justify-center">
							<GitBranch className="h-3.5 w-3.5 text-[var(--landing-text-on-dark)]" />
						</div>
						<span className="text-lg font-medium">Synapse</span>
					</div>
					<p className="text-base text-[var(--landing-text-tertiary)]">
						Built for curious minds.
					</p>
				</div>
			</footer>
		</div>
	);
}
