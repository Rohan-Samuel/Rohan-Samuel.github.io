// Molten Cracks Shader — WebGL, no build step.
// Attaches an animated canvas molten cracks effect behind any element with [data-molten-cracks].

(function () {
    const DPR_MIN = 1.5;
    const DPR_CAP = 2;

    const DRIFT_AT_50 = 0.25;
    const FLICKER_AT_50 = 2.1;

    const CLOCK_WRAP = 3600;

    const ROCK_SCALE = 7;
    const RELIEF_SCALE = 22;

    const VERT = `
precision highp float;
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

    const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uDensity;
uniform float uWidth;
uniform float uWarp;
uniform float uTime;
uniform float uFlickRate;
uniform vec2  uHeat;
uniform float uReach;
uniform float uAmbient;
uniform float uFlicker;
uniform float uAccentMix;
uniform vec3  uStone;
uniform vec3  uWarm;
uniform vec3  uHot;

float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
vec2 h22(vec2 p){
  vec3 q = fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz)*q.zy);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x),
             mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a*vnoise(p); p *= 2.03; a *= 0.5; }
  return v;
}

vec2 worley(vec2 p){
  vec2 n = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++){
    for (int i = -1; i <= 1; i++){
      vec2 g = vec2(float(i), float(j));
      vec2 o = h22(n + g);
      o = 0.5 + 0.42*sin(uTime + 6.2831*o);
      float d = length(g + o - f);
      if (d < f1){ f2 = f1; f1 = d; } else if (d < f2){ f2 = d; }
    }
  }
  return vec2(f1, f2);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;

  vec2 q = uv*uDensity + vec2(fbm(uv*2.0), fbm(uv*2.0 + 4.0))*uWarp;
  vec2 w = worley(q);
  float edge = w.y - w.x;
  float crack = 1.0 - smoothstep(0.0, uWidth, edge);
  float deep  = 1.0 - smoothstep(0.0, uWidth*0.33, edge);

  float d = length(uv - uHeat);
  float prox = exp(-(d*d)/max(uReach*uReach, 1e-4));
  float heat = crack * (uAmbient + (1.0 - uAmbient)*prox);
  heat *= 1.0 - uFlicker*0.5 + uFlicker*0.5*sin(uTime*uFlickRate + w.x*22.0);

  float rock   = fbm(uv*7.0);
  float relief = fbm(uv*22.0);
  vec3 stone = uStone*(0.55 + 1.15*rock);
  stone *= 0.75 + 0.45*relief;
  stone *= 1.0 - crack*0.55;

  vec3 col = stone;
  col += uWarm*pow(heat, 1.7)*1.6;

  col += uHot*pow(deep*heat, mix(7.0, 1.6, uAccentMix))*2.0;
  col += uWarm*prox*0.14;

  gl_FragColor = vec4(col, 1.0);
}
`;

    const DEFAULTS = {
        background: "#000000",
        baseColor: "#FF2E63",
        accentColor: "#FF16A4",
        accentMix: 0,
        glow: "#02DFF400",
        density: 15,
        speed: 49,
        cracksWidth: 30,
        cracksWarp: 46,
        heatAmbient: 30,
        heatFlicker: 0,
        cursorReach: 60,
        cursorDamping: 38,
    };

    function parseColor(input) {
        if (!input) return [0, 0, 0];
        const s = String(input).trim();
        const fn = s.match(/rgba?\(([^)]+)\)/i);
        if (fn) {
            const p = fn[1].split(",").map((v) => parseFloat(v.trim()));
            return [(p[0] || 0) / 255, (p[1] || 0) / 255, (p[2] || 0) / 255];
        }
        let h = s.replace("#", "");
        if (h.length === 3 || h.length === 4)
            h = h.split("").map((c) => c + c).join("");
        h = h.padEnd(6, "0");
        return [
            parseInt(h.slice(0, 2), 16) / 255,
            parseInt(h.slice(2, 4), 16) / 255,
            parseInt(h.slice(4, 6), 16) / 255,
        ];
    }

    function compile(gl, type, src) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
            console.warn("MoltenCracks shader:", gl.getShaderInfoLog(sh));
        return sh;
    }

    function linkProg(gl, vs, fs) {
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vs));
        gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
            console.warn("MoltenCracks link:", gl.getProgramInfoLog(prog));
        return prog;
    }

    function mount(host) {
        if (host.__moltenCracksMounted) return;
        host.__moltenCracksMounted = true;

        const opts = Object.assign({}, DEFAULTS, host.dataset || {});
        for (const k of [
            "density", "speed", "cracksWidth", "cracksWarp", 
            "heatAmbient", "heatFlicker", "cursorReach", "cursorDamping"
        ]) {
            if (typeof opts[k] === "string") opts[k] = parseFloat(opts[k]);
        }

        const canvas = document.createElement("canvas");
        canvas.className = "molten-cracks-canvas";
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.position = "absolute";
        canvas.style.inset = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        canvas.style.zIndex = "-1";
        host.insertBefore(canvas, host.firstChild);
        host.style.position = "relative";
        host.style.overflow = "hidden";

        const gl = canvas.getContext("webgl", {
            alpha: false,
            antialias: false,
            depth: false,
        });
        if (!gl) return;

        const prog = linkProg(gl, VERT, FRAG);
        gl.useProgram(prog);

        const aPos = gl.getAttribLocation(prog, "aPos");
        const U = (n) => gl.getUniformLocation(prog, n);
        const u = {
            res: U("uRes"), density: U("uDensity"), width: U("uWidth"),
            warp: U("uWarp"), time: U("uTime"), flickRate: U("uFlickRate"),
            heat: U("uHeat"), reach: U("uReach"), ambient: U("uAmbient"),
            flicker: U("uFlicker"), accentMix: U("uAccentMix"),
            stone: U("uStone"), warm: U("uWarm"), hot: U("uHot"),
        };

        const tri = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tri);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 3, -1, -1, 3]),
            gl.STATIC_DRAW
        );
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.disable(gl.DEPTH_TEST);

        let cssW = 0, cssH = 0, dpr = 1;
        const resize = () => {
            dpr = Math.min(Math.max(window.devicePixelRatio || 1, DPR_MIN), DPR_CAP);
            cssW = canvas.clientWidth || host.clientWidth || 1;
            cssH = canvas.clientHeight || host.clientHeight || 1;
            const wpx = Math.max(1, Math.round(cssW * dpr));
            const hpx = Math.max(1, Math.round(cssH * dpr));
            if (canvas.width !== wpx || canvas.height !== hpx) {
                canvas.width = wpx;
                canvas.height = hpx;
            }
            gl.viewport(0, 0, wpx, hpx);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        const ptr = { x: 0, y: 0, has: false };
        const spot = { x: 0, y: 0 };

        let raf = 0;
        let last = performance.now();
        let sceneT = 0;
        let idleT = 0;

        const frame = (now) => {
            raf = requestAnimationFrame(frame);
            const dtReal = Math.min((now - last) / 1000, 0.05);
            last = now;
            if (cssW <= 0 || cssH <= 0) { resize(); return; }

            sceneT += dtReal * (opts.speed / 50);
            if (sceneT > CLOCK_WRAP) sceneT -= CLOCK_WRAP;

            idleT += dtReal * (opts.speed / 50);
            let tx, ty;
            if (ptr.has) {
                tx = (ptr.x * dpr - 0.5 * canvas.width) / canvas.height;
                ty = (0.5 * canvas.height - ptr.y * dpr) / canvas.height;
            } else {
                tx = Math.sin(idleT * 0.23) * 0.44;
                ty = Math.cos(idleT * 0.17) * 0.3;
            }
            const k = 1 - Math.exp(-(opts.cursorDamping / 100) * 12 * dtReal);
            spot.x += (tx - spot.x) * k;
            spot.y += (ty - spot.y) * k;

            const [sr, sg, sb] = parseColor(opts.background);
            const [wr, wg, wb] = parseColor(opts.baseColor);
            const [hr, hg, hb] = parseColor(opts.accentColor);

            gl.uniform2f(u.res, canvas.width, canvas.height);
            gl.uniform1f(u.density, Math.max(opts.density, 1));

            gl.uniform1f(u.width, 0.012 + (opts.cracksWidth / 100) * 0.15);
            gl.uniform1f(u.warp, (opts.cracksWarp / 100) * 1.1);
            gl.uniform1f(u.time, sceneT * DRIFT_AT_50);
            gl.uniform1f(u.flickRate, FLICKER_AT_50 / DRIFT_AT_50);
            gl.uniform2f(u.heat, spot.x, spot.y);
            gl.uniform1f(u.reach, Math.max(opts.cursorReach, 1) / 100 * 0.9);
            gl.uniform1f(u.ambient, Math.min(Math.max(opts.heatAmbient, 0), 100) / 100);
            gl.uniform1f(u.flicker, Math.min(Math.max(opts.heatFlicker, 0), 100) / 100);
            gl.uniform1f(u.accentMix, Math.min(Math.max(opts.accentMix, 0), 100) / 100);
            gl.uniform3f(u.stone, sr, sg, sb);
            gl.uniform3f(u.warm, wr, wg, wb);
            gl.uniform3f(u.hot, hr, hg, hb);

            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        raf = requestAnimationFrame(frame);

        const onMove = (e) => {
            const r = host.getBoundingClientRect();

            const scale = r.width > 0 ? host.clientWidth / r.width : 1;
            ptr.x = (e.clientX - r.left) * scale;
            ptr.y = (e.clientY - r.top) * scale;
            ptr.has = true;
        };
        const onLeave = () => { ptr.has = false; };

        host.addEventListener("pointermove", onMove);
        host.addEventListener("pointerleave", onLeave);
        window.addEventListener("pointerup", onLeave);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            host.removeEventListener("pointermove", onMove);
            host.removeEventListener("pointerleave", onLeave);
            window.removeEventListener("pointerup", onLeave);
        };
    }

    function initAll() {
        document.querySelectorAll("[data-molten-cracks]").forEach(mount);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAll);
    } else {
        initAll();
    }

    // Support for dynamically added elements
    if (typeof MutationObserver !== "undefined") {
        new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.hasAttribute && node.hasAttribute("data-molten-cracks")) {
                            mount(node);
                        }
                        node.querySelectorAll?.("[data-molten-cracks]").forEach(mount);
                    }
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }
})();
