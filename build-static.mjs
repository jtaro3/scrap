import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });
const script = readFileSync(join(root, 'game.js'));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const sourceTag = '<script src="game.js"></script>';
if (!html.includes(sourceTag)) throw new Error('index.html のゲーム用 script タグが見つかりません');

const hash = createHash('sha256').update(script).digest('hex').slice(0, 12);
const assetName = `game.${hash}.js`;
for (const name of readdirSync(dist)) {
  if (/^game\.[a-f0-9]{12}\.js$/.test(name) || name === 'game-ui-2.js' || name === 'game.js') {
    unlinkSync(join(dist, name));
  }
}
copyFileSync(join(root, 'game.js'), join(dist, assetName));
const publishedHtml = html.replace(sourceTag, `<script src="${assetName}"></script>`);
writeFileSync(join(dist, 'index.html'), publishedHtml);
writeFileSync(join(dist, 'play.html'), publishedHtml);
writeFileSync(join(dist, 'play-2.html'), publishedHtml);
console.log(`公開用JavaScript: ${assetName}`);
