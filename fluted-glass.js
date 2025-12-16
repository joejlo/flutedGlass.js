/* =========================================================
   Phase 1 – Core Fluted Glass Shader (Transparent)
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

  const VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Phase 1 "real" shader: transparent glass blobs + fluting + grain + obvious drift
  const FRAG = `
    precision mediump float;

    varying vec2 vUv;

    uniform float u_time;
    uniform float u_aspect;
    uniform sampler2D u_lookup;
    uniform float u_distortion;

    uniform vec3 u_color_one;
    uniform vec3 u_color_two;

    float rand(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float blob(vec2 p, vec2 c, float r, float t) {
      vec2 d = p - c;
      float dist = length(d);

      // Organic edge wobble
      float ang = atan(d.y, d.x);
      float edge = sin(ang * 4.0 + t * 0.9) * 0.05 +
                   sin(ang * 7.0 - t * 0.7) * 0.03;

      float rr = r * (1.0 + edge);
      float n = clamp(1.0 - dist / rr, 0.0, 1.0);

      // Smooth falloff (nicer than linear)
      return n * n * (3.0 - 2.0 * n);
    }

    void main() {
      // Fluting via lookup: offset x based on column index
      float col = texture2D(u_lookup, vec2(vUv.x, 0.0)).r * 255.0;
      float off = (rand(vec2(col, col)) - 0.5) * u_distortion;

      vec2 uv = vUv;
      uv.x += off * 0.8;

      // Aspect-correct working space
      vec2 p = vec2(uv.x * u_aspect, uv.y);
      float t = u_time;

      // Clearly visible drift (we'll make this subtler later)
      vec2 c1 = vec2(0.28 * u_aspect + 0.06 * sin(t * 0.9),  0.62 + 0.05 * cos(t * 0.7));
      vec2 c2 = vec2(0.72 * u_aspect + 0.05 * cos(t * 0.8),  0.38 + 0.06 * sin(t * 0.6));

      float a = blob(p, c1, 0.55, t);
      float b = blob(p, c2, 0.55, t + 10.0);

      float alpha = max(a, b);

      // Two-colour blend
      vec3 colr = mix(u_color_one, u_color_two, b);

      // Grain to break flatness (subtle)
      float g = (rand(vUv * 280.0 + t * 12.0) - 0.5) * 0.05;
      colr += g;

      // Transparent output: only draw where blobs exist
      gl_FragColor = vec4(colr, alpha * 0.85);
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
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1);

    const columns = parseInt(el.getAttribute("data-columns") || "6", 10);
    const lookup = makeLookup(Number.isFinite(columns) ? columns : 6);

    const uniforms = {
      u_time: { value: 0 },
      u_aspect: { value: rect.width / rect.height },
      u_lookup: { value: lookup },
      u_distortion: { value: parseFloat(el.getAttribute("data-distortion") || "0.28") },
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

    // Resize (basic for Phase 1)
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        renderer.setSize(r.width, r.height, false);
        uniforms.u_aspect.value = r.width / r.height;
      }, 120);
    });

    function frame(t) {
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
