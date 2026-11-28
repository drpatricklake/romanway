const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createCanvas } = require(process.env.ROMANWAY_CANVAS_MODULE || '@napi-rs/canvas');
const html = fs.readFileSync('index.html', 'utf8');
const marker = "if (pose.id === 'musician-male') {";
let offset = 0, checked = 0;
while ((offset = html.indexOf(marker, offset)) >= 0) {
  const end = html.indexOf('return corrected.canvas;', offset);
  const code = html.slice(offset + marker.length, end) + 'return corrected.canvas;';
  const dimensions = [352, 432];
  const makeSurface = () => {
    const canvas = createCanvas(...dimensions);
    return { canvas, context: canvas.getContext('2d') };
  };
  const { canvas, context } = makeSurface();
  context.fillStyle = '#73543b';
  context.fillRect(0, 0, ...dimensions);
  const result = vm.runInNewContext('(function(){' + code + '})()', {
    dimensions, canvas, context, surface: makeSurface,
    center: () => 176, pose: { anchors: { head: [] } },
    clamp: (value, min, max) => Math.max(min, Math.min(max, value))
  });
  const pixels = result.getContext('2d').getImageData(175, 10, 1, 100).data;
  for (let row = 0; row < 100; row++) {
    assert.deepEqual([...pixels.slice(row * 4, row * 4 + 4)], [115, 84, 59, 255],
      'Solid head texture must remain opaque and constant at row ' + (row + 10));
  }
  checked++;
  offset = end;
}
assert.equal(checked, 2, 'Both renderer copies must use smooth head sampling');
console.log('PASS both head transforms preserve constant color and opacity without horizontal seams');
