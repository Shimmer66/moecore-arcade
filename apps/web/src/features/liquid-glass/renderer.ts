export interface GlassSurface {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  pointerX: number;
  pointerY: number;
  activity: number;
  pressed: number;
  tint?: number;
}

const vertexSource = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const fragmentSource = `
precision highp float;
uniform vec2 uViewport;
uniform vec2 uPixels;
uniform vec2 uBackdropScale;
uniform vec4 uRect;
uniform vec4 uInteraction;
uniform float uRadius;
uniform float uTint;
uniform sampler2D uScene;

// Match the fixed CSS wallpaper's centered background-size: cover crop.
vec3 scene(vec2 position) {
  vec2 uv = clamp((position / uViewport - 0.5) * uBackdropScale + 0.5, vec2(0.001), vec2(0.999));
  return texture2D(uScene, vec2(uv.x, 1.0 - uv.y)).rgb;
}

float roundedBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float smoothUnion(float a, float b, float radius) {
  float h = clamp(0.5 + 0.5 * (b - a) / radius, 0.0, 1.0);
  return mix(b, a, h) - radius * h * (1.0 - h);
}

float outline(vec2 p) {
  vec2 halfSize = uRect.zw * 0.5;
  vec2 pointer = uInteraction.xy;
  float activity = uInteraction.z;
  float pressed = uInteraction.w;
  if (activity < 0.001) return roundedBox(p, halfSize, uRadius);
  vec2 point = pointer * halfSize;
  float reach = max(28.0, min(halfSize.x, halfSize.y) * 0.9);
  vec2 proximity = (p - point) / reach;
  float influence = exp(-dot(proximity, proximity));
  // A local elastic bulge follows the spring-driven pointer, not a CSS border.
  vec2 elastic = pointer * influence * activity * (1.5 + pressed * 1.7);
  float distance = roundedBox(p - elastic, halfSize, uRadius);
  float adhesion = activity * smoothstep(0.40, 0.97, max(abs(pointer.x), abs(pointer.y)));
  if (adhesion > 0.005) {
    float droplet = min(6.0, min(halfSize.x, halfSize.y) * 0.18) * adhesion;
    vec2 anchor = clamp(point, -halfSize + uRadius, halfSize - uRadius);
    if (abs(pointer.x) > abs(pointer.y)) {
      anchor.x = sign(pointer.x) * (halfSize.x - droplet * 0.30);
    } else {
      anchor.y = sign(pointer.y) * (halfSize.y - droplet * 0.30);
    }
    distance = smoothUnion(distance, length(p - anchor) - droplet, 5.5 * adhesion);
  }
  return distance;
}

float heightAt(vec2 p) {
  float inward = max(0.0, -outline(p));
  float shoulder = max(3.0, min(uRadius * 0.90, 21.0));
  float t = clamp(inward / shoulder, 0.0, 1.0);
  // An elliptical shoulder gives real thickness and a nearly planar center.
  float profile = sqrt(max(0.0, 1.0 - (1.0 - t) * (1.0 - t)));
  return (3.2 + min(uRadius * 0.25, 5.5)) * profile * (1.0 - uInteraction.w * 0.13);
}

vec2 gradientAt(vec2 p) {
  const float epsilon = 0.7;
  return vec2(
    heightAt(p + vec2(epsilon, 0.0)) - heightAt(p - vec2(epsilon, 0.0)),
    heightAt(p + vec2(0.0, epsilon)) - heightAt(p - vec2(0.0, epsilon))
  ) / (2.0 * epsilon);
}

void main() {
  vec2 screen = vec2(gl_FragCoord.x / uPixels.x, 1.0 - gl_FragCoord.y / uPixels.y) * uViewport;
  vec2 local = screen - uRect.xy - uRect.zw * 0.5;
  float distance = outline(local);
  float antialias = uViewport.x / uPixels.x;
  float coverage = 1.0 - smoothstep(-antialias, antialias, distance);
  // Shadow is composited after the optical body and its highlights.
  float shadow = 0.0;
  if (coverage < 0.999) {
    float shadowDistance = outline(local - vec2(0.0, 5.0));
    shadow = exp(-max(0.0, shadowDistance) / 7.0) * 0.105 * (1.0 - coverage);
  }
  if (coverage < 0.001) {
    gl_FragColor = vec4(0.243, 0.357, 0.466, shadow);
    return;
  }

  float inward = max(0.0, -distance);
  float shoulder = max(3.0, min(uRadius * 0.90, 21.0));
  // The planar center has zero height gradient at both interfaces: Snell's
  // law leaves its incident ray unchanged. Skip the redundant normal samples.
  if (inward > shoulder * 1.05 + 1.0) {
    vec3 transmitted = scene(screen);
    float luminance = dot(transmitted, vec3(0.2126, 0.7152, 0.0722));
    transmitted = mix(transmitted, vec3(luminance), 0.035);
    transmitted *= vec3(0.996, 1.002, 1.005);
    transmitted = mix(transmitted, transmitted * vec3(0.90, 0.94, 1.045), uTint * 0.18);
    vec3 environment = scene(screen - vec2(0.0, 20.0));
    gl_FragColor = vec4(mix(transmitted, environment, 0.035 * 0.55), 1.0);
    return;
  }
  float center = smoothstep(shoulder * 0.65, shoulder * 1.05, inward);
  float outer = 1.0 - smoothstep(0.0, 2.5, inward);
  float inner = (1.0 - center) * (1.0 - outer);
  vec2 gradient = gradientAt(local);
  vec3 normal = normalize(vec3(-gradient, 1.0));
  const float glassIor = 1.46;
  vec3 incident = vec3(0.0, 0.0, -1.0);
  vec3 inside = refract(incident, normal, 1.0 / glassIor);

  // Two Snell interfaces: air -> front surface -> glass thickness -> back
  // surface -> air. One intersection correction approximates the curved back
  // surface without an expensive ray march. Back thickness is 35% of front.
  float height = heightAt(local);
  float travel = height * 1.35 / max(0.18, -inside.z);
  vec2 backPoint = local + inside.xy * travel;
  travel = (height + heightAt(backPoint) * 0.35) / max(0.18, -inside.z);
  backPoint = local + inside.xy * travel;
  vec3 backNormal = normalize(vec3(gradientAt(backPoint) * 0.35, 1.0));
  vec3 outgoing = refract(inside, backNormal, glassIor);
  float totalReflection = 1.0 - step(0.001, dot(outgoing, outgoing));
  // A grazing ray uses the reflected environment rather than a singular offset.
  outgoing = mix(outgoing, reflect(inside, backNormal), totalReflection);
  vec2 offset = inside.xy * travel + outgoing.xy * (42.0 / max(0.30, abs(outgoing.z)));
  offset = clamp(offset, vec2(-46.0), vec2(46.0));

  // Three optical regions: the flat center transmits a crisp scene; the inner
  // shoulder bends and disperses it; the outer rim adds Fresnel reflection.
  float dispersion = 0.002 * center + 0.024 * inner + 0.042 * outer;
  vec3 transmitted;
  transmitted.r = scene(screen + offset * (1.0 + dispersion)).r;
  transmitted.g = scene(screen + offset).g;
  transmitted.b = scene(screen + offset * (1.0 - dispersion)).b;
  float luminance = dot(transmitted, vec3(0.2126, 0.7152, 0.0722));
  transmitted = mix(transmitted, vec3(luminance), center * 0.035);
  transmitted *= vec3(0.996, 1.002, 1.005);
  transmitted = mix(transmitted, transmitted * vec3(0.90, 0.94, 1.045), uTint * 0.18);

  float fresnel = 0.035 + 0.965 * pow(1.0 - max(0.0, normal.z), 5.0);
  vec3 environment = scene(screen + normal.xy * 78.0 - vec2(0.0, 20.0));
  vec3 color = mix(transmitted, environment, clamp(fresnel * 0.55 + totalReflection * 0.26, 0.0, 0.65));

  vec3 light = normalize(vec3(-0.58, -0.72, 0.78));
  vec3 halfway = normalize(light + vec3(0.0, 0.0, 1.0));
  float specular = pow(max(0.0, dot(normal, halfway)), 78.0);
  float rim = exp(-abs(distance + 0.75) * 1.35);
  float edgeLight = max(0.0, dot(normal.xy, normalize(vec2(-0.65, -0.76))));
  color += vec3(0.79, 0.92, 1.0) * specular * (1.0 - center) * 0.19;
  color += vec3(0.69, 0.87, 1.0) * rim * (0.016 + edgeLight * 0.12);
  color += vec3(0.090, 0.024, 0.12) * inner * specular * 0.16;
  // Directional rim occlusion, never a uniform white outline or white panel.
  float occlusion = rim * max(0.0, dot(normal.xy, normalize(vec2(0.65, 0.76))));
  color *= 1.0 - occlusion * 0.23 - inner * 0.018;
  float alpha = coverage + shadow;
  color = mix(vec3(0.243, 0.357, 0.466), color, coverage / max(alpha, 0.001));
  gl_FragColor = vec4(color, alpha);
}
`;

