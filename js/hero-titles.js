// Cycle through job titles with a fade transition. Adjust titles, interval and fadeDuration as needed.

(function () {
    const titles = [
        "XR Developer",
        "VR Artist",
        "Unity Developer",
        "Interaction Designer",
        "3D Game Designer"
    ];

    // Colors paired with titles (hex or any valid CSS color). If shorter, they'll wrap.
    const colors = [
        "#58a6ff", // blue
        "#7bd389", // green
        "#f59e0b", // amber
        "#ef476f", // pink/red
        "#a78bfa"  // purple
    ];

    const interval = 3000; // time each title is shown (ms)
    const fadeDuration = 350; // fade out/in duration (ms)

    const el = document.getElementById("hero-title");
    if (!el) return;

    // ensure transitions are applied even if CSS missing
    el.style.transition = `opacity ${fadeDuration}ms ease, color ${fadeDuration}ms ease, transform ${fadeDuration}ms ease`;
    let idx = 0;
    el.textContent = titles[idx];
    el.style.color = colors[idx % colors.length];
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";

    setInterval(() => {
        // fade out + small lift
        el.style.opacity = "0";
        el.style.transform = "translateY(-6px)";
        setTimeout(() => {
            // swap text and color, then fade in
            idx = (idx + 1) % titles.length;
            el.textContent = titles[idx];
            el.style.color = colors[idx % colors.length];
            el.style.transform = "translateY(0)";
            el.style.opacity = "1";
        }, fadeDuration);
    }, interval);
})();