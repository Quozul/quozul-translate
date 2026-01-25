<script lang="ts">
	import { fly } from 'svelte/transition';
	import type { Option } from '$lib/Option';
	import ChevronDown from '$lib/components/icons/ChevronDown.svelte';
	import CheckIcon from '$lib/components/icons/CheckIcon.svelte';

	let {
		options = [],
		value = $bindable(null),
		placeholder = 'Select an option...',
		notFoundText = 'No results found',
	} = $props();

	let isOpen = $state(false);
	let inputValue = $state('');
	let highlightedIndex = $state(0);
	let listElement = $state<HTMLUListElement>();
	let inputElement = $state<HTMLInputElement>();
	let isTyping = $state(false);

	let selectedOption = $derived(options.find((opt) => opt.id === value));

	let filteredOptions = $derived.by(() => {
		if (!isTyping || inputValue === '') return options;

		const lowerInput = inputValue.toLowerCase();
		return options.filter((opt) => opt.label.toLowerCase().includes(lowerInput));
	});

	$effect(() => {
		if (selectedOption && !isTyping && !isOpen) {
			inputValue = selectedOption.label;
		} else if (!value && !isTyping && !isOpen) {
			inputValue = '';
		}
	});

	$effect(() => {
		if (isOpen && listElement && Number.isInteger(highlightedIndex)) {
			scrollToHighlighted();
		}
	});

	function open() {
		if (isOpen) return;
		isOpen = true;
		isTyping = false;

		if (value) {
			const idx = options.findIndex((o) => o.id === value);
			if (idx >= 0) highlightedIndex = idx;
		} else {
			highlightedIndex = 0;
		}
	}

	function close() {
		isOpen = false;
		isTyping = false;
		highlightedIndex = 0;

		if (selectedOption) {
			inputValue = selectedOption.label;
		} else {
			inputValue = '';
		}
	}

	function selectOption(option: Option) {
		value = option.id;
		inputValue = option.label;
		isTyping = false;
		isOpen = false;
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		inputValue = target.value;
		isTyping = true;

		if (!isOpen) isOpen = true;
		highlightedIndex = 0;
	}

	function handleFocus() {
		open();
		inputElement?.select();
	}

	function handleBlur() {
		setTimeout(() => close(), 150);
	}

	function handleKeydown(e: KeyboardEvent) {
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
				break;
			case 'ArrowUp':
				e.preventDefault();
				highlightedIndex = (highlightedIndex - 1 + filteredOptions.length) % filteredOptions.length;
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

<div class="relative w-full font-sans text-sm">
	<div class="relative">
		<input
			bind:this={inputElement}
			value={inputValue}
			oninput={handleInput}
			onfocus={handleFocus}
			onblur={handleBlur}
			onkeydown={handleKeydown}
			type="text"
			{placeholder}
			class="w-full bg-slate-800 px-4 py-3 pr-10 text-slate-200 placeholder-slate-500 shadow-sm transition-all outline-none hover:border-slate-600 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
			autocomplete="off"
			role="combobox"
			aria-expanded={isOpen}
			aria-controls="options-list"
		/>

		<!-- Chevron -->
		<div
			class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 transition-transform duration-200"
			class:rotate-180={isOpen}
			class:text-blue-400={isOpen}
		>
			<ChevronDown />
		</div>
	</div>

	<!-- Dropdown -->
	{#if isOpen}
		<div
			transition:fly={{ y: 5, duration: 150 }}
			class="absolute left-0 z-50 mt-2 w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-xl ring-1 shadow-black/40 ring-white/5"
		>
			<ul
				id="options-list"
				bind:this={listElement}
				role="listbox"
				class="scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600 max-h-60 overflow-y-auto py-1"
			>
				{#if filteredOptions.length > 0}
					{#each filteredOptions as option, index (option.id)}
						{@const isActive = index === highlightedIndex}
						{@const isSelected = value === option.id}

						<li
							role="option"
							aria-selected={isSelected}
							class="group relative flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors select-none"
							class:bg-blue-600={isActive}
							class:text-white={isActive}
							class:text-slate-300={!isActive}
							onmousedown={(e) => {
								e.preventDefault();
								selectOption(option);
							}}
							onmouseenter={() => (highlightedIndex = index)}
						>
							<div class="flex flex-col">
								<span class="block truncate" class:font-medium={isSelected}>
									{option.label}
								</span>
								{#if option.description}
									<span class="truncate text-xs opacity-70">{option.description}</span>
								{/if}
							</div>

							{#if isSelected}
								<span class:text-white={isActive} class:text-blue-400={!isActive}>
									<CheckIcon />
								</span>
							{/if}
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
