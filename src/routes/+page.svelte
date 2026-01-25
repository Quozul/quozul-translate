<script lang="ts">
	import { type TranslationRequest, translationRequestSchema } from '$lib/translationRequestSchema';
	import { Language } from '$lib/Language';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import { sourceLanguage, targetLanguage } from '$lib/storable';
	import { AbortedError, smartFetch } from '$lib/fetch';
	import Copy from '$lib/components/icons/Copy.svelte';
	import Shuffle from '$lib/components/icons/Shuffle.svelte';
	import X from '$lib/components/icons/X.svelte';

	let sourceText = $state('');
	let translatedText = $state('');

	// State
	let isLoading = $state(false);
	let isError = $state(false);

	// Timers & Controllers
	let inputDebounceTimer: NodeJS.Timeout | null = null;
	let loadingDelayTimer: NodeJS.Timeout | null = null;
	let abortController: AbortController | null = null;

	const validLanguages = Language.getUniqueLanguages();

	// UX Configuration
	const INPUT_DEBOUNCE = 500;
	const SPINNER_DELAY = 100;
	const MIN_SPINNER_DURATION = 500;

	$effect(() => {
		const text = sourceText;

		if (text.trim().length === 0) {
			translatedText = '';
			isLoading = false;
			return;
		}

		if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
		if (loadingDelayTimer) clearTimeout(loadingDelayTimer);
		if (abortController) abortController.abort();

		const request: TranslationRequest = {
			text,
			source_language: $sourceLanguage,
			target_language: $targetLanguage
		};

		inputDebounceTimer = setTimeout(() => {
			isError = false;
			abortController = new AbortController();
			const currentSignal = abortController.signal;
			const requestStart = Date.now();

			let pendingText = '';

			loadingDelayTimer = setTimeout(() => {
				if (!currentSignal.aborted) {
					isLoading = true;
				}
			}, SPINNER_DELAY);

			smartFetch({
				input: '/api/translate',
				init: {
					method: 'POST',
					body: JSON.stringify(request),
					signal: currentSignal
				},
				timeout: 5000,
				schema: translationRequestSchema
			})
				.then((data) => {
					if (!currentSignal.aborted) {
						pendingText = data.text;
					}
				})
				.catch((e) => {
					if (!AbortedError.is(e)) {
						isError = true;
					}
				})
				.finally(() => {
					if (loadingDelayTimer) clearTimeout(loadingDelayTimer);

					if (currentSignal.aborted) {
						isLoading = false;
						return;
					}

					const completeRequest = () => {
						if (!isError && pendingText) {
							translatedText = pendingText;
						}
						isLoading = false;
					};

					if (isLoading) {
						const elapsed = Date.now() - requestStart;
						const totalRequiredTime = SPINNER_DELAY + MIN_SPINNER_DURATION;
						const remainingTime = Math.max(0, totalRequiredTime - elapsed);

						if (remainingTime > 0) {
							setTimeout(() => {
								if (!currentSignal.aborted) completeRequest();
							}, remainingTime);
						} else {
							completeRequest();
						}
					} else {
						completeRequest();
					}
				});
		}, INPUT_DEBOUNCE);

		return () => {
			if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
			if (loadingDelayTimer) clearTimeout(loadingDelayTimer);
		};
	});

	function swapLanguages() {
		let temp = $sourceLanguage;
		$sourceLanguage = $targetLanguage;
		$targetLanguage = temp;
	}
</script>

<main
	class="flex h-svh w-full items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-0 font-sans text-slate-200 antialiased sm:p-4"
>
	<div
		class="flex h-full w-full flex-col overflow-hidden bg-slate-900/50 shadow-2xl backdrop-blur-xl sm:h-auto sm:max-w-5xl sm:rounded-lg sm:border sm:border-slate-800"
	>
		<div
			class="grid grid-cols-[1fr_auto_1fr] items-center justify-between border-b border-slate-800/50 bg-slate-900/30"
		>
			<SearchableSelect
				options={validLanguages}
				bind:value={$sourceLanguage}
				placeholder="Select language..."
			/>

			<button
				class="w-full cursor-pointer px-4 py-3 font-sans text-sm"
				onclick={swapLanguages}
				aria-label="Swap languages"
			>
				<Shuffle />
			</button>

			<SearchableSelect
				options={validLanguages}
				bind:value={$targetLanguage}
				placeholder="Select language..."
			/>
		</div>

		<div
			class="grid min-h-0 flex-1 grid-cols-1 divide-y divide-slate-800/50 md:grid-cols-2 md:divide-x md:divide-y-0"
		>
			<div class="relative flex h-full p-4 md:p-6">
				<textarea
					bind:value={sourceText}
					placeholder="Type here..."
					class="scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent h-full w-full resize-none border-none bg-transparent text-lg leading-relaxed text-slate-200 placeholder-slate-600 outline-none md:min-h-80"
					spellcheck="false"
				></textarea>

				<div
					class="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-4 md:p-6"
				>
					<div class="flex gap-2">
						<button
							class="pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-800/50 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-emerald-400 active:scale-95"
							onclick={() => navigator.clipboard.readText().then((t) => (sourceText = t))}
							type="button"
						>
							<Copy />
							Paste
						</button>

						{#if sourceText.length > 0}
							<button
								class="pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-800/50 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-emerald-400 active:scale-95"
								onclick={() => (sourceText = '')}
								type="button"
							>
								<X />
								Clear
							</button>
						{/if}
					</div>

					<div class="text-xs font-medium text-slate-600">
						{sourceText.length} chars
					</div>
				</div>
			</div>

			<div class="relative flex h-full flex-col bg-slate-950/30 p-4 md:p-6">
				{#if isLoading}
					<div
						class="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300"
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
						class="pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-800/50 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-emerald-400 active:scale-95"
						onclick={() => navigator.clipboard.writeText(translatedText)}
						type="button"
					>
						<Copy />
						Copy
					</button>

					<div class="text-xs font-medium text-slate-600">
						{translatedText.length} chars
					</div>
				</div>
			</div>
		</div>
	</div>
</main>
