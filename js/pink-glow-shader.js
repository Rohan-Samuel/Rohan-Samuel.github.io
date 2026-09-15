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
        size: 260,
        intensity: 0.68,
        damping: 65,
        fade: 14,
    };

    function createGlowEl(size, color, intensity) {
        const el = document.createElement("div");
        el.className = "pink-glow-spot";
        el.setAttribute("aria-hidden", "true");
        el.style.position = "absolute";
        el.style.top = "0";
        el.style.left = "0";
        el.style.width = size + "px";
        el.style.height = size + "px";
        el.style.marginLeft = -size / 2 + "px";
        el.style.marginTop = -size / 2 + "px";
        el.style.borderRadius = "50%";
        el.style.background =
            "radial-gradient(circle closest-side, rgba(255, 255, 255, " + Math.min(intensity * 1.15, 1) + ") 0%, rgba(" +
            color + ", " + intensity + ") 4%, rgba(" +
            color + ", " + (intensity * 0.45) + ") 45%, rgba(" + color + ", 0) 100%)";
        el.style.mixBlendMode = "screen";
        el.style.zIndex = "5";
        el.style.pointerEvents = "none";
        el.style.opacity = "0";
        el.style.willChange = "transform, opacity";
        return el;
    }

    function mount(host) {
        if (host.__pinkGlowMounted) return;
        host.__pinkGlowMounted = true;

        const opts = Object.assign({}, DEFAULTS, host.dataset || {});
        for (const k of ["size", "intensity", "damping", "fade"]) {
            if (typeof opts[k] === "string") opts[k] = parseFloat(opts[k]);
        }

        // Trailing echoes, each smaller/dimmer and lagging more than the last.
        const TRAIL_STEPS = [
            { sizeMul: 0.55, intensityMul: 0.32, lagMul: 3.2 },
            { sizeMul: 0.36, intensityMul: 0.2, lagMul: 5.5 },
            { sizeMul: 0.22, intensityMul: 0.12, lagMul: 8.5 },
        ];
        const trails = TRAIL_STEPS.map((t) => ({
            el: createGlowEl(opts.size * t.sizeMul, opts.color, opts.intensity * t.intensityMul),
            pos: { x: 0, y: 0 },
            lagMul: t.lagMul,
        }));
        trails.forEach((t) => host.appendChild(t.el));
        const spot = createGlowEl(opts.size, opts.color, opts.intensity);
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

            let leadX = cur.x, leadY = cur.y;
            trails.forEach((t) => {
                const kTrail = 1 - Math.exp(-(opts.damping / 100) * t.lagMul * dt);
                t.pos.x += (leadX - t.pos.x) * kTrail;
                t.pos.y += (leadY - t.pos.y) * kTrail;
                t.el.style.transform = "translate(" + t.pos.x + "px, " + t.pos.y + "px)";
                t.el.style.opacity = String(presence);
                leadX = t.pos.x;
                leadY = t.pos.y;
            });
        };
        raf = requestAnimationFrame(frame);

        const onMove = (e) => {
            const r = host.getBoundingClientRect();
            const scale = r.width > 0 ? host.clientWidth / r.width : 1;
            ptr.x = (e.clientX - r.left) * scale;
            ptr.y = (e.clientY - r.top) * scale;
            if (!ptr.has) {
                cur.x = ptr.x; cur.y = ptr.y;
                trails.forEach((t) => { t.pos.x = ptr.x; t.pos.y = ptr.y; });
            }
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
