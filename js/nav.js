(function () {
    var nav = document.getElementById('site-nav');
    var toggle = document.getElementById('nav-toggle');
    var menu = document.getElementById('nav-menu');
    var scrim = document.getElementById('nav-scrim');

    if (!nav || !toggle || !menu || !scrim) {
        return;
    }

    var submenuToggles = Array.prototype.slice.call(nav.querySelectorAll('.nav-submenu-toggle'));
    var mobileQuery = window.matchMedia('(max-width: 860px)');

    function isMobile() {
        return mobileQuery.matches;
    }

    function setSubmenu(button, expanded) {
        button.setAttribute('aria-expanded', String(expanded));
        button.setAttribute('aria-label', expanded ? 'Hide work categories' : 'Show work categories');
    }

    function closeSubmenus() {
        submenuToggles.forEach(function (button) {
            setSubmenu(button, false);
        });
    }

    function openMenu() {
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Close menu');
        menu.classList.add('is-open');
        scrim.hidden = false;
        // Force a reflow so the scrim transitions in rather than snapping.
        void scrim.offsetWidth;
        scrim.classList.add('is-visible');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu(returnFocus) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
        menu.classList.remove('is-open');
        scrim.classList.remove('is-visible');
        document.body.style.overflow = '';
        closeSubmenus();

        if (returnFocus) {
            toggle.focus();
        }
    }

    function isMenuOpen() {
        return toggle.getAttribute('aria-expanded') === 'true';
    }

    scrim.addEventListener('transitionend', function () {
        if (!scrim.classList.contains('is-visible')) {
            scrim.hidden = true;
        }
    });

    toggle.addEventListener('click', function () {
        if (isMenuOpen()) {
            closeMenu(false);
        } else {
            openMenu();
        }
    });

    scrim.addEventListener('click', function () {
        closeMenu(false);
    });

    submenuToggles.forEach(function (button) {
        button.addEventListener('click', function () {
            var expanded = button.getAttribute('aria-expanded') === 'true';
            if (!expanded) {
                closeSubmenus();
            }
            setSubmenu(button, !expanded);
        });
    });

    // Navigating to the current page re-renders nothing, so close explicitly.
    menu.addEventListener('click', function (event) {
        if (event.target.closest('a') && isMobile()) {
            closeMenu(false);
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') {
            return;
        }

        if (isMenuOpen()) {
            closeMenu(true);
            return;
        }

        var openSubmenu = submenuToggles.filter(function (button) {
            return button.getAttribute('aria-expanded') === 'true';
        })[0];

        if (openSubmenu) {
            setSubmenu(openSubmenu, false);
            openSubmenu.focus();
        }
    });

    // Keep focus inside the sheet while it is open.
    document.addEventListener('focusin', function (event) {
        if (isMenuOpen() && !nav.contains(event.target)) {
            toggle.focus();
        }
    });

    document.addEventListener('click', function (event) {
        if (!isMobile() && !nav.contains(event.target)) {
            closeSubmenus();
        }
    });

    // Resizing past the breakpoint leaves the sheet state stale otherwise.
    mobileQuery.addEventListener('change', function () {
        closeMenu(false);
    });
})();
