// Home page motion: rotating AI names in the headline, a 3D dot globe in the hero,
// the type-and-encrypt showcase, scroll reveals and a gentle hero scroll effect.
// Everything stops when off screen and is skipped for reduced motion.
(() => {
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const landing = $('[data-screen="hero"]');
  const onLanding = () => landing.classList.contains("is-active") && !document.hidden;

  // ---------- Rotating AI names ----------
  // The slot's width eases between names so the rest of the headline never jumps.

  function rotator() {
    const box = $("[data-rotator]");
    const words = $$(".ai-word", box);
    let i = 0;
    const fit = () => { box.style.width = `${words[i].offsetWidth}px`; };
    fit();
    addEventListener("resize", fit);
    document.fonts?.ready.then(fit);
    if (reduced) return;
    setInterval(() => {
      if (!onLanding()) return;
      words[i].classList.remove("is-on");
      i = (i + 1) % words.length;
      words[i].classList.add("is-on");
      fit();
    }, 2200);
  }

  // ---------- 3D dot globe ----------

  function globe() {
    const canvas = $("[data-globe]");
    const panel = $("[data-hero-panel]");
    const ctx = canvas.getContext("2d");
    const N = 1400;
    const golden = Math.PI * (3 - Math.sqrt(5));
    // Each dot gets its own twinkle phase and speed, like distant stars.
    const pts = Array.from({ length: N }, (_, k) => {
      const y = 1 - (k / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      return [Math.cos(golden * k) * r, y, Math.sin(golden * k) * r, Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.7];
    });
    let t = 0;
    let w = 0, h = 0, rot = 0, mx = 0, my = 0, tx = 0, ty = 0, visible = true, raf = 0;

    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const R = Math.max(w * 0.62, h * 0.9);
      const cx = w / 2 + tx * 18;
      const cy = h + R * 0.42 + ty * 10;
      const ry = rot + tx * 0.25;
      const rx = -0.32 + ty * 0.1;
      const cy1 = Math.cos(ry), sy1 = Math.sin(ry), cx1 = Math.cos(rx), sx1 = Math.sin(rx);

      // Soft horizon glow
      const glow = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.25);
      glow.addColorStop(0, "rgba(160, 170, 255, 0.10)");
      glow.addColorStop(1, "rgba(160, 170, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      for (const [x, y, z, phase, speed] of pts) {
        const X = x * cy1 + z * sy1;
        let Z = -x * sy1 + z * cy1;
        const Y = y * cx1 - Z * sx1;
        Z = y * sx1 + Z * cx1;
        const px = cx + X * R;
        const py = cy - Y * R;
        if (py > h + 4 || px < -4 || px > w + 4) continue;
        const depth = (Z + 1) / 2;
        const twinkle = 0.65 + 0.35 * Math.sin(t * speed + phase);
        ctx.globalAlpha = (Z > 0 ? 0.12 + depth * 0.5 : 0.05) * twinkle;
        ctx.fillStyle = "#dfe3f0";
        const s = 0.6 + depth * 1.1;
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    }

    function loop() {
      raf = 0;
      if (!visible || !onLanding()) return;
      rot += 0.00035;
      t += 0.012;
      tx += (mx - tx) * 0.02;
      ty += (my - ty) * 0.02;
      draw();
      raf = requestAnimationFrame(loop);
    }
    const start = () => { if (!raf && !reduced) raf = requestAnimationFrame(loop); };

    size();
    draw();
    addEventListener("resize", () => { size(); draw(); });
    panel.addEventListener("pointermove", (e) => {
      const r = panel.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width * 2 - 1;
      my = (e.clientY - r.top) / r.height * 2 - 1;
    });
    panel.addEventListener("pointerleave", () => { mx = my = 0; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(panel);
    document.addEventListener("visibilitychange", start);
    addEventListener("hashchange", () => setTimeout(start, 50));
    start();
  }

  // ---------- Type and encrypt ----------

  const QUESTIONS = [
    "Can we terminate the Main St. lease if the tenant is 90 days behind on rent?",
    "A former employee says we owe overtime. What's our exposure before we respond?",
    "The supplier missed delivery twice. Do we have grounds to cancel the contract?",
  ];
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const noise = (n) => Array.from({ length: n }, () => B64[Math.floor(Math.random() * 64)]).join("");

  function showcase() {
    const stage = $("[data-stage]");
    const typed = $("[data-typed]");
    const cipher = $("[data-cipher-anim]");
    let q = 0, running = false, timer = 0;

    if (reduced) {
      typed.textContent = QUESTIONS[0];
      cipher.textContent = noise(Math.round(QUESTIONS[0].length * 1.35)) + "==";
      return;
    }

    // Each typed character adds encrypted characters on the right; the tail keeps churning.
    function play() {
      const text = QUESTIONS[q];
      const total = Math.round(text.length * 1.35);
      let i = 0;
      let out = "";
      const step = () => {
        if (!running) return;
        if (i <= text.length) {
          typed.textContent = text.slice(0, i);
          const target = Math.round((i / text.length) * total);
          out = (out + noise(Math.max(0, target - out.length))).slice(0, target);
          cipher.textContent = out.slice(0, Math.max(0, out.length - 6)) + noise(Math.min(6, out.length));
          i += 1;
          timer = setTimeout(step, 28 + Math.random() * 30);
        } else {
          cipher.textContent = out + "==";
          timer = setTimeout(() => {
            q = (q + 1) % QUESTIONS.length;
            play();
          }, 3200);
        }
      };
      step();
    }

    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) {
        running = true;
        play();
      } else if (!e.isIntersecting && running) {
        running = false;
        clearTimeout(timer);
      }
    }, { threshold: 0.3 }).observe(stage);

    // Cards tilt toward the pointer
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      stage.style.setProperty("--tx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      stage.style.setProperty("--ty", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    stage.addEventListener("pointerleave", () => {
      stage.style.setProperty("--tx", 0);
      stage.style.setProperty("--ty", 0);
    });
  }

  // ---------- Scroll reveals and hero scroll effect ----------

  function reveals() {
    if (reduced || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("reveal-ready");
    // Stagger siblings that reveal together
    $$(".how [data-reveal], .faq[data-reveal]").forEach((el) => {
      const i = [...el.parentElement.children].filter((c) => c.hasAttribute("data-reveal")).indexOf(el);
      el.style.setProperty("--d", `${i * 80}ms`);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    $$("[data-reveal]").forEach((el) => io.observe(el));
  }

  function heroScroll() {
    if (reduced) return;
    const panel = $("[data-hero-panel]");
    const stage = $("[data-stage]");
    let ticking = false;
    const update = () => {
      ticking = false;
      if (!onLanding()) return;
      const vh = innerHeight;
      const p = Math.min(1, Math.max(0, scrollY / (vh * 0.75)));
      panel.style.setProperty("--p", p.toFixed(3));
      // Cards straighten as they reach the middle of the screen
      const r = stage.getBoundingClientRect();
      const c = Math.min(1, Math.max(-1, (r.top + r.height / 2 - vh / 2) / (vh / 2)));
      stage.style.setProperty("--sp", c.toFixed(3));
    };
    addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  // ---------- 3D tilt for cards ----------
  // Cards lean toward the pointer, with a soft sheen that follows it.

  function tilt() {
    if (reduced) return;
    $$("[data-tilt]").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--rx", `${((0.5 - y) * 10).toFixed(2)}deg`);
        card.style.setProperty("--ry", `${((x - 0.5) * 12).toFixed(2)}deg`);
        card.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
        card.classList.add("is-tilting");
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
        card.classList.remove("is-tilting");
      });
    });
  }

  // ---------- Smooth, slightly delayed wheel scrolling ----------
  // The page eases toward where the wheel points instead of jumping there. Touch,
  // keyboard and scrollbar keep their native behavior.

  function smoothScroll() {
    if (reduced) return;
    let target = scrollY;
    let current = scrollY;
    let raf = 0;
    const max = () => document.documentElement.scrollHeight - innerHeight;

    const step = () => {
      current += (target - current) * 0.09;
      const done = Math.abs(target - current) < 0.5;
      if (done) current = target;
      scrollTo({ top: current, behavior: "instant" });
      raf = done ? 0 : requestAnimationFrame(step);
    };

    addEventListener("wheel", (e) => {
      if (!landing.classList.contains("is-active") || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (!raf) target = current = scrollY;
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1;
      target = Math.min(max(), Math.max(0, target + e.deltaY * unit));
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: false });

    // Stay in sync when something else scrolls the page (links, keys, scrollbar).
    addEventListener("scroll", () => { if (!raf) target = current = scrollY; }, { passive: true });
  }

  rotator();
  tilt();
  smoothScroll();
  globe();
  showcase();
  reveals();
  heroScroll();
})();
