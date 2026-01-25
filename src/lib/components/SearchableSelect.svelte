<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';
	import type { Option } from '$lib/Option';
	import ChevronDown from '$lib/components/icons/ChevronDown.svelte';

	// --- Props ---
	export let options: Option[] = [];
	export let value: string | number | null = null;
	export let placeholder = 'Select an option...';
	export let notFoundText = 'No results found';

	// --- State ---
	let isOpen = false;
	let inputValue = '';
	let highlightedIndex = 0;
	let listElement: HTMLUListElement;
	let inputElement: HTMLInputElement;

	const dispatch = createEventDispatcher<{
		change: Option;
	}>();

	// --- Computed ---
	// 1. Find the selected object based on ID
	$: selectedOption = options.find((opt) => opt.id === value);

	// 2. Sync input text with selected value when NOT editing
	$: if (selectedOption && !isOpen) {
		inputValue = selectedOption.label;
	} else if (!value && !isOpen) {
		inputValue = '';
	}

	// 3. Filter options based on current input text
	$: filteredOptions = options.filter((opt) =>
		opt.label.toLowerCase().includes(inputValue.toLowerCase())
	);

	// --- Methods ---

	function open() {
		isOpen = true;
		highlightedIndex = 0;
	}

	function close() {
		isOpen = false;
		// On close, validate: revert text to the selected option's label
		if (selectedOption) {
			inputValue = selectedOption.label;
		} else {
			inputValue = '';
		}
		inputElement?.blur();
	}

	function selectOption(option: Option) {
		value = option.id;
		inputValue = option.label; // Update text immediately
		isOpen = false;
		dispatch('change', option);
	}

	// Handle Input Typing
	function handleInput() {
		if (!isOpen) isOpen = true;
		highlightedIndex = 0; // Reset highlight on search change
	}

	// Handle Focus (clicking the box)
	function handleFocus() {
		open();
		// Optional: Select all text on click for easy replacement
		inputElement.select();
	}

	// Handle Blur (clicking away)
	function handleBlur() {
		// We need a slight delay to allow a click on an option to register
		// before the menu disappears.
		setTimeout(() => {
			close();
		}, 150);
	}

	function handleKeydown(e: KeyboardEvent) {
		// If closed and pressing generic keys, open it
		if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
			e.preventDefault();
			open();
			return;
		}

		if (!isOpen) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				highlightedIndex = (highlightedIndex + 1) % filteredOptions.length;
				scrollToHighlighted();
				break;
			case 'ArrowUp':
				e.preventDefault();
				highlightedIndex = (highlightedIndex - 1 + filteredOptions.length) % filteredOptions.length;
				scrollToHighlighted();
				break;
			case 'Enter':
				e.preventDefault();
				if (filteredOptions.length > 0) {
					selectOption(filteredOptions[highlightedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				close();
				break;
			case 'Tab':
				close();
				break;
		}
	}

	function scrollToHighlighted() {
		if (!listElement) return;
		const item = listElement.children[highlightedIndex] as HTMLElement;
		if (item) {
			item.scrollIntoView({ block: 'nearest' });
		}
	}
</script>

<div class="group relative w-full font-sans text-sm">
	<!-- Input Container -->
	<div class="relative">
		<input
			bind:this={inputElement}
			bind:value={inputValue}
			on:input={handleInput}
			on:focus={handleFocus}
			on:blur={handleBlur}
			on:keydown={handleKeydown}
			type="text"
			{placeholder}
			class="w-full cursor-pointer border-slate-700 bg-slate-800 px-4 py-3 pr-10 text-slate-200 placeholder-slate-500 transition-all outline-none hover:bg-slate-700/80 focus:border-blue-500 focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20"
		/>

		<!-- Chevron Icon (Absolute positioned over input) -->
		<div
			class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-slate-500 transition-transform duration-200 {isOpen
				? 'rotate-180 text-blue-400'
				: ''}"
		>
			<ChevronDown />
		</div>
	</div>

	<!-- Dropdown Menu -->
	{#if isOpen}
		<div
			transition:fly={{ y: 10, duration: 200 }}
			class="absolute left-0 z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl ring-1 shadow-black/50 ring-black/5"
		>
			<ul
				bind:this={listElement}
				role="listbox"
				class="scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600 max-h-60 overflow-y-auto py-1"
			>
				{#if filteredOptions.length > 0}
					{#each filteredOptions as option, index (option.id)}
						<!-- Note: MouseDown is used instead of Click to ensure it fires before the input Blur event -->
						<li
							role="option"
							aria-selected={value === option.id}
							class="relative cursor-pointer px-4 py-2.5 transition-colors select-none
                {index === highlightedIndex
								? 'bg-blue-600 text-white'
								: 'text-slate-300 hover:bg-slate-700/50'}
                {value === option.id && index !== highlightedIndex ? 'text-blue-400' : ''}"
							on:mousedown|preventDefault={() => selectOption(option)}
							on:mouseenter={() => (highlightedIndex = index)}
						>
							<div class="flex items-center justify-between">
								<span class="block truncate {value === option.id ? 'font-medium' : 'font-normal'}">
									{option.label}
								</span>
								{#if value === option.id}
									<span
										class="flex items-center pl-2 {index === highlightedIndex
											? 'text-white'
											: 'text-blue-400'}"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="3"
											stroke-linecap="round"
											stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg
										>
									</span>
								{/if}
							</div>
						</li>
					{/each}
				{:else}
					<li class="px-4 py-8 text-center text-sm text-slate-500 select-none">
						{notFoundText}
					</li>
				{/if}
			</ul>
		</div>
	{/if}
</div>
