import { useNavigate } from "@tanstack/react-router";
import { Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface TreeViewButtonProps {
	conversationId: string;
}

export function TreeViewButton({ conversationId }: TreeViewButtonProps) {
	const navigate = useNavigate();

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="outline"
						size="icon"
						className="fixed bottom-6 left-6 rounded-full shadow-lg z-50"
						onClick={() =>
							navigate({ to: "/tree/$id", params: { id: conversationId } })
						}
					>
						<Network className="h-5 w-5" />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="right">View conversation tree</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
