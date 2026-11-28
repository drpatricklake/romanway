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
        const source = context.getImageData(0, 0, ...dimensions);
        const target = corrected.context.getImageData(0, 0, ...dimensions);
        // Sample once per destination pixel. Fractional one-row drawImage calls
        // overlap and leave visible horizontal bands in the face and hair.
        for (let y = top; y < 83; y++) {
          const sourceY = (y + .5 - top) * 83 / (83 - top) - .5;
          const blend = clamp((sourceY - 64) / 19, 0, 1);
          const horizontalScale = scale + (1 - scale) * blend;
          const y0 = Math.floor(sourceY), fy = sourceY - y0;
          for (let x = 0; x < dimensions[0]; x++) {
            const sourceX = cx + (x + .5 - cx) / horizontalScale - .5;
            const x0 = Math.floor(sourceX), fx = sourceX - x0;
            const color = [0, 0, 0];
            let alpha = 0;
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                const px = x0 + dx, py = y0 + dy;
                if (px < 0 || px >= dimensions[0] || py < 0 || py >= dimensions[1]) continue;
                const index = (py * dimensions[0] + px) * 4;
                const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
                const coverage = source.data[index + 3] * weight;
                alpha += coverage;
                for (let channel = 0; channel < 3; channel++) color[channel] += source.data[index + channel] * coverage;
              }
            }
            const index = (y * dimensions[0] + x) * 4;
            target.data[index + 3] = alpha;
            if (alpha) for (let channel = 0; channel < 3; channel++) target.data[index + channel] = color[channel] / alpha;
          }
        }
        corrected.context.putImageData(target, 0, 0);
        return corrected.canvas;
      }
      return canvas;
    }

    return { render, starter };'''
assert s.count(needle)==2
s=s.replace(needle,replacement)
p.write_text(s)
print('Applied shared avatar fitting repairs')
