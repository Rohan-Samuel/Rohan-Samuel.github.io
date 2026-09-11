// Light Curtain Shader — WebGL, no build step.
// Attaches an animated canvas light curtain effect behind any element with [data-light-curtain].

(function () {
    const MAX_DPR = 2;
    const TRAIL = 8;
    const HIST = TRAIL - 1;
    const TRAIL_LIFE = 0.62;
    const TRAIL_STEP = 0.022;
    const PULSES = 3;
    const PULSE_LIFE = 1.15;
    const PULSE_SPEED = 1.05;
    const SWAY_W = 9.5;
    const SWAY_Z = 0.3;

    const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

    const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

const int TRAIL = 8;
const int PULSES = 3;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uHover;
uniform float uReach;
uniform float uSway;
uniform float uRush;
uniform vec3  uTrail[TRAIL];
uniform vec3  uPulse[PULSES];
uniform vec3  uBg;
uniform vec3  uBase;
uniform vec3  uAccent;
uniform vec3  uHigh;
uniform float uDensity;
uniform float uWidth;
uniform float uSpread;
uniform float uStriation;

float sat(float x) { return clamp(x, 0.0, 1.0); }

float h21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 34.56);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = h21(i), b = h21(i + vec2(1.0, 0.0));
    float c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm5(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return s;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float t = uTime;

    float rx  = max(uReach, 0.02);
    float rx2 = rx * rx;

    float lift = 0.0, blob = 0.0, cenY = 0.0, cenW = 0.0;
    for (int i = 0; i < TRAIL; i++) {
        vec3 s = uTrail[i];
        float dx = uv.x - s.x;
        float dy = uv.y - s.y;
        float gx = s.z * exp(-(dx * dx) / rx2);
        lift += gx;
        blob += gx * exp(-(dy * dy) / (rx2 * 2.6));
        cenY += gx * s.y;
        cenW += gx;
    }
    float trailY = cenY / max(cenW, 1e-4);

    float ring = 0.0;
    for (int i = 0; i < PULSES; i++) {
        vec3 p = uPulse[i];
        float d = abs(uv.x - p.x) - p.y;
        ring += p.z * exp(-(d * d) / 0.0012);
    }

    lift = (min(lift, 2.0) + ring * 0.9) * uHover;
    blob = min(blob, 1.5) * uHover;

    float nearP = exp(-pow(uv.x - uMouse.x, 2.0) / (rx2 * 4.0));
    float xw = uv.x - uSway * 0.09 * (0.25 + 0.75 * nearP) * uHover;

    float n1 = fbm5(vec2(xw * 6.5 * uDensity, t * 0.045));
    float n2 = fbm5(vec2(xw * 24.0 * uDensity + 3.1, t * 0.075));
    float n3 = vnoise(vec2(xw * 210.0 * uDensity, t * 0.04));
    float n4 = vnoise(vec2(xw * 70.0 * uDensity, 4.0 + t * 0.03));

    float band = pow(sat(n1 * 1.30 + n2 * 0.80 - 0.58 + lift * 0.34), 1.95);
    band *= 0.62 + 0.70 * n4;

    float yc = 0.50 + 0.24 * uSpread * (fbm5(vec2(xw * 3.1 * uDensity, 11.0)) - 0.5) * 2.0;
    yc = mix(yc, trailY, sat(cenW * 1.1) * uHover * 0.45);

    float wdt = uWidth * (0.22 + 0.28 * n2 + 0.10 * n1) * (1.0 + 0.5 * uRush * sat(lift));
    float prof = exp(-pow(abs(uv.y - yc) / max(wdt, 0.02), 1.75));

    float inten = band * prof * (1.0 - uStriation * 0.5 + uStriation * n3);

    float blend = sat(n1 * 1.30 - n2 * 0.55 + 0.28);
    vec3 c = mix(uBase, uAccent, blend);
    float amber = sat((n2 - 0.70) * 5.2) * sat(n1 * 1.6 - 0.35);
    c = mix(c, uHigh, amber * 0.85);

    vec3 col = uBg;
    col += c * pow(inten, 0.88) * 1.42;
    col += vec3(1.0, 0.94, 1.0) * pow(inten, 4.5) * 0.65;
    col += c * 0.30 * pow(sat(prof * band * 3.0), 0.70);
    col += c * 0.10 * pow(sat(prof * 1.2), 1.3);

    col += mix(uAccent, uHigh, sat(uRush)) * blob * (0.22 + 0.16 * uRush);

    col += mix(uAccent, uHigh, 0.35) * ring * prof * 0.75 * uHover;
    col += vec3(1.0, 0.95, 0.92) * pow(ring, 3.0) * prof * 0.35 * uHover;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

    const DEFAULTS = {
        background: "#000000",
        baseColor: "#62EBE1",
        accentColor: "#4FD5C8",
        highlight: "#2E9B94",
        density: 150,
        speed: 9,
        curtainWidth: 30,
        spread: 0,
        striation: 0,
        hover: 17,
        reach: 10,
        opacity: 1,
    };

    function parseColor(input) {
        if (!input) return [1, 1, 1];
        const s = String(input).trim();
        if (s[0] === "#") {
            let hex = s.slice(1);
            if (hex.length === 3 || hex.length === 4) {
                hex = hex.split("").map((c) => c + c).join("");
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

    function clampN(v, lo, hi) {
        return v < lo ? lo : v > hi ? hi : v;
    }

    function mount(host) {
        if (host.__lightCurtainMounted) return;
        host.__lightCurtainMounted = true;

        const opts = Object.assign({}, DEFAULTS, host.dataset || {});
        for (const k of ["density", "speed", "curtainWidth", "spread", "striation", "hover", "reach", "opacity"]) {
            if (typeof opts[k] === "string") opts[k] = parseFloat(opts[k]);
        }

        const canvas = document.createElement("canvas");
        canvas.className = "light-curtain-canvas";
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.position = "absolute";
        canvas.style.inset = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        canvas.style.opacity = opts.opacity;
        host.insertBefore(canvas, host.firstChild);
        host.style.position = "relative";
        host.style.overflow = "hidden";

        const gl = canvas.getContext("webgl", {
            antialias: false,
            alpha: false,
            depth: false,
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
        const aPosition = gl.getAttribLocation(program, "a_pos");
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

        const u = {
            res: gl.getUniformLocation(program, "uRes"),
            time: gl.getUniformLocation(program, "uTime"),
            mouse: gl.getUniformLocation(program, "uMouse"),
            hover: gl.getUniformLocation(program, "uHover"),
            reach: gl.getUniformLocation(program, "uReach"),
            sway: gl.getUniformLocation(program, "uSway"),
            rush: gl.getUniformLocation(program, "uRush"),
            trail: gl.getUniformLocation(program, "uTrail[0]"),
            pulse: gl.getUniformLocation(program, "uPulse[0]"),
            bg: gl.getUniformLocation(program, "uBg"),
            base: gl.getUniformLocation(program, "uBase"),
            accent: gl.getUniformLocation(program, "uAccent"),
            high: gl.getUniformLocation(program, "uHigh"),
            density: gl.getUniformLocation(program, "uDensity"),
            width: gl.getUniformLocation(program, "uWidth"),
            spread: gl.getUniformLocation(program, "uSpread"),
            striation: gl.getUniformLocation(program, "uStriation"),
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
        }
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        const hx = new Float32Array(HIST);
        const hy = new Float32Array(HIST);
        const hAge = new Float32Array(HIST).fill(TRAIL_LIFE * 2);
        let head = 0;
        let lastEmitX = 0.5;
        let lastEmitY = 0.5;
        const trailData = new Float32Array(TRAIL * 3);

        const pulseX = new Float32Array(PULSES);
        const pulseAge = new Float32Array(PULSES).fill(PULSE_LIFE * 2);
        let pulseHead = 0;
        const pulseData = new Float32Array(PULSES * 3);

        const sway = { p: 0.5, v: 0 };
        let rush = 0;
        let prevX = 0.5;
        let prevY = 0.5;

        let raf = 0;
        let last = 0;
        let clock = 0;

        const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, on: 0, onTarget: 0 };

        function frame(now) {
            raf = requestAnimationFrame(frame);
            const dt = last ? Math.min((now - last) / 1000, 1 / 15) : 0;
            last = now;

            clock = (clock + dt * (clampN(opts.speed, 0, 100) / 50)) % 3600;

            const kOn = 1 - Math.exp(-6 * dt);
            ptr.on += (ptr.onTarget - ptr.on) * kOn;

            const kHead = 1 - Math.exp(-22 * dt);
            ptr.x += (ptr.tx - ptr.x) * kHead;
            ptr.y += (ptr.ty - ptr.y) * kHead;

            const inst = Math.hypot(ptr.tx - prevX, ptr.ty - prevY) / Math.max(dt, 1e-3);
            prevX = ptr.tx;
            prevY = ptr.ty;
            const rushTarget = clampN(inst / 2.0, 0, 1) * ptr.on;
            rush += (rushTarget - rush) * (1 - Math.exp(-(rushTarget > rush ? 14 : 3.2) * dt));

            sway.v += (-2 * SWAY_Z * SWAY_W * sway.v - SWAY_W * SWAY_W * (sway.p - ptr.x)) * dt;
            sway.p += sway.v * dt;
            const lag = clampN((ptr.x - sway.p) * 3.0, -1, 1);

            const my = 1 - ptr.y;
            if (ptr.on > 0.02 && Math.hypot(ptr.x - lastEmitX, my - lastEmitY) > TRAIL_STEP) {
                head = (head + 1) % HIST;
                hx[head] = ptr.x;
                hy[head] = my;
                hAge[head] = 0;
                lastEmitX = ptr.x;
                lastEmitY = my;
            }

            trailData[0] = ptr.x;
            trailData[1] = my;
            trailData[2] = ptr.on;
            for (let i = 0; i < HIST; i++) {
                const idx = (head - i + HIST * 2) % HIST;
                hAge[idx] += dt;
                const a = hAge[idx];
                const w = a >= TRAIL_LIFE ? 0 : Math.pow(1 - a / TRAIL_LIFE, 1.6) * ptr.on * 0.8;
                trailData[(i + 1) * 3] = hx[idx];
                trailData[(i + 1) * 3 + 1] = hy[idx];
                trailData[(i + 1) * 3 + 2] = w;
            }

            for (let i = 0; i < PULSES; i++) {
                pulseAge[i] += dt;
                const a = pulseAge[i];
                const w = a >= PULSE_LIFE ? 0 : Math.pow(1 - a / PULSE_LIFE, 2.0);
                pulseData[i * 3] = pulseX[i];
                pulseData[i * 3 + 1] = a * PULSE_SPEED;
                pulseData[i * 3 + 2] = w;
            }

            const bg = parseColor(opts.background);
            const base = parseColor(opts.baseColor);
            const accent = parseColor(opts.accentColor);
            const high = parseColor(opts.highlight);

            const density = clampN((opts.density || 150) / 50, 0.2, 3);
            const width = clampN((opts.curtainWidth || 100) / 100, 0.3, 2.5);
            const spread = clampN((opts.spread || 100) / 100, 0, 2);
            const striation = clampN((opts.striation || 55) / 100, 0, 1);
            const hover = clampN((opts.hover || 100) / 100, 0, 2);
            const reach = 0.02 + (clampN((opts.reach || 30) / 100, 0, 1) * 0.18);

            const w = canvas.width;
            const h = canvas.height;
            gl.uniform2f(u.res, w, h);
            gl.uniform1f(u.time, clock);
            gl.uniform2f(u.mouse, ptr.x, my);
            gl.uniform1f(u.hover, Math.min(1, ptr.on) * hover);
            gl.uniform1f(u.reach, reach);
            gl.uniform1f(u.sway, lag);
            gl.uniform1f(u.rush, rush);
            gl.uniform3fv(u.trail, trailData);
            gl.uniform3fv(u.pulse, pulseData);
            gl.uniform3f(u.bg, bg[0], bg[1], bg[2]);
            gl.uniform3f(u.base, base[0], base[1], base[2]);
            gl.uniform3f(u.accent, accent[0], accent[1], accent[2]);
            gl.uniform3f(u.high, high[0], high[1], high[2]);
            gl.uniform1f(u.density, density);
            gl.uniform1f(u.width, width);
            gl.uniform1f(u.spread, spread);
            gl.uniform1f(u.striation, striation);

            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        raf = requestAnimationFrame(frame);

        canvas.addEventListener("pointermove", (e) => {
            const rect = canvas.getBoundingClientRect();
            const w = rect.width || 1;
            const h = rect.height || 1;
            ptr.tx = clampN(e.clientX - rect.left, 0, w) / w;
            ptr.ty = clampN(e.clientY - rect.top, 0, h) / h;
            if (ptr.on < 0.02) {
                ptr.x = ptr.tx;
                ptr.y = ptr.ty;
                sway.p = ptr.tx;
                sway.v = 0;
                prevX = ptr.tx;
                prevY = ptr.ty;
                lastEmitX = ptr.tx;
                lastEmitY = 1 - ptr.ty;
                hAge.fill(TRAIL_LIFE * 2);
            }
            ptr.onTarget = 1;
        });

        canvas.addEventListener("pointerenter", (e) => {
            const rect = canvas.getBoundingClientRect();
            const w = rect.width || 1;
            const h = rect.height || 1;
            ptr.tx = clampN(e.clientX - rect.left, 0, w) / w;
            ptr.ty = clampN(e.clientY - rect.top, 0, h) / h;
            ptr.onTarget = 1;
        });

        canvas.addEventListener("pointerdown", (e) => {
            pulseHead = (pulseHead + 1) % PULSES;
            pulseX[pulseHead] = ptr.tx;
            pulseAge[pulseHead] = 0;
        });

        canvas.addEventListener("pointerleave", () => {
            ptr.onTarget = 0;
        });

        window.addEventListener("pagehide", () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        }, { once: true });
    }

    function init() {
        document.querySelectorAll("[data-light-curtain]").forEach(mount);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
