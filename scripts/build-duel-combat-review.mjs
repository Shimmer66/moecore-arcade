import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { format } from 'prettier';

const root = fileURLToPath(new URL('../packages/assets/duel/', import.meta.url));
const prompts = JSON.parse(readFileSync(join(root, 'combat-prompts.json'), 'utf8'));
const previous = existsSync(join(root, 'combat-manifest.json'))
  ? JSON.parse(readFileSync(join(root, 'combat-manifest.json'), 'utf8')).assets
  : [];
const assets = prompts.assets.map((s) => {
  const bytes = readFileSync(join(root, s.path));
  if (bytes.subarray(1, 4).toString() !== 'PNG') throw Error(`Invalid PNG: ${s.path}`);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const checked = previous.find((a) => a.id === s.id && a.sha256 === hash);
  return {
    id: s.id,
    character: s.character,
    pose: s.pose,
    action: s.action,
    label: s.label,
    path: s.path,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bytes: bytes.length,
    alphaChannel: [4, 6].includes(bytes[25]),
    sha256: hash,
    ...(checked
      ? {
          alphaRange: checked.alphaRange,
          opaqueBounds: checked.opaqueBounds,
          transparentPixelPercent: checked.transparentPixelPercent,
        }
      : {}),
    source: 'built-in-image-gen',
    status: 'key-pose-needs-animation-calibration',
  };
});
writeFileSync(
  join(root, 'combat-manifest.json'),
  JSON.stringify({ title: '推演对决 · 战斗素材包', assetCount: assets.length, assets }, null, 2) +
    '\n',
);
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>推演对决 · 战斗素材 ${assets.length}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0e1727;color:#e8f0ff;font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1400px;margin:auto;padding:32px 24px}h1{font-size:clamp(25px,4vw,44px);line-height:1.2;margin:12px 0}header p{color:#aabbd3;max-width:850px}.eyebrow{color:#ffd369;font-size:11px;letter-spacing:3px}.tools{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}button,a.download{font:inherit;padding:10px 14px;border:1px solid #54657d;border-radius:5px;color:#e8f0ff;background:#223149;cursor:pointer;min-height:44px;text-decoration:none}button[aria-pressed=true]{background:#ffd369;color:#252314;border-color:#ffd369}a{color:#91d4ff}button:focus-visible,a:focus-visible{outline:3px solid #8ddcfc;outline-offset:3px}.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.card{background:#1a273c;border:1px solid #3c4b64;border-radius:6px;overflow:hidden;min-width:0}.image{display:block;aspect-ratio:1;width:100%;padding:4px;border:0;border-radius:0;background:#122036}.image img{width:100%;height:100%;object-fit:contain;display:block}.info{padding:12px}.info h3{font-size:13px;margin:0 0 5px}.info small{display:block;color:#abc0d9;font-size:10px;overflow-wrap:anywhere}.info a{font-size:12px;display:inline-block;margin-top:8px}section{margin-top:28px}h2{font-size:21px}body[data-bg=light] .image,body[data-bg=light] .zoom-stage{background:#f4f1e9}body[data-bg=checker] .image,body[data-bg=checker] .zoom-stage{background-color:#fff;background-image:conic-gradient(#d9dce1 25%,transparent 0 50%,#d9dce1 0 75%,transparent 0);background-size:20px 20px}dialog{padding:0;border:1px solid #506684;border-radius:8px;background:#18273c;color:white;max-width:94vw;max-height:94vh}dialog::backdrop{background:#030913dc}.zoom-stage{width:min(78vw,760px);height:min(70vh,760px);background:#122036;display:flex;align-items:center;justify-content:center}.zoom-stage img{width:100%;height:100%;object-fit:contain}.zoom-tools{padding:12px;display:flex;align-items:center;flex-wrap:wrap;gap:8px}.zoom-tools strong{flex:1}.note{padding:14px;border-left:3px solid #ffd369;color:#bfcee3;background:#1b293e}footer{margin-top:30px;padding-top:20px;border-top:1px solid #3a4c66;color:#a6b8cf;font-size:12px}@media(max-width:1100px){.grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:650px){main{padding:24px 12px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.zoom-stage{width:90vw}.tools button{padding:8px 10px}.zoom-tools strong{flex-basis:100%}}
</style></head><body data-bg="dark"><main>
<header><span class="eyebrow">AI FIGHT CLUB / COMBAT ART PACK</span><h1>让拳头有动作，<br>让挨打有表情。</h1><p>DeepSeek × 豆包：24 张战斗关键姿态 + 6 张独立特效。原始透明 PNG，可逐张放大、下载，并查阅完整提示词。</p><p class="note">关键姿态素材：用于出招与受击设计，尚需统一锚点、补间和逐帧实机校准。下方每张图都是独立生成原图，不是完整动作图集。</p></header>
<div class="tools" aria-label="素材分组"><button data-group="all" aria-pressed="true">全部 · 30</button><button data-group="deepseek" aria-pressed="false">DeepSeek · 12</button><button data-group="doubao" aria-pressed="false">豆包 · 12</button><button data-group="effects" aria-pressed="false">独立特效 · 6</button></div>
<div class="tools" aria-label="预览背景"><button data-bg="dark" aria-pressed="true">深色底</button><button data-bg="light" aria-pressed="false">浅色底</button><button data-bg="checker" aria-pressed="false">透明检查</button><a class="download" href="combat-prompts.json" download>下载完整提示词</a></div>
<div id="gallery"></div>
<footer><a href="combat-prompts.md">逐图提示词文档</a> · <a href="combat/README.md">制作与接入说明</a> · <a href="combat-manifest.json">尺寸与哈希</a> · <a href="preview.html">之前的 18 张角色与梗图</a><p>生成方式：内置 image_gen。豆包形象沿用用户头像；素材保留真实透明通道。技能特效与人物分层保存。</p></footer>
</main><dialog id="viewer"><div class="zoom-stage"><img id="zoom-image" alt=""></div><div class="zoom-tools"><strong id="zoom-title"></strong><button id="previous" aria-label="上一张">←</button><button id="next" aria-label="下一张">→</button><button id="close">关闭</button></div></dialog>
<script>
const assets=${JSON.stringify(assets)};
const gallery=document.querySelector('#gallery'),viewer=document.querySelector('#viewer');
let active=0,filter='all';
const visible=()=>assets.filter(a=>filter==='all'||(filter==='effects'?a.action==='effect':a.character===filter&&a.action!=='effect'));
function show(index){const list=visible();active=(index+list.length)%list.length;const a=list[active];document.querySelector('#zoom-image').src=a.path;document.querySelector('#zoom-image').alt=a.label;document.querySelector('#zoom-title').textContent=a.label+' · '+(active+1)+' / '+list.length;if(!viewer.open)viewer.showModal();}
for(const [id,name] of [['deepseek','DeepSeek / 鲸娘出拳'],['doubao','豆包 / 直白出手'],['effects','独立特效 / 命中才出场']]){const section=document.createElement('section');section.dataset.group=id;const heading=document.createElement('h2');heading.textContent=name;const grid=document.createElement('div');grid.className='grid';for(const a of assets.filter(a=>id==='effects'?a.action==='effect':a.character===id&&a.action!=='effect')){const card=document.createElement('article');card.className='card';const btn=document.createElement('button');btn.className='image';btn.setAttribute('aria-label','放大：'+a.label);const img=document.createElement('img');img.src=a.path;img.alt=a.label;img.loading='lazy';btn.append(img);btn.onclick=()=>show(visible().findIndex(x=>x.id===a.id));const info=document.createElement('div');info.className='info';const title=document.createElement('h3');title.textContent=a.label;const meta=document.createElement('small');meta.textContent=a.width+' × '+a.height+' · '+(a.bytes/1048576).toFixed(2)+' MB';const file=document.createElement('small');file.textContent=a.path.split('/').pop();const link=document.createElement('a');link.href=a.path;link.download=a.id+'.png';link.textContent='下载原图 ↓';info.append(title,meta,file,link);card.append(btn,info);grid.append(card);}section.append(heading,grid);gallery.append(section);}
document.querySelectorAll('button[data-group]').forEach(b=>b.onclick=()=>{filter=b.dataset.group;document.querySelectorAll('button[data-group]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('section[data-group]').forEach(s=>s.hidden=filter!=='all'&&s.dataset.group!==filter);});
document.querySelectorAll('button[data-bg]').forEach(b=>b.onclick=()=>{document.body.dataset.bg=b.dataset.bg;document.querySelectorAll('button[data-bg]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
document.querySelector('#previous').onclick=()=>show(active-1);document.querySelector('#next').onclick=()=>show(active+1);document.querySelector('#close').onclick=()=>viewer.close();viewer.onkeydown=e=>{if(e.key==='ArrowLeft')show(active-1);if(e.key==='ArrowRight')show(active+1);};
</script></body></html>`;
writeFileSync(join(root, 'combat-preview.html'), await format(html, { parser: 'html' }));
console.log(`Combat review: ${assets.length} assets`);
