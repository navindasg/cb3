// Thin DOM bootstrap. The real load → catch-up → loop → render wiring lands in
// Phase 1 Block H (app bootstrap). For now this is a placeholder so the page runs
// and shows the series' opening line.
const main = document.querySelector<HTMLElement>('#main-content')
if (main) main.textContent = 'You have 1 candy.'
