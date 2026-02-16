import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface CodeBlockProps {
	inline?: boolean;
	className?: string;
	children?: React.ReactNode;
}

export function CodeBlock({
	inline,
	className,
	children,
	...props
}: CodeBlockProps) {
	const [copied, setCopied] = useState(false);

	const match = /language-(\w+)/.exec(className || "");
	const language = match ? match[1] : "";

	const codeString = String(children).replace(/\n$/, "");

	const handleCopy = async () => {
		await navigator.clipboard.writeText(codeString);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	if (inline) {
		return (
			<code
				className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-destructive"
				{...props}
			>
				{children}
			</code>
		);
	}

	return (
		<div className="relative group my-4 text-sm">
			<div className="flex items-center justify-between bg-secondary text-secondary-foreground px-4 py-2 rounded-t-md">
				<span className="text-xs font-sans">{language || "plaintext"}</span>
				<button
					type="button"
					onClick={handleCopy}
					className="flex items-center gap-1 text-xs hover:text-white transition-colors"
				>
					{copied ? (
						<>
							<Check className="h-3 w-3" />
							Copied!
						</>
					) : (
						<>
							<Copy className="h-3 w-3" />
							Copy code
						</>
					)}
				</button>
			</div>
			<div className="overflow-x-auto">
				<SyntaxHighlighter
					style={oneDark}
					language={language || "plaintext"}
					PreTag="div"
					showLineNumbers={false}
					customStyle={{
						margin: 0,
						borderRadius: "0 0 0.375rem 0.375rem",
						background: "#1e1e1e",
						fontSize: "14px",
						padding: "1rem",
					}}
					{...props}
				>
					{codeString}
				</SyntaxHighlighter>
			</div>
		</div>
	);
}

// Custom components for ReactMarkdown
export const markdownComponents = {
	code: CodeBlock,
	h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h1 className="text-2xl font-semibold mt-6 mb-4 first:mt-0" {...props}>
			{children}
		</h1>
	),
	h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h2 className="text-xl font-semibold mt-5 mb-3 first:mt-0" {...props}>
			{children}
		</h2>
	),
	h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h3 className="text-lg font-semibold mt-4 mb-2 first:mt-0" {...props}>
			{children}
		</h3>
	),
	h4: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h4 className="text-base font-semibold mt-3 mb-2 first:mt-0" {...props}>
			{children}
		</h4>
	),
	p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
		<p className="mb-4 leading-[1.8] last:mb-0" {...props}>
			{children}
		</p>
	),
	ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
		<ul className="list-disc pl-6 mb-4 space-y-1" {...props}>
			{children}
		</ul>
	),
	ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
		<ol className="list-decimal pl-6 mb-4 space-y-1" {...props}>
			{children}
		</ol>
	),
	li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
		<li className="leading-[1.8] ml-2" {...props}>
			{children}
		</li>
	),
	blockquote: ({
		children,
		...props
	}: React.HTMLAttributes<HTMLQuoteElement>) => (
		<blockquote
			className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground"
			{...props}
		>
			{children}
		</blockquote>
	),
	a: ({
		children,
		href,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a
			href={href}
			className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
			target="_blank"
			rel="noopener noreferrer"
			{...props}
		>
			{children}
		</a>
	),
	hr: ({ ...props }: React.HTMLAttributes<HTMLHRElement>) => (
		<hr className="my-8 border-border" {...props} />
	),
	table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
		<div className="overflow-x-auto my-4">
			<table className="w-full border-collapse border border-border" {...props}>
				{children}
			</table>
		</div>
	),
	thead: ({
		children,
		...props
	}: React.HTMLAttributes<HTMLTableSectionElement>) => (
		<thead className="bg-muted" {...props}>
			{children}
		</thead>
	),
	th: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
		<th
			className="border border-border px-4 py-2 text-left font-semibold"
			{...props}
		>
			{children}
		</th>
	),
	td: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
		<td className="border border-border px-4 py-2" {...props}>
			{children}
		</td>
	),
	pre: ({ children }: React.HTMLAttributes<HTMLPreElement>) => <>{children}</>,
};
