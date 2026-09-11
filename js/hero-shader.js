// Reflect Shader background — WebGL, no build step.
// Attaches an animated canvas behind any element with [data-hero-shader].

(function () {
    const VERT = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

    const FRAG = `
precision highp float;
#define MAXLINES 12

uniform vec2  uResolution;
uniform float uTime;
uniform float uLineWidth;
uniform float uSpread;
uniform float uBands;
uniform float uScale;
uniform float uIntensity;
uniform int   uLineCount;
uniform vec3  uTint;
uniform vec3  uTint2;

uniform vec2  uPointer;
uniform float uHover;
uniform float uReach;

float channel(vec2 uv, float r, float t, float jf) {
    float sum = 0.0;
    float band = mod(uv.x + uv.y, uBands);
    for (int i = 0; i < MAXLINES; i++) {
        if (i < uLineCount) {
            float d = fract(t - uSpread * jf + float(i) * 0.01) * 5.0 - r + band;
            sum += uLineWidth * float(i * i) / max(abs(d), 1e-4);
        }
    }
    return sum;
}

void main() {
    vec2 s = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
    s *= uScale;

    vec2 uv = s - uPointer * min(uHover, 1.0);

    float reach = max(uReach, 1e-3);
    float r = length(uv);

    float t = uTime * 0.05;
    vec3 color = channel(uv, r, t, 0.0) * uTint + channel(uv, r, t, 1.0) * uTint2;

    float dp = length(s - uPointer) / reach;
    float glow = uHover * exp(-dp * dp);

    vec3 c = min(color * uIntensity * (1.0 + glow), vec3(1.0));
    gl_FragColor = vec4(c, clamp(max(max(c.r, c.g), c.b), 0.0, 1.0));
}
`;

    const MAX_DPR = 2;
    const BASE_RATE = 3;
    const LINE_COUNT = 5;
    const FOLLOW_RATE = 8;
    const HOVER_REACH_PX = 260;

    const DEFAULTS = {
        speed: 20,
        brightness: 20,
        thickness: 9,
        chromatic: 0,
        bandGap: 10,
        zoom: 130,
        hover: 50,
        tint: "#62EBE1",
        tint2: "#4FD5C8",
    };

    function parseColor(input) {
        if (!input) return [1, 1, 1];
        const s = String(input).trim();
        if (s[0] === "#") {
            let hex = s.slice(1);
            if (hex.length === 3 || hex.length === 4) {
                hex = hex.slice(0, 3).split("").map((c) => c + c).join("");
            }
            const n = parseInt(hex.slice(0, 6), 16);
            if (Number.isNaN(n)) return [1, 1, 1];
            return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
        }
        const m = s.match(/rgba?\(([^)]+)\)/i);
        if (m) {
            const parts = m[1].split(",").map((p) => parseFloat(p));
            return [(parts[0] || 0) / 255, (parts[1] || 0) / 255, (parts[2] || 0) / 255];
        }
        return [1, 1, 1];
    }

    function compile(gl, type, src) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        return sh;
    }

    function mount(host) {
        if (host.__heroShaderMounted) return;
        host.__heroShaderMounted = true;

        const opts = Object.assign({}, DEFAULTS, host.dataset || {});
        for (const k of ["speed", "brightness", "thickness", "chromatic", "bandGap", "zoom", "hover"]) {
            if (typeof opts[k] === "string") opts[k] = parseFloat(opts[k]);
        }

        const canvas = document.createElement("canvas");
        canvas.className = "hero-shader-canvas";
        canvas.setAttribute("aria-hidden", "true");
        host.insertBefore(canvas, host.firstChild);

        const gl = canvas.getContext("webgl", {
            antialias: false,
            alpha: true,
            premultipliedAlpha: true,
        });
        if (!gl) return;

        const program = gl.createProgram();
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
        gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const aPosition = gl.getAttribLocation(program, "aPosition");
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

        const u = {
            resolution: gl.getUniformLocation(program, "uResolution"),
            time: gl.getUniformLocation(program, "uTime"),
            lineWidth: gl.getUniformLocation(program, "uLineWidth"),
            spread: gl.getUniformLocation(program, "uSpread"),
            bands: gl.getUniformLocation(program, "uBands"),
            scale: gl.getUniformLocation(program, "uScale"),
            intensity: gl.getUniformLocation(program, "uIntensity"),
            lineCount: gl.getUniformLocation(program, "uLineCount"),
            tint: gl.getUniformLocation(program, "uTint"),
            tint2: gl.getUniformLocation(program, "uTint2"),
            pointer: gl.getUniformLocation(program, "uPointer"),
            hover: gl.getUniformLocation(program, "uHover"),
            reach: gl.getUniformLocation(program, "uReach"),
        };

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
            const w = Math.max(1, Math.round((canvas.clientWidth || 1) * dpr));
            const h = Math.max(1, Math.round((canvas.clientHeight || 1) * dpr));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
            gl.viewport(0, 0, w, h);
            gl.uniform2f(u.resolution, w, h);
        }
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        const ptr = { tx: 0, ty: 0, x: 0, y: 0, inside: 0, ease: 0 };

        host.addEventListener("pointermove", (e) => {
            const w = host.clientWidth || 1;
            const h = host.clientHeight || 1;
            const m = Math.min(w, h);
            const rect = host.getBoundingClientRect();
            const ox = e.clientX - rect.left;
            const oy = e.clientY - rect.top;
            ptr.tx = (ox * 2 - w) / m;
            ptr.ty = (h - oy * 2) / m;
            ptr.inside = 1;
        });
        host.addEventListener("pointerleave", () => {
            ptr.tx = 0;
            ptr.ty = 0;
            ptr.inside = 0;
        });

        let raf = 0;
        let last = 0;
        let t = 0;
        const [r, g, b] = parseColor(opts.tint);
        const [r2, g2, b2] = parseColor(opts.tint2);

        function frame(now) {
            raf = requestAnimationFrame(frame);
            const dt = last ? Math.min((now - last) / 1000, 1 / 15) : 0;
            last = now;
            t = (t + BASE_RATE * (opts.speed / 50) * dt) % 20000;

            gl.uniform1f(u.time, t);
            gl.uniform1f(u.lineWidth, opts.thickness / 10000);
            gl.uniform1f(u.spread, opts.chromatic / 1000);
            gl.uniform1f(u.bands, Math.max(opts.bandGap, 1) / 100);
            gl.uniform1f(u.scale, opts.zoom / 100);
            gl.uniform1f(u.intensity, opts.brightness / 100);
            gl.uniform1i(u.lineCount, LINE_COUNT);
            gl.uniform3f(u.tint, r, g, b);
            gl.uniform3f(u.tint2, r2, g2, b2);

            const k = 1 - Math.exp(-dt * FOLLOW_RATE);
            ptr.x += (ptr.tx - ptr.x) * k;
            ptr.y += (ptr.ty - ptr.y) * k;
            ptr.ease += (ptr.inside - ptr.ease) * k;

            const scale = opts.zoom / 100;
            const side = Math.max(1, Math.min(host.clientWidth || 1, host.clientHeight || 1));
            const reachUv = ((HOVER_REACH_PX * 2) / side) * scale;

            gl.uniform2f(u.pointer, ptr.x * scale, ptr.y * scale);
            gl.uniform1f(u.hover, (opts.hover / 100) * ptr.ease);
            gl.uniform1f(u.reach, reachUv);

            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        raf = requestAnimationFrame(frame);

        window.addEventListener("pagehide", () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        }, { once: true });
    }

    function init() {
        document.querySelectorAll("[data-hero-shader]").forEach(mount);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
