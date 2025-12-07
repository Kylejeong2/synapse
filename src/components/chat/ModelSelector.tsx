import { Brain, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	MODELS,
	MODELS_BY_PROVIDER,
	type ModelId,
	type ModelProvider,
	PROVIDER_NAMES,
} from "@/lib/constants/models";

interface ModelSelectorProps {
	selectedModel: ModelId;
	onModelChange: (model: ModelId) => void;
}

const PROVIDER_ORDER: ModelProvider[] = [
	"openai",
	"anthropic",
	"xai",
	"google",
];

export function ModelSelector({
	selectedModel,
	onModelChange,
}: ModelSelectorProps) {
	const currentModel = MODELS[selectedModel];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
				>
					{currentModel.thinking && (
						<Brain className="h-3.5 w-3.5 text-violet-500" />
					)}
					<span className="text-sm font-medium">{currentModel.name}</span>
					<ChevronDown className="h-3.5 w-3.5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				{PROVIDER_ORDER.map((provider, providerIndex) => {
					const models = MODELS_BY_PROVIDER[provider];
					if (!models?.length) return null;

					return (
						<div key={provider}>
							{providerIndex > 0 && <DropdownMenuSeparator />}
							<DropdownMenuLabel className="text-xs text-muted-foreground">
								{PROVIDER_NAMES[provider]}
							</DropdownMenuLabel>
							<DropdownMenuGroup>
								{models.map((model) => (
									<DropdownMenuItem
										key={model.id}
										onClick={() => onModelChange(model.id)}
										className="flex items-center justify-between cursor-pointer"
									>
										<div className="flex items-center gap-2">
											{model.thinking && (
												<Brain className="h-3.5 w-3.5 text-violet-500" />
											)}
											<span>{model.name}</span>
										</div>
										{selectedModel === model.id && (
											<Check className="h-4 w-4 text-primary" />
										)}
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						</div>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
