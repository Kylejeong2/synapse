import { SignIn } from "@clerk/clerk-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface SignInModalProps {
	open: boolean;
	onClose: () => void;
}

export function SignInModal({ open, onClose }: SignInModalProps) {
	if (!open) return null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1715]/60 backdrop-blur-sm"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
			}}
		>
			<Card className="w-full max-w-md mx-4 border border-[#e8e3d9] shadow-2xl bg-[#faf8f3] text-[#1a1715]">
				<CardHeader className="text-center space-y-2 pb-4">
					<CardTitle className="text-3xl font-semibold">
						Welcome to Synapse
					</CardTitle>
					<CardDescription className="text-lg text-[#6b6560]">
						Sign in to start forking conversations
					</CardDescription>
				</CardHeader>
				<CardContent className="pb-8">
					<SignIn />
				</CardContent>
			</Card>
		</div>
	);
}
