/**
 * Rounded glass displacement for an SVG feImage (preserveAspectRatio="none").
 * Use R/G channels with a positive feDisplacementMap scale: the rim samples
 * inward, while the center stays neutral (128). Scale 28 gives at most 14px
 * displacement; a negative scale reverses the bend into a concave lens.
 */
export function createRefractionMap(
  width: number,
  height: number,
  radius: number,
  bevel: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Glass refraction map requires a 2D canvas');

  const halfWidth = canvas.width / 2;
  const halfHeight = canvas.height / 2;
  const corner = Math.max(0, Math.min(radius, halfWidth, halfHeight));
  const shoulder = Math.max(1, Math.min(bevel, halfWidth, halfHeight));
  const pixels = context.createImageData(canvas.width, canvas.height);
  const maxTilt = Math.PI / 3;
  const refract = (tilt: number) => Math.tan(tilt - Math.asin(Math.sin(tilt) / 1.46));
  const maxBend = refract(maxTilt);

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const px = x + 0.5 - halfWidth;
      const py = y + 0.5 - halfHeight;
      const qx = Math.abs(px) - halfWidth + corner;
      const qy = Math.abs(py) - halfHeight + corner;
      const cx = Math.max(qx, 0);
      const cy = Math.max(qy, 0);
      const arc = Math.hypot(cx, cy);
      const inward = corner - arc - Math.min(Math.max(qx, qy), 0);
      const index = (y * canvas.width + x) * 4;
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = 128;
      pixels.data[index + 3] = 255;
      if (inward < 0 || inward >= shoulder) continue;

      // Signed-distance normals smoothly join straight sides and rounded corners.
      const nx = Math.sign(px) * (arc > 0 ? cx / arc : qx > qy ? 1 : 0);
      const ny = Math.sign(py) * (arc > 0 ? cy / arc : qy >= qx ? 1 : 0);
      const t = inward / shoulder;
      const tilt = maxTilt * (1 - t * t * (3 - 2 * t));
      const bend = refract(tilt) / maxBend;
      pixels.data[index] = Math.round(128 - nx * bend * 127);
      pixels.data[index + 1] = Math.round(128 - ny * bend * 127);
    }
  }

  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}
