// Pink Glow — CSS radial-gradient spot that follows the pointer over any
// element with [data-pink-glow]. The glow fades in on hover and out on
// leave, with damped ("shader-like") trailing motion.
//
// Note: this intentionally avoids a WebGL canvas. A canvas here gets
// squashed into a shared compositing layer by the browser when it shares
// a container with many other absolutely-positioned siblings (like the
// depth-frame's stacked images), which silently breaks WebGL rendering.
// A plain CSS radial-gradient has no such layer-count sensitivity.

(function () {
    const DEFAULTS = {
        color: "255, 46, 99",
        size: 160,
        intensity: 0.68,
        damping: 65,
        fade: 14,
    };

    function mount(host) {
        if (host.__pinkGlowMounted) return;
        host.__pinkGlowMounted = true;

        const opts = Object.assign({}, DEFAULTS, host.dataset || {});
        for (const k of ["size", "intensity", "damping", "fade"]) {
            if (typeof opts[k] === "string") opts[k] = parseFloat(opts[k]);
        }

        const spot = document.createElement("div");
        spot.className = "pink-glow-spot";
        spot.setAttribute("aria-hidden", "true");
        spot.style.position = "absolute";
        spot.style.top = "0";
        spot.style.left = "0";
        spot.style.width = opts.size + "px";
        spot.style.height = opts.size + "px";
        spot.style.marginLeft = -opts.size / 2 + "px";
        spot.style.marginTop = -opts.size / 2 + "px";
        spot.style.borderRadius = "50%";
        spot.style.background =
            "radial-gradient(circle, rgba(255, 255, 255, " + Math.min(opts.intensity * 1.15, 1) + ") 0%, rgba(" +
            opts.color + ", " + opts.intensity + ") 14%, rgba(" +
            opts.color + ", " + (opts.intensity * 0.45) + ") 40%, rgba(" + opts.color + ", 0) 72%)";
        spot.style.mixBlendMode = "screen";
        spot.style.zIndex = "5";
        spot.style.pointerEvents = "none";
        spot.style.opacity = "0";
        spot.style.willChange = "transform, opacity";
        host.appendChild(spot);

        const computed = getComputedStyle(host);
        if (computed.position === "static") host.style.position = "relative";

        const ptr = { x: 0, y: 0, has: false };
        const cur = { x: 0, y: 0 };
        let presence = 0;
        let raf = 0;
        let last = performance.now();

        const frame = (now) => {
            raf = requestAnimationFrame(frame);
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;

            const k = 1 - Math.exp(-(opts.damping / 100) * 12 * dt);
            cur.x += (ptr.x - cur.x) * k;
            cur.y += (ptr.y - cur.y) * k;

            const target = ptr.has ? 1 : 0;
            const pk = 1 - Math.exp(-(opts.fade / 10) * dt);
            presence += (target - presence) * pk;

            spot.style.transform = "translate(" + cur.x + "px, " + cur.y + "px)";
            spot.style.opacity = String(presence);
        };
        raf = requestAnimationFrame(frame);

        const onMove = (e) => {
            const r = host.getBoundingClientRect();
            const scale = r.width > 0 ? host.clientWidth / r.width : 1;
            ptr.x = (e.clientX - r.left) * scale;
            ptr.y = (e.clientY - r.top) * scale;
            if (!ptr.has) { cur.x = ptr.x; cur.y = ptr.y; }
            ptr.has = true;
        };
        const onLeave = () => { ptr.has = false; };

        host.addEventListener("pointermove", onMove);
        host.addEventListener("pointerleave", onLeave);
        window.addEventListener("pointerup", onLeave);

        return () => {
            cancelAnimationFrame(raf);
            host.removeEventListener("pointermove", onMove);
            host.removeEventListener("pointerleave", onLeave);
            window.removeEventListener("pointerup", onLeave);
        };
    }

    function initAll() {
        document.querySelectorAll("[data-pink-glow]").forEach(mount);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAll);
    } else {
        initAll();
    }

    if (typeof MutationObserver !== "undefined") {
        new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.hasAttribute && node.hasAttribute("data-pink-glow")) {
                            mount(node);
                        }
                        node.querySelectorAll?.("[data-pink-glow]").forEach(mount);
                    }
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }
})();
