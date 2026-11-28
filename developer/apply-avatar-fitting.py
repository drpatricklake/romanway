"""Repair footwear joins and the musician's oversized head in the shared renderer."""
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'index.html'
s=p.read_text()
# Both renderer copies must agree, including the later full-canvas implementation.
old='''        const { canvas, flip } = shoePiece(art, foot, item, side);
        proportional(context, canvas, (left + right) / 2, y, w, h, 0, flip);'''
new='''        const { canvas, flip } = shoePiece(art, foot, item, side);
        const piece = surface();
        proportional(piece.context, canvas, (left + right) / 2, y, w, h, 0, flip);
        // The art includes a donor ankle. Keep its upper section inside the
        // actual leg silhouette; retain the shoe's own outline below the strap.
        // Pose images are loaded before footwear is composed.
        const silhouette = poseSilhouettes.get(pose.id);
        if (silhouette) {
          const pixels = piece.context.getImageData(0, 0, ...dimensions);
          const native = silhouette.data;
          const tailored = /^(herder|stoneworker|textile|service)-male$/.test(pose.id);
          const fadeStart = tailored ? .58 : .36;
          const fadeEnd = tailored ? .80 : .62;
          for (let py = Math.max(0, Math.floor(y)); py < Math.min(dimensions[1], y + h * fadeEnd); py++) {
            const blend = clamp((py - y - h * fadeStart) / (h * (fadeEnd - fadeStart)), 0, 1);
            for (let px = Math.max(0, Math.floor(left - 3)); px < Math.min(dimensions[0], right + 4); px++) {
              const i = (py * dimensions[0] + px) * 4;
              const overlap = native[i + 3] / 255;
              // Reveal the strap over the native foot before revealing the sole outside it.
              const inside = tailored ? clamp((py - y - h * .31) / (h * .29), 0, 1) : 1;
              pixels.data[i + 3] *= blend + (1 - blend) * overlap * inside;
            }
          }
          piece.context.putImageData(pixels, 0, 0);
        }
        context.drawImage(piece.canvas, 0, 0);'''
assert s.count(old)==2
s=s.replace(old,new)
s=s.replace('    const footwearCache = new Map();','    const footwearCache = new Map();\n    const poseSilhouettes = new Map();')
needle='''      const base = await path(pose.image);
      const style = pose.phase_poses[phase];'''
s=s.replace(needle,'''      const base = await path(pose.image);
      if (!poseSilhouettes.has(pose.id)) {
        const native = surface(); native.context.drawImage(base, 0, 0);
        poseSilhouettes.set(pose.id, native.context.getImageData(0, 0, ...dimensions));
      }
      const style = pose.phase_poses[phase];''')
# Ensure the silhouette is also initialized when an equipped garment bypasses starter().
s=s.replace('''      const base = outfit.garment ? await path(pose.image) : await starter(pose, phase, false);''','''      await starter(pose, phase, false);
      const base = outfit.garment ? await path(pose.image) : await starter(pose, phase, false);''')
# Apply the same proportion correction to the complete figure, including hats,
# so selection, bust, wardrobe and scene cannot disagree. Blend into the neck.
needle='''      return canvas;
    }

    return { render, starter };'''
replacement='''      if (pose.id === 'musician-male') {
        const corrected = surface();
        corrected.context.drawImage(canvas, 0, 83, dimensions[0], dimensions[1] - 83, 0, 83, dimensions[0], dimensions[1] - 83);
        const cx = center(pose.anchors.head), scale = .88, top = 10;
        for (let row = 0; row < 83; row++) {
          const t = clamp((row - 64) / 19, 0, 1);
          const sx = scale + (1 - scale) * t;
          const destY = top + row * (83 - top) / 83;
          corrected.context.drawImage(canvas, 0, row, dimensions[0], 1,
            cx * (1 - sx), destY, dimensions[0] * sx, (83 - top) / 83 + .1);
        }
        return corrected.canvas;
      }
      return canvas;
    }

    return { render, starter };'''
assert s.count(needle)==2
s=s.replace(needle,replacement)
p.write_text(s)
print('Applied shared avatar fitting repairs')
