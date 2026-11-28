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
  for (let row=0; row<dimensions[1]; row++) {
    context.fillStyle = 'rgb('+Math.min(255,row*2)+',84,59)';
    context.fillRect(0,row,dimensions[0],1);
  }
  const result = vm.runInNewContext('(function(){' + code + '})()', {
    dimensions, canvas, context, surface: makeSurface,
    center: () => 176, pose: { anchors: { head: [] } },
    clamp: (value, min, max) => Math.max(min, Math.min(max, value))
  });
  const pixels = result.getContext('2d').getImageData(175, 10, 1, 100).data;
  for (let row = 0; row < 100; row++) {
    const y=row+10;
    const sourceY=y<83?(y+.5-10)*83/73-.5:y;
    assert.ok(Math.abs(pixels[row*4]-Math.round(sourceY*2))<=1,
      'Head must sample the continuous vertical gradient at row '+y);
    assert.deepEqual([...pixels.slice(row*4+1,row*4+4)],[84,59,255],
      'Head must preserve color and opacity at row '+y);
  }
  checked++;
  offset = end;
}
assert.equal(checked, 2, 'Both renderer copies must use smooth head sampling');
console.log('PASS both head transforms preserve constant color and opacity without horizontal seams');
