/**
 * Bridge for the mobile navigation dock to the existing search UI.
 * The search component already owns the panel state, so we trigger its
 * public mobile button instead of duplicating the Pagefind/search logic.
 */
export function requestSearchModalToggle(): void {
	if (typeof document === "undefined") return;

	const searchButton = document.getElementById("search-switch");
	if (searchButton instanceof HTMLButtonElement) {
		searchButton.click();
		return;
	}

	// Search.svelte may be mounted slightly after the dock on a Swup visit.
	window.setTimeout(() => {
		const button = document.getElementById("search-switch");
		if (button instanceof HTMLButtonElement) button.click();
	}, 0);
}