/** Optical surfaces sampling the same image as the CSS wallpaper. */
export function createGlassRenderer(
  canvas: HTMLCanvasElement,
  backdrop: HTMLImageElement,
): {
  render: (surfaces: GlassSurface[], time: number) => void;
  dispose: () => void;
} | null {
  let gl: WebGLRenderingContext | null;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
  } catch {
    return null;
  }
  if (!gl) return null;
  const context = gl;
  const shaders: WebGLShader[] = [];
  const compile = (type: number, source: string) => {
    const shader = context.createShader(type);
    if (!shader) return null;
    shaders.push(shader);
    context.shaderSource(shader, source);
    context.compileShader(shader);
    return context.getShaderParameter(shader, context.COMPILE_STATUS) ? shader : null;
  };
  const precision = context.getShaderPrecisionFormat(context.FRAGMENT_SHADER, context.HIGH_FLOAT);
  const vertex = compile(context.VERTEX_SHADER, vertexSource);
  const fragment = compile(
    context.FRAGMENT_SHADER,
    precision?.precision ? fragmentSource : fragmentSource.replace('highp', 'mediump'),
  );
  const program = context.createProgram();
  const buffer = context.createBuffer();
  const texture = context.createTexture();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    shaders.forEach((shader) => context.deleteShader(shader));
    context.deleteProgram(program);
    context.deleteBuffer(buffer);
    context.deleteTexture(texture);
  };
  if (!vertex || !fragment || !program || !buffer || !texture) {
    dispose();
    return null;
  }
  context.attachShader(program, vertex);
  context.attachShader(program, fragment);
  context.linkProgram(program);
  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    dispose();
    return null;
  }
  context.useProgram(program);
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    context.STATIC_DRAW,
  );
  const position = context.getAttribLocation(program, 'aPosition');
  context.enableVertexAttribArray(position);
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
  const uniforms = {
    viewport: context.getUniformLocation(program, 'uViewport'),
    pixels: context.getUniformLocation(program, 'uPixels'),
    backdropScale: context.getUniformLocation(program, 'uBackdropScale'),
    rect: context.getUniformLocation(program, 'uRect'),
    interaction: context.getUniformLocation(program, 'uInteraction'),
    radius: context.getUniformLocation(program, 'uRadius'),
    tint: context.getUniformLocation(program, 'uTint'),
    scene: context.getUniformLocation(program, 'uScene'),
  };
  context.activeTexture(context.TEXTURE0);
  context.bindTexture(context.TEXTURE_2D, texture);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
  try {
    context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, true);
    context.texImage2D(
      context.TEXTURE_2D,
      0,
      context.RGBA,
      context.RGBA,
      context.UNSIGNED_BYTE,
      backdrop,
    );
    if (context.getError() !== context.NO_ERROR) throw new Error('Wallpaper texture unavailable');
  } catch {
    dispose();
    return null;
  }
  context.uniform1i(uniforms.scene, 0);
  context.blendFuncSeparate(
    context.SRC_ALPHA,
    context.ONE_MINUS_SRC_ALPHA,
    context.ONE,
    context.ONE_MINUS_SRC_ALPHA,
  );
  context.clearColor(0, 0, 0, 0);

  let viewportWidth = 0;
  let viewportHeight = 0;
  let pixelRatio = 0;
  let qualityCap = 1.5;
  let previousRender = 0;
  let previousAnimationTime = 0;
  let sampledFrames = 0;
  let sampledDuration = 0;

  function adaptQuality(time: number) {
    const now = performance.now();
    const interval = now - previousRender;
    const animationDelta = time - previousAnimationTime;
    // The driver advances active animation by at most 1/30 s and restarts an
    // idle animation at 1/60 s. Ignore that restart, long idle gaps and frozen
    // reduced-motion frames; retain slow active frames, including >100 ms.
    const activeInterval =
      previousRender > 0 &&
      animationDelta > 0 &&
      interval < 1000 &&
      (interval < 80 || animationDelta > 1 / 40);
    if (activeInterval && qualityCap > 0.6) {
      sampledFrames += 1;
      sampledDuration += interval;
      if (sampledFrames >= 8) {
        if (sampledDuration / sampledFrames > 38) qualityCap = qualityCap > 0.75 ? 0.75 : 0.6;
        sampledFrames = 0;
        sampledDuration = 0;
      }
    } else {
      sampledFrames = 0;
      sampledDuration = 0;
    }
    previousRender = now;
    previousAnimationTime = time;
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, width < 768 ? 1 : 1.5, qualityCap);
    if (width === viewportWidth && height === viewportHeight && ratio === pixelRatio) return;
    viewportWidth = width;
    viewportHeight = height;
    pixelRatio = ratio;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.viewport(0, 0, canvas.width, canvas.height);
    context.uniform2f(uniforms.viewport, width, height);
    context.uniform2f(uniforms.pixels, canvas.width, canvas.height);
    const cover = Math.max(width / backdrop.naturalWidth, height / backdrop.naturalHeight);
    context.uniform2f(
      uniforms.backdropScale,
      width / (backdrop.naturalWidth * cover),
      height / (backdrop.naturalHeight * cover),
    );
  }
  try {
    resize();
  } catch {
    dispose();
    return null;
  }

  return {
    render(surfaces, time) {
      if (disposed || context.isContextLost()) return;
      adaptQuality(time);
      resize();
      context.disable(context.SCISSOR_TEST);
      context.clear(context.COLOR_BUFFER_BIT);
      context.bindTexture(context.TEXTURE_2D, texture);
      context.enable(context.SCISSOR_TEST);
      context.enable(context.BLEND);
      for (const surface of surfaces) {
        if (surface.width <= 0 || surface.height <= 0) continue;
        const padding = 30;
        const left = Math.max(0, Math.floor((surface.x - padding) * pixelRatio));
        const right = Math.min(
          canvas.width,
          Math.ceil((surface.x + surface.width + padding) * pixelRatio),
        );
        const top = Math.max(0, Math.floor((surface.y - padding) * pixelRatio));
        const bottom = Math.min(
          canvas.height,
          Math.ceil((surface.y + surface.height + padding) * pixelRatio),
        );
        if (right <= left || bottom <= top) continue;
        context.scissor(left, canvas.height - bottom, right - left, bottom - top);
        context.uniform4f(uniforms.rect, surface.x, surface.y, surface.width, surface.height);
        context.uniform4f(
          uniforms.interaction,
          surface.pointerX,
          surface.pointerY,
          surface.activity,
          surface.pressed,
        );
        context.uniform1f(
          uniforms.radius,
          Math.max(1, Math.min(surface.radius, surface.width * 0.5, surface.height * 0.5)),
        );
        context.uniform1f(uniforms.tint, surface.tint ?? 0);
        context.drawArrays(context.TRIANGLES, 0, 6);
      }
      context.disable(context.SCISSOR_TEST);
      context.disable(context.BLEND);
    },
    dispose,
  };
}
