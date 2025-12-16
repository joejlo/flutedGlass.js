/* =========================================================
   Phase 1 – Core Fluted Glass Shader (Transparent Host)
   Webflow-friendly: use data-glass="true" (or any value except "false")
   Requires: three.min.js loaded globally before this file
   ========================================================= */
(function () {
  "use strict";

  if (!window.THREE) {
    console.warn("[glass] THREE not found. Load three.min.js before glass-phase-1.js");
    return;
  }

  const THREE = window.THREE;

  // Standard Three vertex shader (camera matrices applied)
  const VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Phase 1 TEST shader: hard flash so motion is impossible to miss
  // (We will replace this with the real glass shader once confirmed.)
  const FRAG = `
    precision mediump float;

    varying vec2 vUv;
    uniform float u_time;
    uniform vec3 u_color_one;
    uniform vec3 u_color_two;

    void main() {
      float pulse = step(0.5, fract(u_time * 4.0));  // ~4 flashes/sec
      vec3 color = mix(u_color_one, u_color_two, pulse);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function makeLookup(columns) {
    const size = 256;
    const data = new Uint8Array(size * 4);

    let idx = 0;
    const step = size / columns;

    for (let x = 0; x < size; x++) {
      if (x > (idx + 1) * step) idx++;
      data[x * 4] = idx;
      data[x * 4 + 3] = 255;
    }

    const tex = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function init(el) {
    // Prevent double-init
    if (el.__glassInit) return;
    el.__glassInit = true;

    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      console.warn("[glass] Element has no size. Give it a height/min-height.", el);
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(rect.width, rect.height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.pointerEvents = "none";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Match Webflow-style unit plane setup
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1);

    // Not used in the test shader, but kept for parity
    const lookup = makeLookup(parseInt(el.getAttribute("data-columns") || "5", 10));

    const uniforms = {
      u_time: { value: 0 },
      u_lookup: { value: lookup },
      u_color_one: { value: new THREE.Color(el.getAttribute("data-color-one") || "#741de2") },
      u_color_two: { value: new THREE.Color(el.getAttribute("data-color-two") || "#77bebb") },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    scene.add(mesh);

    // Resize handling
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        renderer.setSize(r.width, r.height, false);
      }, 120);
    });

    function frame(t) {
      // Console proof once per second
      if (((t | 0) % 1000) < 16) console.log("[glass] ticking", t | 0);

      uniforms.u_time.value = t * 0.001;
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("load", () => {
    document.querySelectorAll("[data-glass]").forEach((el) => {
      const val = el.getAttribute("data-glass");
      if (val !== "false") init(el);
    });
  });
})();
