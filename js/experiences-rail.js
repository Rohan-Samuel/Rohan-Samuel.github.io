// Compute and set CSS variables so the experiences vertical rail
// starts after the header and ends at the bottom of the last .year.
(function () {
    const experiences = document.querySelector('.experiences');
    if (!experiences) return;

    const header = document.querySelector('header');

    function updateRail() {
        const expRect = experiences.getBoundingClientRect();
        const headerRect = header ? header.getBoundingClientRect() : { bottom: expRect.top };
        const lastYear = experiences.querySelector('.year:last-of-type');

        if (!lastYear) {
            // hide the rail by collapsing it
            experiences.style.setProperty('--experiences-rail-top', '0px');
            experiences.style.setProperty('--experiences-rail-bottom', '0px');
            return;
        }

        const lastRect = lastYear.getBoundingClientRect();

        // distance from experiences top to header bottom (so rail starts just after header)
        const topPx = Math.max(0, Math.round(headerRect.bottom - expRect.top + 4));

        // distance from experiences bottom to last year's bottom (so rail ends at last year)
        const bottomPx = Math.max(0, Math.round(expRect.bottom - lastRect.bottom + 4));

        experiences.style.setProperty('--experiences-rail-top', `${topPx}px`);
        experiences.style.setProperty('--experiences-rail-bottom', `${bottomPx}px`);
    }

    // update on load and resize
    window.addEventListener('load', updateRail);
    window.addEventListener('resize', updateRail);

    // observe content changes that might affect heights
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(updateRail);
        ro.observe(document.documentElement);
        ro.observe(experiences);
        if (header) ro.observe(header);
    } else {
        // fallback: periodic update
        const id = setInterval(updateRail, 800);
        window.addEventListener('beforeunload', () => clearInterval(id));
    }

    // initial run
    updateRail();
})();