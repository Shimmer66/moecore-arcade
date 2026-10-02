import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { format } from 'prettier';

const root = fileURLToPath(new URL('../packages/assets/duel/', import.meta.url));
const previousAssets = existsSync(join(root, 'manifest.json'))
  ? JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')).assets
  : [];
const definitions = [
  ['duel_ds_base', 'deepseek', '全身基准', '困得睁不开眼，但坚信自己很懂。'],
  ['duel_ds_thinking', 'deepseek', '正在用力思考', '思维线先打结，脑袋后冒烟。'],
  ['duel_ds_busted', 'deepseek', '思考了个寂寞', '脸已经慌了，加载圈还在坚持。'],
  ['duel_ds_ultimate_key', 'deepseek', '专家会诊', '专家很多，上班俩。'],
  ['duel_gpt_base', 'gpt', '全身基准', '稿子已经滑走，笑容依然专业。'],
  ['duel_gpt_confident', 'gpt', '我讲两句', '纸张失控，主讲人非常自信。'],
  ['duel_gpt_revision', 'gpt', '上一版比较好', '一边擦汗，一边销毁刚才的答案。'],
  ['duel_gpt_ultimate_key', 'gpt', '综上所述 · 已发送', '章比人重，人随章走。'],
  ['duel_doubao_base_v3', 'doubao', '全身基准 · 用户头像版', '侧分露额、红围巾、深色上衣。'],
  ['duel_doubao_guarantee', 'doubao', '包的', '胸口拍响了，气泡快撑爆了。'],
  ['duel_doubao_oops', 'doubao', '没包住', '气泡漏气，解释还没停止。'],
  ['duel_doubao_ultimate_key', 'doubao', '省字不省拳', '话越挤越短，拳头越来越大。'],
  ['duel_ds_cache_hit', 'deepseek', '缓存命中', '抱着录像机接招：这题做过。', 'memes'],
  ['duel_gpt_muffled', 'gpt', '已读已堵', '嘴被气泡堵住，耳朵还在输出。', 'memes'],
  ['duel_gpt_rollback', 'gpt', '版本回滚', '把打空的拳头拽回去，假装没发生。', 'memes'],
  [
    'duel_ds_sore_loser',
    'deepseek',
    '战略性休息 · DeepSeek',
    '拿鲸尾当枕头，还要偷偷翻牌。',
    'memes',
  ],
  ['duel_gpt_sore_loser', 'gpt', '战略性休息 · GPT', '躺在废稿上，也要保持营业笑容。', 'memes'],
  [
    'duel_doubao_sore_loser',
    'doubao',
    '战略性休息 · 豆包',
    '围巾一垫，宣布进入休息模式。',
    'memes',
  ],
];
const assets = definitions.map(([id, character, label, description, folder = 'first-batch']) => {
  const path = `${folder}/${id}.png`;
  if (!existsSync(join(root, path))) throw new Error(`Missing requested asset: ${path}`);
  const bytes = readFileSync(join(root, path));
  if (bytes.subarray(1, 4).toString() !== 'PNG') throw new Error(`Not a PNG: ${path}`);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const previous = previousAssets.find((asset) => asset.id === id && asset.sha256 === hash);
  return {
    id,
    character,
    label,
    description,
    path,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bytes: bytes.length,
    alphaChannel: [4, 6].includes(bytes[25]),
    sha256: hash,
    ...(previous
      ? {
          alphaRange: previous.alphaRange,
          opaqueBounds: previous.opaqueBounds,
          transparentPixelPercent: previous.transparentPixelPercent,
        }
      : {}),
    source: 'built-in-image-gen',
    reviewStatus: 'generated-pending-review',
    kind:
      folder === 'memes'
        ? 'meme-cutout'
        : id.includes('ultimate')
          ? 'static-ultimate-concept'
          : id.includes('base')
            ? 'character-reference'
            : 'reaction-cutout',
  };
});
writeFileSync(
  join(root, 'manifest.json'),
  `${JSON.stringify({ title: '推演对决 · 角色与原创互动素材', assetCount: assets.length, notes: ['豆包以用户提供的头像为身份参考，v1/v2 不在当前清单。', '完整母版未重采样，静态大招样稿不是动画图集。', '新增六张原创互动图，提示词见 meme-prompts.json。'], assets }, null, 2)}\n`,
);

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>推演对决 · ${assets.length} 张角色与梗图</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f1eb;color:#202938;font-family:system-ui,"Microsoft YaHei",sans-serif}main{max-width:1440px;margin:auto;padding:40px 28px 70px}.eyebrow{font-size:12px;letter-spacing:3px;color:#637589;font-weight:700}h1{font-size:clamp(28px,4vw,46px);letter-spacing:-1px;margin:12px 0}header p{color:#657181;line-height:1.8;margin:0 0 20px}.tools{display:flex;gap:9px;flex-wrap:wrap;margin:24px 0 30px}button{font:inherit;cursor:pointer;border:1px solid #c8d0d8;background:white;color:#263548;border-radius:8px;padding:10px 16px;min-height:44px}button[aria-pressed=true]{background:#20374f;color:white;border-color:#20374f}button:focus-visible,a:focus-visible{outline:3px solid #479fde;outline-offset:3px}section{margin-top:35px}h2{font-size:25px;margin:0 0 7px}.intro{color:#677387;margin:0 0 17px;font-size:14px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.card{background:#fff;border:1px solid #dedfdc;border-radius:14px;overflow:hidden}.preview{display:block;padding:10px;width:100%;border:0;border-radius:0;aspect-ratio:1;background:#e9edf3}.preview img{display:block;width:100%;height:100%;object-fit:contain}.info{padding:15px 17px 18px}.info h3{font-size:16px;margin:0 0 9px}.info p{font-size:13px;line-height:1.6;color:#647386;min-height:42px;margin:0 0 10px}.info small{font-size:11px;color:#7f8b9a}.info a{display:block;font-size:12px;color:#236a9d;margin-top:10px}body[data-bg=dark] .preview,body[data-bg=dark] .zoom-stage{background:#152336}body[data-bg=checker] .preview,body[data-bg=checker] .zoom-stage{background-color:#fff;background-image:linear-gradient(45deg,#e1e5e9 25%,transparent 25%),linear-gradient(-45deg,#e1e5e9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e1e5e9 75%),linear-gradient(-45deg,transparent 75%,#e1e5e9 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0}footer{margin-top:32px;padding-top:20px;border-top:1px solid #d9dcde;color:#697788;font-size:13px;line-height:1.8}footer a{color:#236a9d}dialog{padding:0;border:0;border-radius:14px;background:white;max-width:min(94vw,1200px);max-height:94vh}dialog::backdrop{background:#081526bf}.zoom-stage{height:min(75vh,920px);min-width:min(85vw,950px);padding:20px;display:flex;align-items:center;justify-content:center;background:#e9edf3}.zoom-stage img{max-width:100%;max-height:100%;object-fit:contain}.zoom-toolbar{display:flex;align-items:center;gap:8px;padding:12px 16px}.zoom-toolbar strong{flex:1}@media(max-width:1000px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){main{padding:24px 14px 40px}.grid{gap:10px}.info{padding:12px}.info h3{font-size:14px}.info p{font-size:12px;min-height:58px}.info small{font-size:10px}.tools button{padding:9px 12px}.zoom-toolbar{flex-wrap:wrap}.zoom-toolbar strong{width:100%;flex:auto}}
</style><style>body[data-collection=memes] .card:not([data-kind=meme-cutout]){display:none}</style></head><body data-bg="dark" data-collection="memes"><main>
<header><span class="eyebrow">MOECORE · DUEL ART STUDY 01</span><h1>先看认不认得出，<br>再看会不会笑。</h1><p>12 张角色样张 + 6 张新梗图片：让对局自己产出笑点。<br>豆包以用户头像为准：侧分露额、红围巾、深色上衣。</p></header>
<div class="tools" role="group" aria-label="素材预览背景"><button data-background="dark" aria-pressed="true">深色底</button><button data-background="light" aria-pressed="false">浅色底</button><button data-background="checker" aria-pressed="false">透明检查</button></div>
<p><a href="combat-preview.html">新增：30 张战斗动作与独立特效 →</a></p><div class="tools" role="group" aria-label="素材批次"><button data-collection="memes" aria-pressed="true">新梗图片 · 6</button><button data-collection="all" aria-pressed="false">全部素材 · ${assets.length}</button></div>
<div id="gallery"></div><footer>这是静态视觉样张，完整战斗动作和大招分层仍需后续制作。PNG 保留原始透明通道；点击卡片放大。<br><a href="manifest.json">素材清单与哈希</a> · <a href="prompts.json">首批提示词</a> · <a href="meme-prompts.json">新梗提示词</a> · <a href="doubao-reference.md">豆包参考与纠正记录</a></footer>
</main><dialog id="viewer"><div class="zoom-stage"><img id="zoom-image" alt=""></div><div class="zoom-toolbar"><strong id="zoom-title"></strong><button id="previous" aria-label="上一张">←</button><button id="next" aria-label="下一张">→</button><button id="close">关闭</button></div></dialog>
<script>
const assets=${JSON.stringify(assets)};
const groups=[['deepseek','DeepSeek 娘','思考很认真，翻车也很认真。'],['gpt','GPT 娘','永远还有下一版，永远保持营业笑容。'],['doubao','豆包娘','形象来自用户参考，反差来自表情和动作。']];
const gallery=document.querySelector('#gallery');
for(const [id,name,caption] of groups){const section=document.createElement('section');const title=document.createElement('h2');title.textContent=name;const intro=document.createElement('p');intro.className='intro';intro.textContent=caption;const grid=document.createElement('div');grid.className='grid';for(const asset of assets.filter(a=>a.character===id)){const card=document.createElement('article');card.className='card';card.dataset.kind=asset.kind;const button=document.createElement('button');button.className='preview';button.setAttribute('aria-label','放大：'+name+' · '+asset.label);const img=document.createElement('img');img.src=asset.path;img.alt=name+' · '+asset.label;img.loading='lazy';button.append(img);button.addEventListener('click',()=>show(assets.indexOf(asset)));const info=document.createElement('div');info.className='info';const h3=document.createElement('h3');h3.textContent=asset.label;const p=document.createElement('p');p.textContent=asset.description;const small=document.createElement('small');small.textContent=asset.width+' × '+asset.height+' · PNG · '+(asset.bytes/1048576).toFixed(2)+' MB';const link=document.createElement('a');link.href=asset.path;link.download=asset.id+'.png';link.textContent='下载原图';info.append(h3,p,small,link);card.append(button,info);grid.append(card);}section.append(title,intro,grid);gallery.append(section);}
document.querySelectorAll('[data-background]').forEach(button=>button.addEventListener('click',()=>{document.body.dataset.bg=button.dataset.background;document.querySelectorAll('[data-background]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
const viewer=document.querySelector('#viewer');let active=0;function show(index){active=(index+assets.length)%assets.length;const a=assets[active];document.querySelector('#zoom-image').src=a.path;document.querySelector('#zoom-image').alt=a.label;document.querySelector('#zoom-title').textContent=a.label;if(!viewer.open)viewer.showModal();}document.querySelector('#close').onclick=()=>viewer.close();document.querySelector('#previous').onclick=()=>show(active-1);document.querySelector('#next').onclick=()=>show(active+1);viewer.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')show(active-1);if(e.key==='ArrowRight')show(active+1);});
document.querySelectorAll('[data-collection]').forEach(button=>{if(button.tagName!=='BUTTON')return;button.addEventListener('click',()=>{document.body.dataset.collection=button.dataset.collection;document.querySelectorAll('button[data-collection]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});});
</script></body></html>`;
writeFileSync(join(root, 'preview.html'), await format(html, { parser: 'html' }));
console.log(`Saved ${assets.length} asset records and preview.html.`);
