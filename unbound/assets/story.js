// Story pages: the living aurora, sound-wave details, and the scroll choreography of the iPhone and
// Apple Watch. The devices are the real-time 3D models (devices-3d.js, loaded on demand) or, without
// hardware WebGL, the CSS devices from the shared partial. Poses are offsets on the 540×680 device
// stage (CSS conventions, degrees), held while their section is in view and blended in between.
(() => {
  'use strict';
  const root = document.documentElement;
  const script = document.currentScript;
  // The real-time 3D devices; the build stamps this name with a content hash.
  const DEVICES_3D = 'devices-3d.js';
  const page = document.body.dataset.page || 'home';
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
  const mobileMQ = matchMedia('(max-width: 860px)');
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  let paused = false;
  const isStatic = () => paused || reduceMQ.matches;

  // Critically damped springs, integrated in fixed 1/120 s steps so motion is identical at any refresh rate.
  function spring(value, stiffness) {
    const damping = 2 * Math.sqrt(stiffness);
    return {
      value, target: value, velocity: 0,
      step(dt) {
        for (let left = dt; left > 1e-6; left -= 1 / 120) {
          const h = Math.min(left, 1 / 120);
          this.velocity += (stiffness * (this.target - this.value) - damping * this.velocity) * h;
          this.value += this.velocity * h;
        }
      },
      settled() { return Math.abs(this.target - this.value) < 1e-3 && Math.abs(this.velocity) < 1e-2; },
      snap(v = this.target) { this.value = this.target = v; this.velocity = 0; },
    };
  }
  // Writes a style only when it changes, so an idle page makes no DOM changes at all.
  const written = new WeakMap();
  function put(el, prop, value) {
    let cache = written.get(el);
    if (!cache) written.set(el, cache = {});
    if (cache[prop] === value) return;
    cache[prop] = value;
    if (prop.startsWith('--')) el.style.setProperty(prop, value); else el.style[prop] = value;
  }

  /* ── Aurora: a low-resolution full-screen shader, scaled up by CSS ── */
  function createAurora(canvas) {
    const gl = canvas && canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true });
    if (!gl) return null;
    // A software renderer would run the shader on the CPU every frame; the still gradient is kinder.
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (info && /swiftshader|llvmpipe|software|basic render/i.test(`${gl.getParameter(info.UNMASKED_RENDERER_WEBGL)}`)) return null;
    const frag = `precision mediump float;
uniform vec2 uRes; uniform float uTime, uScroll, uGlow, uLevel; uniform vec2 uMouse; uniform vec3 uMood;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= .5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y; vec2 p = vec2(uv.x * asp, uv.y);
  float t = uTime * .035; vec2 s = p + vec2(0., uScroll);
  vec2 q = vec2(fbm(s * 1.1 + vec2(0., t)), fbm(s * 1.1 + vec2(5.2, -t * .8)));
  vec2 r = vec2(fbm(s * 1.4 + 2.2 * q + vec2(1.7, 9.2) + t * 1.4), fbm(s * 1.4 + 2.2 * q + vec2(8.3, 2.8) - t));
  float f = fbm(s * 1.2 + 2.4 * r);
  vec3 base = vec3(.035, .038, .095), indigo = vec3(.12, .08, .36), violet = vec3(.75, .69, .96), mint = vec3(.65, .93, .84), coral = vec3(1., .56, .47);
  vec3 col = mix(base, indigo, smoothstep(.15, .8, f));
  col = mix(col, vec3(.22, .12, .45), smoothstep(.55, .95, q.y) * .6);
  float y1 = uv.y - (.70 + .14 * sin(p.x * 1.4 + t * 5. + r.x * 3.2));
  float y2 = uv.y - (.32 + .13 * sin(p.x * 1.1 - t * 4. + q.y * 4.));
  float streak = .65 + .35 * sin(p.x * 22. + r.y * 9. + t * 3.);
  float rib1 = exp(-y1 * y1 * 16.) * smoothstep(.15, .75, r.y) * streak;
  float rib2 = exp(-y2 * y2 * 18.) * smoothstep(.2, .8, q.x) * streak;
  col += violet * (rib1 * .6 + pow(q.x, 3.) * .12) * uMood.x;
  float bm = smoothstep(.5, .85, fbm(s * .9 + vec2(t * .6, 7.3) + q));
  float bc = smoothstep(.55, .9, fbm(s * .8 + vec2(3.1, -t * .5) + r * .6));
  col += mint * bm * .30 * uMood.y + coral * bc * .28 * uMood.z;
  col += mint * (rib2 * .72 + pow(r.y, 3.) * .3) * uMood.y;
  col += coral * (pow(r.x, 3.5) * .7 + rib1 * rib2 * 2.5) * uMood.z;
  vec2 m = vec2(uMouse.x * asp, uMouse.y); float d = distance(p, m);
  col += mix(violet, mint, uv.x) * exp(-d * d * 10.) * .26 * uGlow;
  float vig = smoothstep(1.3, .3, distance(uv, vec2(.55, .5)));
  col *= mix(.6, 1., vig);
  col = col / (1. + col * .35);
  // The Apple-quiet opening: near black with a single soft glow behind the phone, until the aurora blooms.
  float halo = exp(-pow(distance(uv, vec2(.5, .08)) * 1.6, 2.)) * .22;
  vec3 quiet = vec3(.016, .017, .03) + violet * halo * .55;
  gl_FragColor = vec4(mix(quiet, col, uLevel), 1.);
}`;
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }'));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(program);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    for (const name of ['uRes', 'uTime', 'uScroll', 'uMouse', 'uGlow', 'uMood', 'uLevel']) U[name] = gl.getUniformLocation(program, name);
    const scale = mobileMQ.matches ? .4 : .3;
    const resize = () => {
      const w = Math.max(64, Math.round(innerWidth * scale)), h = Math.max(64, Math.round(innerHeight * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    };
    resize();
    addEventListener('resize', resize, { passive: true });
    return {
      render({ time, scroll, mouseX, mouseY, glow, mood, level }) {
        gl.uniform2f(U.uRes, canvas.width, canvas.height);
        gl.uniform1f(U.uTime, time);
        gl.uniform1f(U.uScroll, scroll);
        gl.uniform2f(U.uMouse, mouseX, 1 - mouseY);
        gl.uniform1f(U.uGlow, glow);
        gl.uniform3f(U.uMood, mood[0], mood[1], mood[2]);
        gl.uniform1f(U.uLevel, level);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  /* ── Waveforms (canvas 2D), drawn only while visible ── */
  const PAL = ['#bfb1f6', '#a6edd6', '#ff9a86'];
  const waves = [];
  for (const el of document.querySelectorAll('.wave')) {
    const n = +el.dataset.bars || 48;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    el.append(canvas);
    const wave = {
      el, n, canvas, ctx: canvas.getContext('2d'), speed: 1, visible: false, kind: el.dataset.kind || '',
      bars: Array.from({ length: n }, (_, i) => {
        const x = i / Math.max(1, n - 1);
        return { env: .35 + .65 * Math.pow(Math.sin(Math.PI * x), .6) * (.7 + .3 * Math.sin(x * 17.3)), ph: (i * 2.399) % 6.28, f: 1.4 + (i * .618 % 1) * 2.2, f2: .5 + (i * .382 % 1) };
      }),
    };
    waves.push(wave);
  }
  function sizeWave(w) {
    const r = w.el.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    w.w = r.width; w.h = r.height;
    w.canvas.width = Math.max(1, Math.round(r.width * d)); w.canvas.height = Math.max(1, Math.round(r.height * d));
    w.ctx.setTransform(d, 0, 0, d, 0, 0);
    const g = w.ctx.createLinearGradient(0, 0, r.width, 0);
    g.addColorStop(0, PAL[0]); g.addColorStop(.55, PAL[1]); g.addColorStop(1, PAL[2]);
    w.grad = g;
  }
  function drawWave(w, t, energy, head = -1) {
    const { ctx, w: width, h, n } = w;
    if (!width) return;
    ctx.clearRect(0, 0, width, h);
    const baseline = w.kind === 'baseline';
    const gap = width / n, bw = Math.max(2, gap * .52), mid = baseline ? h - 1 : h / 2;
    ctx.fillStyle = w.grad;
    for (let i = 0; i < n; i++) {
      const b = w.bars[i];
      const live = .3 + .7 * Math.abs(Math.sin(t * b.f * w.speed + b.ph) * (.6 + .4 * Math.sin(t * b.f2 * w.speed * .7 + b.ph * 2)));
      const bh = Math.max(bw, Math.min(1, b.env * live * energy) * (baseline ? h : h * .92));
      const x = i * gap + (gap - bw) / 2, y = baseline ? mid - bh : mid - bh / 2;
      ctx.globalAlpha = head < 0 ? .9 : (i / n <= head ? 1 : .28);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, bw / 2); else ctx.rect(x, y, bw, bh);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => { const w = waves.find(x => x.el === e.target); if (w) { w.visible = e.isIntersecting; if (w.visible) wake(); } }));
    waves.forEach(w => io.observe(w.el));
  } else waves.forEach(w => { w.visible = true; });

  /* ── Small interactions: speed chips, library search, reveals, card light, magnetic buttons ── */
  for (const button of document.querySelectorAll('.speed-chips button')) {
    button.addEventListener('click', () => {
      for (const b of document.querySelectorAll('.speed-chips button')) b.setAttribute('aria-pressed', String(b === button));
      const wave = waves.find(w => w.el.id === 'speed-wave');
      if (wave) wave.speed = +button.dataset.speed;
      wake();
    });
  }
  const typed = document.getElementById('lib-typed');
  if (typed) {
    const terms = ['Search your library', 'lecture', 'chapter 12', 'language lessons'];
    let ti = 0, ci = terms[0].length, dir = -1;
    typed.textContent = terms[0];
    const tick = () => {
      let delay = 900;
      if (!isStatic() && !document.hidden) {
        const word = terms[ti];
        ci += dir;
        typed.textContent = word.slice(0, ci);
        delay = dir > 0 ? 70 + (ci * 37 % 60) : 32;
        if (ci >= word.length) { dir = -1; delay = 1600; }
        if (ci <= 0 && dir < 0) { dir = 1; ti = (ti + 1) % terms.length; delay = 380; }
      }
      setTimeout(tick, delay);
    };
    setTimeout(tick, 1600);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach((el, i) => { el.style.transitionDelay = `${(i % 2) * 90}ms`; io.observe(el); });
    root.classList.add('reveal-ready');
  }
  for (const card of document.querySelectorAll('.card')) {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--gx', `${e.clientX - r.left}px`);
      card.style.setProperty('--gy', `${e.clientY - r.top}px`);
    });
  }
  const magnets = [...document.querySelectorAll('.magnetic')];
  addEventListener('pointermove', e => {
    if (!fineMQ.matches || isStatic()) return;
    for (const m of magnets) {
      const r = m.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const reach = Math.max(r.width, r.height) * .5 + 60;
      if (Math.abs(dx) < reach && Math.abs(dy) < reach * .9) {
        m.style.setProperty('--mx', `${(dx * .28).toFixed(1)}px`); m.style.setProperty('--my', `${(dy * .38).toFixed(1)}px`); m.classList.add('is-pulled');
      } else if (m.classList.contains('is-pulled')) {
        m.style.setProperty('--mx', '0px'); m.style.setProperty('--my', '0px'); m.classList.remove('is-pulled');
      }
    }
  }, { passive: true });

  // The interactive walkthrough (experience page): a sample file's journey, one step at a time.
  const preview = document.getElementById('journey-preview');
  if (preview) {
    const states = {
      import: ['A file you already own.', 'Choose an MP3 in Files to add it to your Unbound library.'],
      transfer: ['Your audio, on its way.', 'With Unbound Pro, transfer the file from iPhone to your paired Apple Watch. Wait for the transfer to finish.'],
      listen: ['On your wrist. Ready offline.', 'Connect your headphones to Apple Watch and play the transferred file. Your iPhone can stay at home.'],
    };
    for (const button of document.querySelectorAll('.journey-step[data-step]')) {
      button.addEventListener('click', () => {
        const step = button.dataset.step;
        for (const b of document.querySelectorAll('.journey-step[data-step]')) b.setAttribute('aria-pressed', String(b === button));
        preview.dataset.state = step;
        document.getElementById('preview-title').textContent = states[step][0];
        document.getElementById('preview-description').textContent = states[step][1];
      });
    }
  }

  /* ── Choreography ── */
  // The calm resting pose of the pair (the production hero), and a pose far off-stage.
  const PHONE0 = { x: 0, y: 0, z: 0, rx: 7, ry: -16, rz: -8, s: 1, dim: 0 };
  const WATCH0 = { x: 0, y: 0, z: 70, rx: 8, ry: -20, rz: 13, s: 1 };
  const P = (phone, watch) => ({ phone: { ...PHONE0, ...phone }, watch: { ...WATCH0, ...watch } });
  const away = { x: 300, y: -1500, z: -900, rx: 30, ry: -70, rz: 40, s: .4 };
  // host: the whole stage's offset (x in viewport widths, y in viewport heights) and opacity.
  // mood: aurora weights for violet, mint and coral.
  const POSES = {
    home: {
      desktop: {
        hero: { host: { x: 0, y: 0, o: 1 }, ...P({ x: 67, y: 540, z: -40, rx: -4, ry: 0, rz: 0, s: 1.14 }, away), mood: [1, .7, .3] },
        step1: { host: { x: .19, y: .03, o: 1 }, ...P({ x: 40, y: 20, z: 30, rx: 3, ry: -8, rz: -3, s: 1.04 }, { x: 140, y: 820, z: -160, rx: 30, ry: -50, rz: 30, s: .9 }), mood: [1.1, .6, .25] },
        step2: { host: { x: .19, y: .02, o: 1 }, ...P({ x: -40, y: -10, z: -30, rx: 6, ry: -30, rz: -7, s: .94 }, { x: -20, y: 0, z: 110, rx: 8, ry: -22, rz: 9, s: 1.12 }), mood: [.9, 1, .3] },
        step3: { host: { x: .19, y: .02, o: 1 }, ...P({ x: -150, y: -180, z: -320, rx: 18, ry: -46, rz: -16, s: .8, dim: .75 }, { x: -130, y: -150, z: 170, rx: 4, ry: -12, rz: 3, s: 1.5 }), mood: [.6, 1.25, .35] },
        swap: { host: { x: -.02, y: .1, o: 1 }, ...P({ x: -60, y: -40, z: -200, rx: 10, ry: 70, rz: 4, s: .85, dim: .3 }, { x: -160, y: -40, z: 80, rx: 12, ry: 40, rz: -6, s: 1.15 }), mood: [1, 1, .6] },
        features: { host: { x: -.24, y: 0, o: 1 }, ...P({ x: 50, y: -10, z: 0, rx: 6, ry: 24, rz: 7, s: .98 }, { x: -320, y: -10, z: 100, rx: 8, ry: 26, rz: -12, s: 1 }), mood: [1.1, .7, .3] },
        discover: { host: { x: -.22, y: 0, o: 1 }, ...P({ x: -150, y: 10, z: 20, rx: -2, ry: 32, rz: 5, s: 1.02 }, { x: 0, y: 40, z: 100, rx: 10, ry: 30, rz: -14, s: 1 }), mood: [.8, .55, 1.15] },
        cta: { host: { x: 0, y: -.15, o: 1 }, ...P({ x: -40, y: 45, z: -60, rx: 8, ry: 14, rz: -4, s: .64, dim: .1 }, { x: -100, y: -15, z: 60, rx: 8, ry: -18, rz: 10, s: .74 }), mood: [1, 1, .6] },
        footer: { host: { x: 0, y: -.45, o: 0 }, ...P({ x: -50, y: -300, z: -300, rx: 30, ry: 40, rz: 8, s: .5, dim: .4 }, { x: -90, y: -340, z: -100, rx: 30, ry: -40, rz: 12, s: .55 }), mood: [1, .8, .5] },
      },
      mobile: {
        hero: { host: { x: 0, y: 0, o: 1 }, ...P({ x: 67, y: 560, z: -40, rx: -4, ry: 0, rz: 0, s: 1 }, away), mood: [1, .7, .3] },
        step1: { host: { x: 0, y: -.13, o: 1 }, ...P({ x: 60, y: 0, z: 0, rx: 3, ry: -8, rz: -3, s: .82 }, { x: 140, y: 820, z: -160, rx: 30, ry: -50, rz: 30, s: .8 }), mood: [1.1, .6, .25] },
        step2: { host: { x: 0, y: -.13, o: 1 }, ...P({ x: 0, y: -10, z: -60, rx: 6, ry: -26, rz: -7, s: .78 }, { x: -40, y: -60, z: 80, rx: 8, ry: -22, rz: 9, s: .95 }), mood: [.9, 1, .3] },
        step3: { host: { x: 0, y: -.16, o: 1 }, ...P({ x: -90, y: -260, z: -340, rx: 18, ry: -40, rz: -16, s: .7, dim: .75 }, { x: -140, y: -230, z: 140, rx: 4, ry: -12, rz: 3, s: 1.12 }), mood: [.6, 1.25, .35] },
        swap: { host: { x: 0, y: -.1, o: 1 }, ...P({ x: 0, y: -60, z: -200, rx: 10, ry: 60, rz: 4, s: .7, dim: .3 }, { x: -180, y: -80, z: 80, rx: 12, ry: 40, rz: -6, s: .95 }), mood: [1, 1, .6] },
        features: { host: { x: 0, y: -.35, o: 0 }, ...P({ x: 90, y: -20, z: -60, rx: 6, ry: 26, rz: 8, s: .74 }, { x: -260, y: -20, z: 80, rx: 8, ry: 26, rz: -12, s: .8 }), mood: [1.1, .7, .3] },
        discover: { host: { x: 0, y: -.3, o: 0 }, ...P({ x: 40, y: 0, z: 0, rx: -2, ry: -32, rz: -5, s: .66 }, { x: -70, y: 10, z: 80, rx: 10, ry: -30, rz: 14, s: .72 }), mood: [.8, .55, 1.15] },
        cta: { host: { x: 0, y: -.26, o: 1 }, ...P({ x: -10, y: 30, z: -100, rx: 6, ry: 16, rz: -4, s: .58, dim: .1 }, { x: -50, y: -20, z: 60, rx: 8, ry: -20, rz: 10, s: .66 }), mood: [1, 1, .6] },
        footer: { host: { x: 0, y: -.6, o: 0 }, ...P({ x: -10, y: -400, z: -300, rx: 30, ry: 30, rz: 8, s: .5, dim: .4 }, { x: -50, y: -440, z: -100, rx: 30, ry: -40, rz: 12, s: .55 }), mood: [1, .8, .5] },
      },
    },
    experience: {
      desktop: {
        // The experience opens on the watch, rising face-on beneath the headline.
        hero: { host: { x: 0, y: 0, o: 1 }, ...P({ ...away, x: -300 }, { x: -140, y: 360, z: 0, rx: 34, ry: 0, rz: 0, s: 1.6 }), mood: [.9, 1, .3] },
        library: { host: { x: .19, y: .02, o: 1 }, ...P({ x: 30, y: 10, z: 30, rx: 3, ry: -10, rz: -3, s: 1.04 }, { x: 120, y: 700, z: -160, rx: 30, ry: -50, rz: 30, s: .9 }), mood: [1.1, .6, .25] },
        wrist: { host: { x: -.2, y: .02, o: 1 }, ...P({ x: -20, y: -170, z: -320, rx: 18, ry: 40, rz: 12, s: .8, dim: .75 }, { x: -130, y: -150, z: 170, rx: 4, ry: 14, rz: -3, s: 1.5 }), mood: [.6, 1.25, .35] },
        walk: { host: { x: 0, y: -.35, o: 0 }, ...P({ x: 0, y: -200, z: -300, rx: 20, ry: 30, rz: 0, s: .7, dim: .5 }, { x: -100, y: -260, z: 0, rx: 20, ry: -30, rz: 0, s: .8 }), mood: [1, 1, .6] },
        tools: { host: { x: -.24, y: 0, o: 1 }, ...P({ x: 50, y: -10, z: 0, rx: 6, ry: 24, rz: 7, s: .98 }, { x: -320, y: -10, z: 100, rx: 8, ry: 26, rz: -12, s: 1 }), mood: [1.1, .7, .3] },
        cta: { host: { x: 0, y: -.15, o: 1 }, ...P({ x: -40, y: 45, z: -60, rx: 8, ry: 14, rz: -4, s: .64, dim: .1 }, { x: -100, y: -15, z: 60, rx: 8, ry: -18, rz: 10, s: .74 }), mood: [1, 1, .6] },
        footer: { host: { x: 0, y: -.45, o: 0 }, ...P({ x: -50, y: -300, z: -300, rx: 30, ry: 40, rz: 8, s: .5, dim: .4 }, { x: -90, y: -340, z: -100, rx: 30, ry: -40, rz: 12, s: .55 }), mood: [1, .8, .5] },
      },
      mobile: {
        hero: { host: { x: 0, y: 0, o: 1 }, ...P({ ...away, x: -300 }, { x: -140, y: 330, z: 0, rx: 34, ry: 0, rz: 0, s: 1.45 }), mood: [.9, 1, .3] },
        library: { host: { x: 0, y: -.22, o: 1 }, ...P({ x: 60, y: 0, z: 0, rx: 3, ry: -10, rz: -3, s: .74 }, { x: 140, y: 820, z: -160, rx: 30, ry: -50, rz: 30, s: .8 }), mood: [1.1, .6, .25] },
        wrist: { host: { x: 0, y: -.2, o: 1 }, ...P({ x: -90, y: -270, z: -340, rx: 18, ry: -40, rz: -16, s: .7, dim: .75 }, { x: -140, y: -250, z: 140, rx: 4, ry: -12, rz: 3, s: 1.05 }), mood: [.6, 1.25, .35] },
        walk: { host: { x: 0, y: -.35, o: 0 }, ...P({ x: 0, y: -200, z: -300, rx: 20, ry: 30, rz: 0, s: .7, dim: .5 }, { x: -100, y: -260, z: 0, rx: 20, ry: -30, rz: 0, s: .8 }), mood: [1, 1, .6] },
        tools: { host: { x: 0, y: -.35, o: 0 }, ...P({ x: 90, y: -20, z: -60, rx: 6, ry: 26, rz: 8, s: .74 }, { x: -260, y: -20, z: 80, rx: 8, ry: 26, rz: -12, s: .8 }), mood: [1.1, .7, .3] },
        cta: { host: { x: 0, y: -.26, o: 1 }, ...P({ x: -10, y: 30, z: -100, rx: 6, ry: 16, rz: -4, s: .58, dim: .1 }, { x: -50, y: -20, z: 60, rx: 8, ry: -20, rz: 10, s: .66 }), mood: [1, 1, .6] },
        footer: { host: { x: 0, y: -.6, o: 0 }, ...P({ x: -10, y: -400, z: -300, rx: 30, ry: 30, rz: 8, s: .5, dim: .4 }, { x: -50, y: -440, z: -100, rx: 30, ry: -40, rz: 12, s: .55 }), mood: [1, .8, .5] },
      },
    },
  }[page] || {};

  // Each [data-pose] element holds its pose while it fills the middle of the viewport; poses blend
  // in between. data-hold="start,end" overrides the hold in viewport heights from the element's top.
  let keys = [], chapters = [], journey = null, vh = innerHeight, maxScroll = 1;
  const topOf = el => el.getBoundingClientRect().top + scrollY;
  function measure() {
    vh = innerHeight;
    maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
    const table = mobileMQ.matches ? POSES.mobile : POSES.desktop;
    const k = [];
    for (const el of document.querySelectorAll('[data-pose]')) {
      const pose = table && table[el.dataset.pose];
      if (!pose) continue;
      const top = topOf(el), height = el.offsetHeight;
      let a, b;
      if (el.dataset.hold) { const [s, e] = el.dataset.hold.split(',').map(Number); a = top + s * vh; b = top + e * vh; }
      else { a = top - vh * .4; b = top + height - vh * .6; }
      if (el.dataset.pose === 'hero') { a = 0; b = Math.max(1, vh * .06); }
      // The last journey pose holds until the pinned steps have scrolled away, so nothing crosses them.
      if (el.dataset.pose === 'step3') b += vh * .9;
      if (el.dataset.pose === 'footer') { a = b = Math.min(maxScroll, top - vh * .3); }
      if (b <= a) a = b = (a + b) / 2;
      k.push([a, pose]);
      if (b > a) k.push([b, pose]);
    }
    k.sort((x, y) => x[0] - y[0]);
    for (let i = 1; i < k.length; i++) if (k[i][0] <= k[i - 1][0]) k[i][0] = k[i - 1][0] + 1;
    keys = k;
    chapters = [...document.querySelectorAll('[data-chapter]')].map(el => ({ at: topOf(el) - vh * .5, name: el.dataset.chapter }));
    const j = document.querySelector('.journey');
    journey = j ? { top: topOf(j), len: Math.max(1, j.offsetHeight - vh) } : null;
    waves.forEach(sizeWave);
    fit();
    wake();
  }
  const mix = (a, b, t) => { const o = {}; for (const key in a) o[key] = lerp(a[key], b[key] ?? a[key], t); return o; };
  function poseAt(y) {
    if (!keys.length) return null;
    let i = 0;
    while (i < keys.length - 2 && y > keys[i + 1][0]) i++;
    const [y0, a] = keys[i], [y1, b] = keys[Math.min(i + 1, keys.length - 1)];
    const t = y1 > y0 ? smooth(clamp((y - y0) / (y1 - y0))) : 0;
    return { host: mix(a.host, b.host, t), phone: mix(a.phone, b.phone, t), watch: mix(a.watch, b.watch, t), mood: a.mood.map((m, n) => lerp(m, b.mood[n], t)) };
  }

  /* ── Device stage ── */
  const layer = document.querySelector('.device-layer');
  const host = layer && layer.querySelector('.device-host');
  const stage = host && host.querySelector('.device-canvas');
  const phone = stage && stage.querySelector('.phone');
  const watch = stage && stage.querySelector('.watch');
  const chip = stage && stage.querySelector('.transfer-chip');
  const elapsed = watch && watch.querySelector('.watch-times span');
  let devices3d = null, stageReady = false, stageScale = 1, entranceShown = false, entranceStarted = false;
  let seconds = 12 * 60 + 48;
  function fit() {
    if (!host) return;
    const style = getComputedStyle(host);
    const fill = parseFloat(style.getPropertyValue('--device-fill')) || .82;
    const max = parseFloat(style.getPropertyValue('--device-max')) || 1.3;
    const scale = Math.min(max, innerHeight * (mobileMQ.matches ? .78 : fill) / 680, innerWidth * 1.1 / 540);
    if (scale > 0 && Math.abs(scale - stageScale) > .001) {
      stageScale = scale;
      host.style.setProperty('--device-scale', scale.toFixed(4));
      devices3d?.setScale(scale);
    }
  }
  // The dotted trail and the labels that ride on the devices (added only with JavaScript).
  let trail = null, trailPath = null;
  const tags = [];
  if (stage && page === 'home') {
    trail = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    trail.setAttribute('class', 'fly-trail');
    trail.setAttribute('width', '540');
    trail.setAttribute('height', '680');
    trail.setAttribute('aria-hidden', 'true');
    trail.innerHTML = '<defs><linearGradient id="trail-grad" x1="0" x2="1"><stop offset="0" stop-color="#bfb1f6"/><stop offset="1" stop-color="#a6edd6"/></linearGradient></defs><path/>';
    trailPath = trail.querySelector('path');
    stage.append(trail);
    const eq = '<span class="tag-eq"><i></i><i></i><i></i></span>';
    const tag = (html, anchor, dx, dy, windowName, cls = '') => {
      const el = document.createElement('div');
      el.className = `stage-tag ${cls}`;
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = html;
      stage.append(el);
      tags.push({ el, anchor, dx, dy, windowName });
    };
    tag('<b>Files</b> Import your own MP3s', 'phone', 205, -40, 'import');
    tag(`${eq}Playing offline · iPhone at home`, 'watch', 0, 175, 'offline', 'tag-mint tag-desk');
  }

  // A pose plus pointer tilt and the entrance (e from 1 to 0: rising from below and further back).
  const place = (d, e, tx, ty, depth) => ({
    x: d.x + ty * depth * 2.2, y: d.y - tx * depth * 1.6 + e * 120, z: d.z - e * 220,
    rx: d.rx + tx * depth + e * 16, ry: d.ry + ty * depth - e * 40, rz: d.rz - e * 6, s: d.s,
  });
  const css = q => `translate3d(${q.x.toFixed(2)}px, ${q.y.toFixed(2)}px, ${q.z.toFixed(2)}px) rotateX(${q.rx.toFixed(3)}deg) rotateY(${q.ry.toFixed(3)}deg) rotateZ(${q.rz.toFixed(3)}deg) scale(${q.s.toFixed(4)})`;
  const spec = q => `${(215 + q.ry * 2.4 - q.rx * 1.2).toFixed(1)}deg`;

  function renderChip(q, a, b) {
    if (!chip) return;
    if (q <= 0 || q >= 1) { put(chip, 'opacity', '0'); if (trail) put(trail, 'opacity', '0'); return; }
    const sx = 203 + a.x, sy = 300 + a.y, ex = 410 + b.x, ey = 440 + b.y;
    const cx = (sx + ex) / 2 + (mobileMQ.matches ? -90 : 60), cy = Math.min(sy, ey) - 170;
    const u = 1 - q, x = u * u * sx + 2 * u * q * cx + q * q * ex, y = u * u * sy + 2 * u * q * cy + q * q * ey;
    const arc = Math.sin(Math.PI * q);
    put(chip, 'opacity', Math.min(1, arc * 2.5).toFixed(3));
    put(chip, 'transform', `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${((mobileMQ.matches ? .95 : 1.15) + arc * .2).toFixed(3)})`);
    if (trailPath) {
      const d = `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
      if (trailPath.getAttribute('d') !== d) trailPath.setAttribute('d', d);
      put(trail, 'opacity', (arc * .9).toFixed(3));
    }
  }

  /* ── State, input and the frame loop ── */
  const scrollS = spring(scrollY, 70);
  const tiltX = spring(0, 55), tiltY = spring(0, 55);
  const mouseX = spring(.5, 30), mouseY = spring(.35, 30), glow = spring(0, 20);
  const entrance = spring(0, 26);
  const springs = [scrollS, tiltX, tiltY, mouseX, mouseY, glow, entrance];
  let lastScroll = scrollY, energy = 1, velocity = 0, auroraTime = 20;
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    mouseX.target = e.clientX / innerWidth; mouseY.target = e.clientY / innerHeight; glow.target = 1;
    if (fineMQ.matches && !isStatic()) {
      tiltX.target = clamp(e.clientY / innerHeight * 2 - 1, -1, 1) * -6;
      tiltY.target = clamp(e.clientX / innerWidth * 2 - 1, -1, 1) * 9;
    }
    wake();
  }, { passive: true });
  root.addEventListener('pointerleave', () => { tiltX.target = 0; tiltY.target = 0; glow.target = 0; wake(); });

  let aurora = null;
  try { aurora = createAurora(document.getElementById('aurora')); } catch { aurora = null; }
  if (!aurora) document.getElementById('aurora')?.classList.add('is-still');
  const heroCopy = document.querySelector('.hero-copy');
  const steps = [...document.querySelectorAll('.journey .step')];
  const stepHead = document.getElementById('step-head');
  const chapterEl = document.getElementById('nav-chapter');
  const scrubFill = document.getElementById('nav-scrub-fill');
  let activeStep = 0, chapterName = '';

  function render(now) {
    const y = isStatic() ? scrollY : scrollS.value;
    const pose = poseAt(isStatic() ? 0 : y);
    const e = entrance.value, tx = tiltX.value, ty = tiltY.value;
    const heroOut = clamp(scrollY / (vh * .55));
    if (heroCopy) put(heroCopy, '--out', isStatic() ? '0' : smooth(heroOut).toFixed(3));
    put(root, '--hero-out', heroOut.toFixed(3));

    if (pose && host && stageReady) {
      let opacity = pose.host.o;
      if (isStatic()) opacity = scrollY < vh * .6 ? 1 : 0;
      const hx = isStatic() ? 0 : pose.host.x * innerWidth + ty * 1.5, hy = isStatic() ? 0 : pose.host.y * vh - tx * 1.2;
      put(host, 'transform', `translate3d(${hx.toFixed(1)}px, ${hy.toFixed(1)}px, 0)`);
      put(host, 'opacity', opacity.toFixed(3));
      if (opacity < .01) host.dataset.offscreen = ''; else delete host.dataset.offscreen;
      const a = pose.phone, b = pose.watch;
      const ph = place(a, e, tx, ty, 1), wa = place(b, e * 1.25, tx, ty, 1.6);
      if (isStatic() && !devices3d) {
        // Paused CSS devices rest in their stylesheet pose.
        for (const el of [phone, watch]) if (written.has(el)) { for (const prop of ['transform', '--dim', '--spec']) el.style.removeProperty(prop); written.delete(el); }
      } else {
        put(phone, 'transform', css(ph)); put(phone, '--dim', a.dim.toFixed(3)); put(phone, '--spec', spec(ph));
        put(watch, 'transform', css(wa)); put(watch, '--spec', spec(wa));
      }
      devices3d?.update({ phone: { ...ph, dim: a.dim }, watch: wa, float: !isStatic(), seconds });
      devices3d?.setActive(!isStatic() && opacity > .01 && !document.hidden && !introPlaying());
      if (entranceShown && e < .02) host.classList.add('devices-arrived');
      const jp = journey ? (y - journey.top) / journey.len : -1;
      renderChip(isStatic() || !journey ? 0 : clamp((jp - .3) / .32), a, b);
      for (const t of tags) {
        const w = t.windowName === 'import' ? [.02, .12, .26, .33] : [.62, .72, 1, 1.12];
        const o = isStatic() || !journey ? 0 : (jp < w[1] ? smooth(clamp((jp - w[0]) / (w[1] - w[0]))) : 1 - smooth(clamp((jp - w[2]) / (w[3] - w[2])))) * (1 - e);
        put(t.el, 'opacity', o.toFixed(3));
        if (o <= 0) continue;
        const d = t.anchor === 'phone' ? ph : wa, bx = t.anchor === 'phone' ? 203 : 410, by = t.anchor === 'phone' ? 320 : 481;
        put(t.el, 'transform', `translate3d(${(bx + d.x + t.dx * d.s + ty * 3).toFixed(1)}px, ${(by + d.y + t.dy * d.s - tx * 3 + (1 - o) * 14).toFixed(1)}px, 0) translate(-50%, -50%)`);
      }
    }

    if (journey) {
      const jp = clamp((scrollY - journey.top) / journey.len);
      const s = Math.min(2, Math.floor(jp * 3));
      if (s !== activeStep) { activeStep = s; steps.forEach((el, i) => el.classList.toggle('is-active', i === s)); }
      if (stepHead) put(stepHead, 'transform', `translateX(${(jp * (stepHead.parentElement.clientWidth - 2)).toFixed(1)}px)`);
      const scrub = waves.find(w => w.el.dataset.kind === 'scrub');
      if (scrub && scrub.visible) drawWave(scrub, isStatic() ? 3 : now / 1000, energy, jp);
    }
    let name = chapters[0]?.name || '';
    for (const c of chapters) if (scrollY >= c.at) name = c.name;
    if (chapterEl && name !== chapterName) { chapterName = name; chapterEl.textContent = name; }
    if (scrubFill) put(scrubFill, 'transform', `scaleX(${clamp(scrollY / maxScroll).toFixed(4)})`);
    const t = isStatic() ? 3 : now / 1000;
    for (const w of waves) if (w.visible && w.el.dataset.kind !== 'scrub') drawWave(w, t, energy);
    if (aurora) {
      const level = smooth(clamp((scrollY - vh * .15) / (vh * .85)));
      aurora.render({ time: auroraTime, scroll: y / vh * .14, mouseX: mouseX.value, mouseY: mouseY.value, glow: glow.value * (fineMQ.matches ? 1 : 0) * level, mood: pose ? pose.mood : [1, .8, .4], level });
    }
  }

  let raf = 0, last = 0;
  // While the intro video plays over the page, nothing underneath renders (it is hidden, and the video gets the GPU).
  const introPlaying = () => root.classList.contains('intro-playing');
  function frame(now) {
    raf = 0;
    if (introPlaying()) { last = 0; return; }
    const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!isStatic()) auroraTime += dt;
    scrollS.target = scrollY;
    velocity = lerp(velocity, (scrollY - lastScroll) / Math.max(dt, .001), .15);
    lastScroll = scrollY;
    energy = 1 + Math.min(.6, Math.abs(velocity) / 3000);
    springs.forEach(s => s.step(dt));
    render(now);
    // Animated pages keep the aurora and waves alive; static ones render only on demand.
    const animating = !isStatic() && !document.hidden;
    const moving = springs.some(s => !s.settled());
    if (animating || moving) raf = requestAnimationFrame(frame); else last = 0;
  }
  function wake() { if (!raf && !document.hidden && !introPlaying()) raf = requestAnimationFrame(frame); }

  /* ── Stage reveal: hidden from the first paint (inline script) until its devices are ready ── */
  function startEntrance() {
    if (!stageReady || entranceStarted || isStatic() || root.classList.contains('intro-playing')) return;
    entranceStarted = true;
    if (scrollY > vh * .5) return;
    entranceShown = true;
    entrance.snap(1);
    entrance.target = 0;
    wake();
  }
  if (root.classList.contains('intro-playing')) {
    new MutationObserver((_, observer) => {
      if (root.classList.contains('intro-playing')) return;
      observer.disconnect();
      startEntrance();
      wake();
    }).observe(root, { attributes: true, attributeFilter: ['class'] });
  }
  function useCssDevices() {
    devices3d?.canvas.remove();
    devices3d = null;
    host?.classList.remove('webgl-devices');
  }
  function reveal() {
    stageReady = true;
    measure();
    scrollS.snap(scrollY);
    startEntrance();
    render(performance.now());
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('stage-pending')));
    wake();
  }
  function prepareStage() {
    if (!stage) { root.classList.remove('stage-pending'); return; }
    const capture = phone.querySelector('.phone-screen > img');
    const icon = phone.querySelector('.phone-brand img');
    const decoded = capture && capture.decode ? capture.decode().catch(() => {}) : Promise.resolve();
    const style = getComputedStyle(root);
    const colors = { violet: style.getPropertyValue('--violet').trim() || '#bfb1f6', mint: style.getPropertyValue('--mint').trim() || '#a6edd6' };
    const loading = script && capture && icon && 'WebGLRenderingContext' in window
      ? import(new URL(DEVICES_3D, script.src).href).then(module => module.createDevices3D({ host: stage, capture: capture.currentSrc || capture.src, icon: icon.currentSrc || icon.src, colors, onLost: useCssDevices }))
      : Promise.reject(new Error('3D devices unavailable'));
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      if (result) {
        devices3d = result;
        devices3d.setScale(stageScale);
        host.classList.add('webgl-devices');
      }
      decoded.then(reveal);
    };
    loading.then(finish, () => finish(null));
    // A late 3D stage is discarded rather than swapped in while someone is looking.
    setTimeout(() => finish(null), 3500);
    loading.then(late => { if (late !== devices3d) late.canvas.remove(); }, () => {});
  }

  /* ── Motion control ── */
  const toggle = document.querySelector('.motion-toggle');
  function syncMotion() {
    root.classList.toggle('motion-off', isStatic());
    if (toggle) {
      toggle.hidden = reduceMQ.matches;
      toggle.setAttribute('aria-pressed', String(paused));
      const label = paused ? 'Resume motion' : 'Pause motion';
      toggle.title = label;
      toggle.querySelector('.sr-only').textContent = label;
    }
    if (isStatic()) { tiltX.snap(0); tiltY.snap(0); entrance.snap(0); }
    scrollS.snap(scrollY);
    render(performance.now());
    wake();
  }
  toggle?.addEventListener('click', () => { paused = !paused; syncMotion(); });
  reduceMQ.addEventListener('change', syncMotion);

  // The illustrated Now Playing screen keeps time while the devices are on screen.
  setInterval(() => {
    if (isStatic() || document.hidden || !stageReady || host?.dataset.offscreen !== undefined) return;
    seconds = Math.min(seconds + 1, 22 * 60 + 4);
    if (elapsed) elapsed.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }, 1000);

  addEventListener('scroll', wake, { passive: true });
  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(measure, 80); }, { passive: true });
  mobileMQ.addEventListener('change', measure);
  document.addEventListener('visibilitychange', () => { devices3d?.setActive(!document.hidden && !isStatic()); if (!document.hidden) wake(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => measure()).observe(document.body);
  if (document.fonts?.ready) document.fonts.ready.then(measure);
  addEventListener('load', measure);
  root.classList.add('motion-ready');
  measure();
  syncMotion();
  prepareStage();
})();
