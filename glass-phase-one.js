/* =========================================================
   Phase 1 – Core Fluted Glass Shader (Transparent)
   Requires: three.min.js loaded globally
   ========================================================= */
(function () {
  if (!window.THREE) {
    console.warn("[glass] THREE not found");
    return;
  }

  const VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

  const FRAG = `
    precision mediump float;

    varying vec2 vUv;
    uniform float u_time;
    uniform float u_aspect;
    uniform sampler2D u_lookup;
    uniform float u_distortion;

    uniform vec3 u_color_one;
    uniform vec3 u_color_two;

    float hash(float n) {
      return fract(sin(n) * 43758.5453);
    }

    float blob(vec2 p, vec2 c, float r) {
      float d = length(p - c);
      float t = clamp(1.0 - d / r, 0.0, 1.0);
      return t * t;
    }

    void main() {
      // Fluting via lookup texture
      float col = texture2D(u_lookup, vec2(vUv.x, 0.0)).r * 255.0;
      float off = (hash(col) - 0.5) * u_distortion;

      vec2 uv = vUv;
      uv.x += off;

      vec2 p = vec2(uv.x * u_aspect, uv.y);

      float a = blob(p, vec2(0.3 * u_aspect, 0.6), 0.35);
      float b = blob(p, vec2(0.7 * u_aspect, 0.4), 0.35);

      float alpha = max(a, b);

      vec3 colr = mix(u_color_one, u_color_two, b);
      gl_FragColor = vec4(colr, alpha);
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
    return tex;
  }

  function init(el) {
    const rect = el.getBoundingClientRect();
    if (rect.height < 2) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(rect.width, rect.height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    const lookup = makeLookup(parseInt(el.getAttribute("data-columns") || "5", 10));

    const uniforms = {
      u_time: { value: 0 },
      u_aspect: { value: rect.width / rect.height },
      u_lookup: { value: lookup },
      u_distortion: { value: parseFloat(el.getAttribute("data-distortion") || "0.25") },
      u_color_one: { value: new THREE.Color(el.getAttribute("data-color-one") || "#741de2") },
      u_color_two: { value: new THREE.Color(el.getAttribute("data-color-two") || "#77bebb") }
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    function frame(t) {
      uniforms.u_time.value = t * 0.001;
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("load", () => {
    document.querySelectorAll("[data-glass]").forEach(init);
  });
})();
