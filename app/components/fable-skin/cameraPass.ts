import { Vector2 } from "three";

/**
 * The camera pass: what turns a clean render into a phone photograph taken
 * through a dermatoscope. Runs as a ShaderPass after bloom and before the
 * OutputPass, so it sees LINEAR HDR radiance in a half-float target and
 * never touches tone mapping or sRGB — OutputPass does both afterwards.
 *
 * Four effects, all small, all in the order a camera pipeline applies them:
 *
 * 1. Lateral chromatic aberration. The lens spreads red and blue radially,
 *    zero at the centre, uAberration px at the frame corner (quadratic in
 *    radius, so the lesion at the centre stays crisp). Red samples outward,
 *    blue inward, green stays put. Two extra taps.
 * 2. Unsharp mask. Phone ISPs oversharpen; iPhones noticeably so. A 1 px
 *    cross (5 taps) on luminance only, scaled back onto the colour as a
 *    ratio so chroma never rings. The detail term is clamped so the LED
 *    glare — which bloom has just made bright — does not grow a halo.
 * 3. Sensor grain. Per-pixel hash noise, re-seeded every frame through
 *    uSeed, triangular-distributed (two hashes summed) so it reads as grain
 *    rather than salt. Amplitude uGrain in linear, boosted in the shadows
 *    where read noise dominates a real sensor.
 * 4. Lens vignette. The instrument's dark field edge is already in the skin
 *    shader; this is only the camera's own cos⁴ falloff, uVignette at the
 *    corners.
 *
 * Seven texture taps in total.
 */
export const CAMERA_PASS_SHADER = {
  name: "FableCameraPass",

  uniforms: {
    tDiffuse: { value: null as unknown },
    /** Drawing-buffer size, device pixels. */
    uResolution: { value: new Vector2(1, 1) },
    /** Any value that changes per frame; drives the grain hash. */
    uSeed: { value: 0 },
    /** Unsharp-mask amount, 0 = off. */
    uSharpen: { value: 0.35 },
    /** Red/blue radial spread at the frame corner, device px. */
    uAberration: { value: 1.5 },
    /** Grain amplitude in linear radiance. */
    uGrain: { value: 0.012 },
    /** Corner darkening, 0..1. */
    uVignette: { value: 0.08 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uSeed;
    uniform float uSharpen;
    uniform float uAberration;
    uniform float uGrain;
    uniform float uVignette;
    varying vec2 vUv;

    float cp_luma(vec3 c) {
      return dot(c, vec3(0.2126, 0.7152, 0.0722));
    }

    // Integer-pixel hash; stable per pixel for a given seed, decorrelated
    // between seeds. Good enough for grain, cheap enough for every pixel.
    float cp_hash(vec2 p) {
      vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }

    void main() {
      vec2 texel = 1.0 / uResolution;
      // 0 at the centre, 1 at the frame corner, whatever the aspect.
      vec2 fromCentre = vUv - 0.5;
      float r = length(fromCentre) * 1.41421356;
      vec2 dir = r > 1e-4 ? normalize(fromCentre) : vec2(0.0);

      // ---- chromatic aberration (2 extra taps)
      vec2 shift = dir * (uAberration * r * r) * texel;
      vec4 centre = texture2D(tDiffuse, vUv);
      float red = texture2D(tDiffuse, vUv + shift).r;
      float blue = texture2D(tDiffuse, vUv - shift).b;
      vec3 c = vec3(red, centre.g, blue);

      // ---- unsharp mask on luminance (4 neighbour taps)
      float l = cp_luma(centre.rgb);
      float lN = cp_luma(texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb);
      float lS = cp_luma(texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb);
      float lE = cp_luma(texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb);
      float lW = cp_luma(texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb);
      float blur = (4.0 * l + lN + lS + lE + lW) * 0.125;
      // Clamped so a bright glare edge sharpens like skin, not like a star.
      float detail = clamp(l - blur, -0.25, 0.25);
      float lSharp = max(l + uSharpen * detail, 0.0);
      c *= lSharp / max(l, 1e-4);

      // ---- sensor grain
      vec2 px = floor(gl_FragCoord.xy);
      vec2 seed = vec2(uSeed * 17.0, uSeed * 31.0);
      float n = cp_hash(px + seed) + cp_hash(px * 1.37 + seed + 71.0) - 1.0;
      float shadow = 1.0 - smoothstep(0.0, 0.2, lSharp);
      c += n * uGrain * (1.0 + 0.8 * shadow);

      // ---- lens vignette
      c *= 1.0 - uVignette * r * r;

      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }
  `,
};
