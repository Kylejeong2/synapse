import { Code, Image, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ToolCallDisplayProps {
	toolCall: {
		type?: string;
		toolCallId?: string;
		toolName?: string;
		args?: unknown;
		[key: string]: unknown;
	};
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
	const getToolIcon = () => {
		const name = (toolCall.toolName || "").toLowerCase();
		if (name.includes("web") || name.includes("search")) {
			return <Search className="h-4 w-4" />;
		}
		if (name.includes("python") || name.includes("code")) {
			return <Code className="h-4 w-4" />;
		}
		if (name.includes("image") || name.includes("dall")) {
			return <Image className="h-4 w-4" />;
		}
		return <Loader2 className="h-4 w-4 animate-spin" />;
	};

	const getToolLabel = () => {
		const name = (toolCall.toolName || "").toLowerCase();
		if (name.includes("web") || name.includes("search")) {
			return "Searching the web";
		}
		if (name.includes("python") || name.includes("code")) {
			return "Executing Python code";
		}
		if (name.includes("image") || name.includes("dall")) {
			return "Generating image";
		}
		return "Using tool";
	};

	return (
		<Card className="p-3 bg-muted/50 border-dashed my-2">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				{getToolIcon()}
				<span>{getToolLabel()}...</span>
				<Badge variant="outline" className="ml-auto text-xs">
					{toolCall.toolName}
				</Badge>
			</div>
		</Card>
	);
}
