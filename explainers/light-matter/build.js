#!/usr/bin/env node
/*
 * Builds a single self-contained HTML file from index.html + js/*.js.
 *
 * index.html is written as an artifact page body (no <!doctype>/<head>/<body>),
 * so this wraps it in a proper document and inlines every local <script src>.
 *
 *   node explainers/light-matter/build.js
 *   -> explainers/light-matter/light-matter-standalone.html
 */
'use strict';
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const src = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

const split = src.indexOf('<div class="progress"');
if (split < 0) throw new Error('index.html: cannot find the start of the page body');
const headPart = src.slice(0, split).trim();
let bodyPart = src.slice(split).trim();

bodyPart = bodyPart.replace(/<script src="(js\/[\w.-]+\.js)"><\/script>/g, (m, rel) => {
  const code = fs.readFileSync(path.join(dir, rel), 'utf8');
  if (code.includes('</script')) throw new Error(rel + ' contains a closing script tag');
  return '<script>\n' + code + '\n</script>';
});

const out = [
  '<!doctype html>',
  '<html lang="zh-CN">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  headPart,
  '</head>',
  '<body>',
  bodyPart,
  '</body>',
  '</html>',
  '',
].join('\n');

const target = path.join(dir, 'light-matter-standalone.html');
fs.writeFileSync(target, out);
console.log('wrote ' + path.relative(process.cwd(), target) + ' (' + (out.length / 1024).toFixed(1) + ' KB)');
