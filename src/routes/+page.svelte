<script lang="ts">
	import { type TranslationRequest, translationRequestSchema } from '$lib/translationRequestSchema';
	import { Language } from '$lib/Language';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import { sourceLanguage, targetLanguage } from '$lib/storable';

	let sourceText = $state('');
	let translatedText = $state('');
	let debounceTimer: NodeJS.Timeout | null = null;
	let isLoading = $state(false);
	let isError = $state(false);
	let abortController: AbortController | null = null;

	const validLanguages = Language.getUniqueLanguages();

	$effect(() => {
		const text = sourceText;

		if (text.trim().length === 0) {
			translatedText = "";
			return;
		}

		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
		}

		if (abortController !== null) {
			abortController.abort();
		}

		const request: TranslationRequest = {
			text,
			source_language: $sourceLanguage,
			target_language: $targetLanguage
		};

		debounceTimer = setTimeout(() => {
			isLoading = true;
			isError = false;
			abortController = new AbortController();
			fetch('/api/translate', {
				method: 'POST',
				body: JSON.stringify(request),
				signal: abortController.signal
			})
				.then((response: Response) => response.json())
				.then((data) => {
					const { text } = translationRequestSchema.parse(data);
					translatedText = text;
				}).catch(() => {
				isError = true;
			})
				.finally(() => {
					isLoading = false;
				});
		}, 500);
	});
</script>

<main
	class="flex h-svh w-full items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-0 font-sans text-slate-200 antialiased sm:p-4"
>
	<div
		class="flex h-full w-full flex-col overflow-hidden bg-slate-900/50 shadow-2xl backdrop-blur-xl sm:h-auto sm:max-w-5xl sm:rounded-lg sm:border sm:border-slate-800"
	>
		<div
			class="grid shrink-0 grid-cols-2 items-center justify-between border-b border-slate-800/50 bg-slate-900/30"
		>
			<SearchableSelect
				options={validLanguages}
				bind:value={$sourceLanguage}
				placeholder="Select language..."
			/>

			<SearchableSelect
				options={validLanguages}
				bind:value={$targetLanguage}
				placeholder="Select language..."
			/>
		</div>

		<div
			class="grid min-h-0 flex-1 grid-cols-1 divide-y divide-slate-800/50 md:grid-cols-2 md:divide-x md:divide-y-0"
		>
			<div class="relative flex h-full flex-col p-4 md:p-6">
				<textarea
					bind:value={sourceText}
					placeholder="Type here..."
					class="scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent h-full w-full resize-none border-none bg-transparent text-lg leading-relaxed text-slate-200 placeholder-slate-600 outline-none md:min-h-80"
					spellcheck="false"
				></textarea>

				<div
					class="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-4 md:p-6"
				>
					<button
						class="pointer-events-auto cursor-pointer flex items-center gap-1.5 rounded-md bg-slate-800/50 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-emerald-400 active:scale-95"
						onclick={() => navigator.clipboard.readText().then((t) => (sourceText = t))}
						type="button"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="lucide lucide-clipboard"
						>
							<rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
							<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
						</svg>
						Paste
					</button>

					<div class="text-xs font-medium text-slate-600">
						{sourceText.length} chars
					</div>
				</div>
			</div>

			<div class="relative flex h-full flex-col bg-slate-950/30 p-4 md:p-6">
				{#if isLoading}
					<div
						class="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
					>
						<div class="flex flex-col items-center gap-3">
							<div
								class="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500"
							></div>
							<span class="animate-pulse text-sm font-medium text-emerald-500">Translating...</span>
						</div>
					</div>
				{/if}
				{#if isError}
					<div
						class="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
					>
						<div class="flex flex-col items-center gap-3">
							<span class="text-sm font-medium text-red-500">Oops, translation failed!</span>
						</div>
					</div>
				{/if}
				<textarea
					bind:value={translatedText}
					placeholder="Translation result..."
					class="scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent h-full w-full resize-none border-none bg-transparent text-lg leading-relaxed text-emerald-100/90 placeholder-slate-700 outline-none md:min-h-80"
				></textarea>

				<div
					class="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-4 md:p-6"
				>
					<button
						class="pointer-events-auto cursor-pointer flex items-center gap-1.5 rounded-md bg-slate-800/50 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-emerald-400 active:scale-95"
						onclick={() => navigator.clipboard.writeText(translatedText)}
						type="button"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="lucide lucide-clipboard"
						>
							<rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
							<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
						</svg>
						Copy
					</button>

					<div class="text-xs font-medium text-slate-600">
						{sourceText.length} chars
					</div>
				</div>
			</div>
		</div>
	</div>
</main>
