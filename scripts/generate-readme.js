#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const savouryDir = path.join(repoRoot, 'savoury');
const sweetDir = path.join(repoRoot, 'sweet');
const readmePath = path.join(repoRoot, 'README.md');

function readFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md'));
}

function parseFrontmatter(content) {
  const fm = {};
  const m = content.match(/^---\s*([\s\S]*?)\s*---/);
  if (m) {
    const body = m[1];
    const titleMatch = body.match(/^\s*title:\s*(?:"([^"]+)"|'([^']+)'|(.+))\s*$/m);
    if (titleMatch) fm.title = (titleMatch[1]||titleMatch[2]||titleMatch[3]).trim().replace(/^"|"$/g,'');
    const categoryMatch = body.match(/^\s*category:\s*["']?(.+?)["']?\s*$/m);
    if (categoryMatch) fm.category = categoryMatch[1].trim();
    const tagsMatch = body.match(/^\s*tags:\s*\[([^\]]*)\]/m);
    if (tagsMatch) {
       fm.tags = tagsMatch[1].split(',').map(s => s.replace(/['"]/g,'').trim()).filter(Boolean);
    }
    const servesMatch = body.match(/^\s*serves:\s*["']?(.+?)["']?\s*$/m);
    if (servesMatch) fm.serves = servesMatch[1].trim();
    const timeMatch = body.match(/^\s*time:\s*["']?(.+?)["']?\s*$/m);
    if (timeMatch) fm.time = timeMatch[1].trim();
  }
  return fm;
}

function extractTitle(content) {
  const fm = parseFrontmatter(content);
  if (fm.title) return fm.title;
  const h1 = content.match(/^#\s+(.+)/m);
  return h1 ? h1[1].trim() : null;
}

function firstParagraph(content) {
  const withoutFm = content.replace(/^---[\s\S]*?---\s*/,'');
  const lines = withoutFm.split(/\r?\n/);
  let i = 0;
  if (lines[i] && lines[i].startsWith('#')) i++;
  for (; i<lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('##')) return null;
    return line;
  }
  return null;
}

const readme = fs.readFileSync(readmePath,'utf8');

// build description map from existing README
const descMap = {};
const linkRegex = /- \[([^\]]+)\]\((savoury|sweet)\/([^)]+)\)\s*(?:-\s*(.*))?/g;
let lm;
while ((lm = linkRegex.exec(readme)) !== null) {
  const title = lm[1];
  const dir = lm[2];
  const file = lm[3];
  const desc = lm[4] ? lm[4].trim() : null;
  descMap[`${dir}/${file}`] = desc;
}

const savouryFiles = readFiles(savouryDir);
const sweetFiles = readFiles(sweetDir);

function buildItem(dir, file, title, desc) {
  return `- [${title}](${dir}/${file})${desc ? ' - ' + desc : ''}`;
}

function chooseDesc(dir, file, content) {
  const key = `${dir}/${file}`;
  if (descMap[key]) return descMap[key];
  const p = firstParagraph(content);
  return p || null;
}

function parseFiles(dir, files) {
  return files.map(file => {
    const full = fs.readFileSync(path.join(repoRoot, dir, file),'utf8');
    const fm = parseFrontmatter(full);
    const title = fm.title || extractTitle(full) || file.replace(/\.md$/,'');
    const tags = fm.tags || [];
    const category = fm.category || (dir === 'savoury' ? 'savoury' : 'sweet');
    const desc = chooseDesc(dir, file, full);
    return { dir, file, title, tags, category, desc };
  });
}

const savouryData = parseFiles('savoury', savouryFiles);
const sweetData = parseFiles('sweet', sweetFiles);

function sectionIcon(name) {
  const icons = {
    'Fajitas': './icons/osrs-cooked-meat.png',
    'Pasta': './icons/pasta.png',
    'Meat': './icons/osrs-cooked-meat.png',
    'Veg': './icons/osrs-cabbage.png',
    'Pizza': './icons/osrs-pizza.png',
    'Cookies & Bakes': './icons/cookie.png',
    'Pancakes': './icons/pancakes.svg',
    'Treats': './icons/candy.png'
  };
  const src = icons[name] || './icons/osrs-cooking.png';
  return `<img src="${src}" width="20" height="20" style="vertical-align: middle;" alt="${name} icon" />`;
}

function genSavSection() {
  const order = [
    {name:'Fajitas', matcher: d => d.tags.includes('fajitas') || /fajitas/i.test(d.title) },
    {name:'Pasta', matcher: d => d.tags.includes('pasta') || /pasta/i.test(d.title) },
    {name:'Meat', matcher: d => d.tags.includes('meat') || ['pork','chicken','beef','sausage'].some(t=>d.tags.includes(t) || /pork|chicken|beef|sausage/i.test(d.title)) },
    {name:'Veg', matcher: d => d.tags.includes('veg') || d.tags.includes('vegetable') || /pepper|pepper|veg/i.test(d.title) },
    {name:'Pizza', matcher: d => d.tags.includes('pizza') || /pizza/i.test(d.title) }
  ];
  let out = "### Savoury\n\n";
  for (const cat of order) {
    const items = savouryData.filter(cat.matcher).sort((a,b)=>a.title.localeCompare(b.title));
    out += `#### ${sectionIcon(cat.name)} ${cat.name}\n`;
    if (items.length === 0) {
      out += "- _No recipes yet_\n\n";
      continue;
    }
    for (const it of items) {
      out += buildItem(it.dir, it.file, it.title, it.desc) + '\n';
    }
    out += '\n';
  }
  return out;
}

function genSweetSection() {
  let out = "### Sweet\n\n";
  const cookies = sweetData.filter(d => /cookie|cookies|bake|bakes/i.test(d.title));
  out += `#### ${sectionIcon('Cookies & Bakes')} Cookies & Bakes\n`;
  if (cookies.length) cookies.sort((a,b)=>a.title.localeCompare(b.title)).forEach(it=>out+=buildItem(it.dir,it.file,it.title,it.desc)+'\n');
  out += '\n';
  const pancakes = sweetData.filter(d => /pancake/i.test(d.title));
  out += `#### ${sectionIcon('Pancakes')} Pancakes\n`;
  if (pancakes.length) pancakes.sort((a,b)=>a.title.localeCompare(b.title)).forEach(it=>out+=buildItem(it.dir,it.file,it.title,it.desc)+'\n');
  out += '\n';
  const treats = sweetData.filter(d => /fudge|treat|candy|nutella/i.test(d.title));
  out += `#### ${sectionIcon('Treats')} Treats\n`;
  if (treats.length) treats.sort((a,b)=>a.title.localeCompare(b.title)).forEach(it=>out+=buildItem(it.dir,it.file,it.title,it.desc)+'\n');
  out += '\n';
  return out;
}

const newIndex = `## Index\n\n${genSavSection()}${genSweetSection()}---`;

const newReadme = readme.replace(/## Index[\s\S]*?---\n\n## Recipe Template/, `${newIndex}\n\n## Recipe Template`);
fs.writeFileSync(readmePath, newReadme, 'utf8');
console.log('README.md regenerated — index updated.');
