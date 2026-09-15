/* Looping showreel clips.
   WCAG 2.2.2 asks for a way to pause motion that runs longer than five seconds,
   so every autoplaying loop gets a real control. Anyone who has asked their OS
   for reduced motion gets a still poster and native controls instead. */
(function () {
    "use strict";

    var clips = document.querySelectorAll("video[data-loop]");
    if (!clips.length) return;

    var calm = window.matchMedia("(prefers-reduced-motion: reduce)");

    function setup(video) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "video-toggle";

        function label() {
            var paused = video.paused;
            button.textContent = paused ? "Play" : "Pause";
            button.setAttribute("aria-label",
                (paused ? "Play " : "Pause ") + (video.getAttribute("aria-label") || "clip"));
        }

        button.addEventListener("click", function () {
            if (video.paused) video.play(); else video.pause();
        });
        video.addEventListener("play", label);
        video.addEventListener("pause", label);

        video.parentNode.insertBefore(button, video.nextSibling);
        label();
    }

    function start(video) {
        video.controls = false;
        // autoplay can be refused (low power mode, browser policy); the poster
        // stays up and the button below still works, so don't chase the promise.
        var started = video.play();
        if (started && started.catch) started.catch(function () {});
    }

    // Calling play() straight away pulls the whole file down even when the clip is
    // far below the fold, which defeats preload="metadata". Wait until it's near.
    var watcher = window.IntersectionObserver ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting || calm.matches) return;
            start(entry.target);
            watcher.unobserve(entry.target);
        });
    }, { rootMargin: "200px" }) : null;

    function apply() {
        Array.prototype.forEach.call(clips, function (video) {
            if (calm.matches) {
                video.autoplay = false;
                video.controls = true;
                video.pause();
                if (watcher) watcher.unobserve(video);
                return;
            }
            // autoplay would download it regardless of where it sits on the page.
            video.autoplay = false;
            video.preload = "metadata";
            if (watcher) watcher.observe(video);
            else start(video);
        });
    }

    Array.prototype.forEach.call(clips, setup);
    apply();

    if (calm.addEventListener) calm.addEventListener("change", apply);
    else if (calm.addListener) calm.addListener(apply);
}());
