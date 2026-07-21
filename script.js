const canvas = document.querySelector('.portrait-canvas');

if (canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: true,
    preserveDrawingBuffer: false,
  });

  if (gl) {
    const vertexSource = `
      attribute vec2 position;
      varying vec2 uv;

      void main() {
        uv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // A single texture is deformed in one GPU pass. No duplicate portrait layers are used.
    const fragmentSource = `
      precision highp float;
      uniform sampler2D portrait;
      uniform float blinkAmount;
      uniform float expressionAmount;
      uniform float breezeAmount;
      varying vec2 uv;

      float ellipseMask(vec2 point, vec2 center, vec2 radius) {
        float distanceFromCenter = length((point - center) / radius);
        return 1.0 - smoothstep(0.72, 1.0, distanceFromCenter);
      }

      vec2 closeEye(vec2 point, vec2 center, float amount) {
        vec2 radius = vec2(0.052, 0.025);
        float mask = ellipseMask(point, center, radius);
        float side = point.y < center.y ? -1.0 : 1.0;
        float lidEdge = center.y + side * radius.y * 0.76;
        point.y = mix(point.y, lidEdge, amount * mask * 0.94);
        return point;
      }

      void main() {
        vec2 samplePoint = uv;

        // The upper and lower eyelid textures meet along the natural eye curve.
        samplePoint = closeEye(samplePoint, vec2(0.433, 0.313), blinkAmount);
        samplePoint = closeEye(samplePoint, vec2(0.560, 0.313), blinkAmount);

        // A tiny asymmetric mouth/cheek deformation, strongest at the right lip corner.
        vec2 mouthDelta = samplePoint - vec2(0.548, 0.457);
        float mouthMask = exp(-dot(mouthDelta / vec2(0.100, 0.068), mouthDelta / vec2(0.100, 0.068)) * 2.0);
        float cornerBias = smoothstep(-0.07, 0.07, mouthDelta.x);
        samplePoint.x -= expressionAmount * mouthMask * cornerBias * 0.0024;
        samplePoint.y += expressionAmount * mouthMask * cornerBias * 0.0032;

        // The hair root stays still while a narrow lock bends progressively toward its tip.
        float hairWidth = 0.055 + samplePoint.y * 0.035;
        float hairCenter = 0.285 - (samplePoint.y - 0.18) * 0.12;
        float strandMask = 1.0 - smoothstep(hairWidth * 0.45, hairWidth, abs(samplePoint.x - hairCenter));
        strandMask *= smoothstep(0.18, 0.32, samplePoint.y) * (1.0 - smoothstep(0.70, 0.79, samplePoint.y));
        float rootFalloff = smoothstep(0.22, 0.68, samplePoint.y);
        float softWave = sin((samplePoint.y - 0.20) * 15.0) * 0.0015;
        samplePoint.x -= breezeAmount * strandMask * rootFalloff * (0.006 + softWave);

        gl_FragColor = texture2D(portrait, clamp(samplePoint, 0.0, 1.0));
      }
    `;

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
      }
      return shader;
    };

    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }

    gl.useProgram(program);
    const vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      blink: gl.getUniformLocation(program, 'blinkAmount'),
      expression: gl.getUniformLocation(program, 'expressionAmount'),
      breeze: gl.getUniformLocation(program, 'breezeAmount'),
    };
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const ease = (value) => value * value * (3 - 2 * value);
    const pulse = (time, start, peak, end) => {
      if (time <= start || time >= end) return 0;
      if (time < peak) return ease((time - start) / (peak - start));
      return ease((end - time) / (end - peak));
    };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const image = new Image();

    image.addEventListener('load', () => {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.viewport(0, 0, canvas.width, canvas.height);
      const startedAt = performance.now();

      const draw = (now) => {
        const seconds = reducedMotion ? 0 : ((now - startedAt) / 1000) % 9;
        gl.uniform1f(uniforms.blink, pulse(seconds, 2.0, 2.11, 2.24));
        gl.uniform1f(uniforms.expression, pulse(seconds, 3.24, 3.48, 3.76));
        gl.uniform1f(uniforms.breeze, pulse(seconds, 6.76, 7.18, 7.72));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (!reducedMotion) requestAnimationFrame(draw);
      };

      requestAnimationFrame(draw);
    });
    image.src = 'assets/marina-portrait.svg';
  }
}
