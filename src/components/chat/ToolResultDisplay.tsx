import { CheckCircle2, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface SearchResultItem {
	url?: string;
	link?: string;
	title?: string;
	snippet?: string;
}

interface ToolResultDisplayProps {
	result: {
		type?: string;
		toolCallId?: string;
		toolName?: string;
		result?: unknown;
		[key: string]: unknown;
	};
}

export function ToolResultDisplay({ result }: ToolResultDisplayProps) {
	const renderResult = () => {
		// Handle different result types
		if (!result.result) return null;

		// Image results
		if (
			(result.toolName || "").includes("image") ||
			(result.toolName || "").includes("dall")
		) {
			if (
				typeof result.result === "string" &&
				result.result.startsWith("http")
			) {
				return (
					<img
						src={result.result}
						alt="AI generated content"
						className="max-w-full rounded-lg"
					/>
				);
			}
			if (
				typeof result.result === "object" &&
				result.result !== null &&
				"url" in result.result
			) {
				const resultObj = result.result as { url: string };
				return (
					<img
						src={resultObj.url}
						alt="AI generated content"
						className="max-w-full rounded-lg"
					/>
				);
			}
		}

		// Python code output
		if (
			(result.toolName || "").includes("python") ||
			(result.toolName || "").includes("code")
		) {
			const output =
				typeof result.result === "string"
					? result.result
					: JSON.stringify(result.result, null, 2);

			return (
				<div className="prose prose-sm dark:prose-invert max-w-none">
					<ReactMarkdown
						rehypePlugins={[rehypeHighlight]}
						remarkPlugins={[remarkGfm]}
					>
						{`\`\`\`python\n${output}\n\`\`\``}
					</ReactMarkdown>
				</div>
			);
		}

		// Web search results
		if (
			(result.toolName || "").includes("web") ||
			(result.toolName || "").includes("search")
		) {
			// Handle array of search results
			if (Array.isArray(result.result)) {
				return (
					<div className="space-y-2">
						{result.result.slice(0, 3).map((item, idx) => {
							const searchItem = item as SearchResultItem;
							const itemUrl = searchItem.url || searchItem.link || "#";
							return (
								<a
									key={`${result.toolCallId || "result"}-${itemUrl}-${idx}`}
									href={itemUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors group"
								>
									<ExternalLink className="h-4 w-4 mt-1 shrink-0 text-muted-foreground group-hover:text-primary" />
									<div className="flex-1 min-w-0">
										<div className="font-medium text-sm line-clamp-1 group-hover:text-primary">
											{searchItem.title}
										</div>
										{searchItem.snippet && (
											<div className="text-xs text-muted-foreground line-clamp-2">
												{searchItem.snippet}
											</div>
										)}
									</div>
								</a>
							);
						})}
					</div>
				);
			}

			// Handle single result or object
			const output =
				typeof result.result === "string"
					? result.result
					: JSON.stringify(result.result, null, 2);

			return (
				<div className="text-sm text-muted-foreground whitespace-pre-wrap">
					{output}
				</div>
			);
		}

		// Default: JSON output
		return (
			<div className="text-sm text-muted-foreground">
				<pre className="whitespace-pre-wrap">
					{JSON.stringify(result.result, null, 2)}
				</pre>
			</div>
		);
	};

	return (
		<Card className="p-4 my-2 border-l-4 border-l-green-500">
			<div className="flex items-center gap-2 mb-2">
				<CheckCircle2 className="h-4 w-4 text-green-500" />
				<span className="text-sm font-medium">Tool Result</span>
				<Badge variant="secondary" className="ml-auto text-xs">
					{result.toolName}
				</Badge>
			</div>
			<div className="mt-2">{renderResult()}</div>
		</Card>
	);
}
