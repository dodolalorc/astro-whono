import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = 'D:/Flora/Documents/dodola';
const sourceRoot = path.join(workspaceRoot, 'Blogs/content');
const targetRoot = path.join(workspaceRoot, 'astro-whono/src/content/essay');

const categoryMap = new Map([
  ['01-developer', ['developer']],
  ['01-developer/electronjs', ['developer', 'electron']],
  ['01-developer/frontend', ['developer', 'frontend']],
  ['02-experience', ['experience']],
  ['03-algorithm', ['algorithm']],
  ['04-tools', ['tools']],
  ['05-projects', ['projects']],
  ['05-projects/quartz', ['projects', 'quartz']]
]);

const badgeMap = new Map([
  ['01-developer', '开发'],
  ['01-developer/electronjs', 'Electron'],
  ['01-developer/frontend', '前端'],
  ['02-experience', '实验'],
  ['03-algorithm', '算法'],
  ['04-tools', '工具'],
  ['05-projects', '项目'],
  ['05-projects/quartz', 'Quartz']
]);

const specialTargets = new Map([
  ['links.md', ['pages', 'friend-links.md']],
  ['05-projects/friendlink.mdx', ['projects', 'friend-link-component.md']]
]);

function walk(dir) {
  const items = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      items.push(...walk(fullPath));
      continue;
    }

    if (!/\.(md|mdx)$/i.test(entry.name)) continue;
    items.push(fullPath);
  }
  return items;
}

function extractFrontmatter(raw) {
  if (!raw.startsWith('---')) {
    return { frontmatter: '', body: raw };
  }

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: '', body: raw };
  }

  return {
    frontmatter: match[1],
    body: raw.slice(match[0].length)
  };
}

function extractField(frontmatter, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = frontmatter.match(new RegExp(`^${escaped}\\s*:\\s*(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, '').trim();
}

function parseBoolean(value, fallback = false) {
  if (!value) return fallback;
  return value.trim().toLowerCase() === 'true';
}

function parseTags(frontmatter) {
  const inline = frontmatter.match(/^tags\s*:\s*\[(.*?)\]\s*$/ms);
  if (inline) {
    return inline[1]
      .split(',')
      .map((item) => stripQuotes(item))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const lines = frontmatter.split(/\r?\n/);
  const tags = [];
  let collecting = false;

  for (const line of lines) {
    if (!collecting && /^tags\s*:\s*$/.test(line)) {
      collecting = true;
      continue;
    }

    if (!collecting) continue;

    if (/^\s*-\s+/.test(line)) {
      tags.push(stripQuotes(line.replace(/^\s*-\s+/, '').trim()));
      continue;
    }

    if (/^\s*$/.test(line)) continue;
    break;
  }

  return tags.filter(Boolean);
}

function kebabCase(value) {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function escapeYamlString(value) {
  return JSON.stringify(value);
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDescription(frontmatterDescription, body) {
  const existing = stripQuotes(frontmatterDescription);
  if (existing) return existing;

  const paragraphs = body
    .split(/\r?\n\r?\n/)
    .map((chunk) => stripMarkdown(chunk))
    .filter(Boolean);

  const first = paragraphs[0] ?? '迁移自旧博客的文章。';
  return first.length > 120 ? `${first.slice(0, 117)}...` : first;
}

function normalizeWhitespace(body) {
  return body
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function replaceMermaidBlock(content, diagramSource) {
  const trimmed = diagramSource.trim();
  return [
    ':::info[Mermaid 图表已转为源码展示]',
    '当前主题默认未启用 Mermaid 渲染。为了保证文章能正常构建，这里先保留图表源码；后续接入 Mermaid 插件后可再恢复为图形展示。',
    ':::',
    '',
    '```text',
    trimmed,
    '```'
  ].join('\n');
}

function normalizeCalloutType(type) {
  const normalized = type.toLowerCase();
  if (normalized === 'tip') return 'tip';
  if (normalized === 'warning' || normalized === 'attention' || normalized === 'bug' || normalized === 'danger') {
    return 'warning';
  }
  if (normalized === 'abstract' || normalized === 'summary' || normalized === 'info') {
    return 'info';
  }
  return 'note';
}

function convertObsidianCallouts(content) {
  const lines = content.split('\n');
  const output = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^>\s*\[!([A-Za-z]+)\][+-]?\s*(.*)$/);
    if (!match) {
      output.push(line);
      continue;
    }

    const type = normalizeCalloutType(match[1]);
    const title = match[2].trim();
    const bodyLines = [];
    i += 1;

    while (i < lines.length) {
      const current = lines[i];
      if (!current.startsWith('>')) {
        i -= 1;
        break;
      }

      bodyLines.push(current.replace(/^>\s?/, ''));
      i += 1;
    }

    while (bodyLines.length > 0 && bodyLines[0] === '') bodyLines.shift();
    while (bodyLines.length > 0 && bodyLines.at(-1) === '') bodyLines.pop();

    output.push(title ? `:::${type}[${title}]` : `:::${type}`);
    if (bodyLines.length > 0) {
      output.push(...bodyLines);
    }
    output.push(':::');
  }

  return output.join('\n');
}

function sanitizeBody(body, relativePath) {
  let result = body;

  result = result.replace(/<!--\s*more\s*-->/gi, '');
  result = result.replace(/{{<\s*link\s+"([^"]+)"\s*>}}/g, '[$1]($1)');

  result = result.replace(/```mermaid\s*\n([\s\S]*?)```/g, (_, diagramSource) =>
    replaceMermaidBlock(_, diagramSource)
  );

  result = result.replace(/{{<\s*mermaid\s*>}}\s*\n([\s\S]*?)\n{{<\s*\/mermaid\s*>}}/g, (_, diagramSource) =>
    replaceMermaidBlock(_, diagramSource)
  );

  if (relativePath === '05-projects/friendlink.mdx') {
    result = [
      '这篇文章原本使用了 Rspress 的 `Tabs` 组件和自定义 `FriendLink` 组件。迁移到 Astro 主题后，这些 MDX 组件无法直接渲染，所以这里改成普通 Markdown，保留实现思路、示例结构和核心代码。',
      '',
      '## 使用场景',
      '',
      '适合在博客中展示友链卡片，信息项包括站点名称、链接、头像和一句简短介绍。',
      '',
      '示例数据：',
      '',
      '```tsx',
      '<div className="friend-link-shell">',
      '  <FriendLink',
      '    name="dodola"',
      '    url="https://dodolalorc.cn/"',
      '    avatar="https://dodolalorc.cn/img/dodola.png"',
      '    bio="要是人生能像星露谷就好了。"',
      '  />',
      '  <FriendLink',
      '    name="dodola"',
      '    url="https://dodolalorc.github.io/"',
      '    avatar="https://dodolalorc.cn/img/dodola.png"',
      '    bio="要是人生能像星露谷就好了。"',
      '  />',
      '</div>',
      '```',
      '',
      '## React 组件实现',
      '',
      '```tsx',
      'import type React from "react";',
      'import "./FriendLink.css";',
      '',
      'interface FriendProps {',
      '  name: string;',
      '  url: string;',
      '  avatar: string;',
      '  bio: string;',
      '}',
      '',
      'const getRandomBackgroundColor = () => {',
      '  const r = Math.floor(Math.random() * 256);',
      '  const g = Math.floor(Math.random() * 256);',
      '  const b = Math.floor(Math.random() * 256);',
      '  return `rgba(${r}, ${g}, ${b}, 0.5)`;',
      '};',
      '',
      'const fallbackAvatar = (event: React.SyntheticEvent<HTMLImageElement>) => {',
      '  const target = event.target as HTMLImageElement;',
      '  target.onerror = null;',
      '  target.src = "/momo.png";',
      '};',
      '',
      'const FriendLink: React.FC<FriendProps> = ({ name, url, avatar, bio }) => {',
      '  return (',
      '    <a',
      '      target="_blank"',
      '      href={url}',
      '      title={name}',
      '      className="friend-link"',
      '      style={{',
      '        backgroundColor: getRandomBackgroundColor(),',
      '        textDecoration: "none",',
      '        color: "inherit",',
      '      }}',
      '      rel="noopener noreferrer"',
      '    >',
      '      <div className="friend-link-div">',
      '        <div className="friend-link-avatar">',
      '          <img',
      '            src={avatar}',
      '            alt={`${name}\'s avatar`}',
      '            onError={(event) => fallbackAvatar(event)}',
      '          />',
      '        </div>',
      '',
      '        <div className="friend-link-info">',
      '          <div className="friend-name-div">',
      '            <span className="friend-name">{name}</span>',
      '            <i className="i-hugeicons-cursor-magic-selection-02 px-3" />',
      '          </div>',
      '          <p className="friend-bio">{bio}</p>',
      '        </div>',
      '      </div>',
      '    </a>',
      '  );',
      '};',
      '',
      'export default FriendLink;',
      '```',
      '',
      '## CSS 样式',
      '',
      '```css',
      '.friend-link-shell {',
      '  display: grid;',
      '  grid-template-columns: repeat(2, 1fr);',
      '  width: 100%;',
      '  gap: 10px;',
      '}',
      '',
      '.friend-link {',
      '  align-items: center;',
      '  border-radius: 20px;',
      '  padding: 10px 20px;',
      '}',
      '',
      '.friend-link:hover {',
      '  transform: scale(1.1);',
      '  transition: transform 0.3s ease-in-out;',
      '}',
      '',
      '.friend-link-div {',
      '  display: grid;',
      '  grid-template-columns: repeat(5, 1fr);',
      '  justify-content: center;',
      '  align-items: center;',
      '  margin: 10px;',
      '}',
      '',
      '.friend-link-avatar {',
      '  grid-column: span 1;',
      '  margin: 0 14px;',
      '  position: relative;',
      '  width: 80%;',
      '  height: 0;',
      '  padding-top: 80%;',
      '}',
      '',
      '.friend-link-avatar img {',
      '  width: 100%;',
      '  height: 100%;',
      '  border-radius: 50%;',
      '  position: absolute;',
      '  top: 0;',
      '  left: 0;',
      '  border: 2px solid white;',
      '}',
      '',
      '.friend-link-info {',
      '  grid-column: span 4;',
      '  margin: 0 10px;',
      '  font-size: 16px;',
      '  font-weight: bold;',
      '  color: #333;',
      '}',
      '',
      '.friend-name-div {',
      '  display: flex;',
      '  align-items: center;',
      '  margin-bottom: 5px;',
      '}',
      '',
      '.friend-name {',
      '  font-size: 16px;',
      '  font-weight: bold;',
      '  color: #333;',
      '}',
      '',
      '.friend-bio {',
      '  font-size: 14px;',
      '  color: #666;',
      '}',
      '```'
    ].join('\n');
  }

  result = convertObsidianCallouts(result);

  return normalizeWhitespace(result);
}

function findCategoryKey(relativeDir) {
  if (categoryMap.has(relativeDir)) return relativeDir;
  const segments = relativeDir.split('/').filter(Boolean);
  while (segments.length > 0) {
    const candidate = segments.join('/');
    if (categoryMap.has(candidate)) return candidate;
    segments.pop();
  }
  return '';
}

function ensureArrayUnique(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildTargetParts(relativePath) {
  if (specialTargets.has(relativePath)) {
    return specialTargets.get(relativePath);
  }

  const dir = path.posix.dirname(relativePath);
  const file = path.posix.basename(relativePath);
  const categoryKey = findCategoryKey(dir);
  const mappedDir = categoryMap.get(categoryKey) ?? ['misc'];
  const extraDir = dir
    .replace(categoryKey, '')
    .split('/')
    .filter(Boolean)
    .map(kebabCase)
    .filter(Boolean);

  return [...mappedDir, ...extraDir, `${kebabCase(file)}.md`];
}

function buildFrontmatter({ title, description, date, tags, draft, badge }) {
  const lines = [
    '---',
    `title: ${escapeYamlString(title)}`,
    `description: ${escapeYamlString(description)}`,
    `date: ${date}`,
    `tags: [${tags.map((tag) => escapeYamlString(tag)).join(', ')}]`,
    `draft: ${draft ? 'true' : 'false'}`
  ];

  if (badge) {
    lines.push(`badge: ${escapeYamlString(badge)}`);
  }

  lines.push('---', '');
  return lines.join('\n');
}

function migrateFile(sourcePath) {
  const relativePath = path.posix.normalize(path.relative(sourceRoot, sourcePath).split(path.sep).join('/'));
  const fileName = path.posix.basename(relativePath);
  if (fileName === '_index.md') return null;

  const raw = fs.readFileSync(sourcePath, 'utf8');
  const { frontmatter, body } = extractFrontmatter(raw);

  const title = stripQuotes(extractField(frontmatter, 'title')) || fileName.replace(/\.(md|mdx)$/i, '');
  const stat = fs.statSync(sourcePath);
  const fallbackDate = stat.mtime.toISOString().slice(0, 10);
  const date = stripQuotes(extractField(frontmatter, 'date')) || fallbackDate;
  const draft = parseBoolean(extractField(frontmatter, 'draft'));
  const frontmatterDescription = extractField(frontmatter, 'description');
  const bodyClean = sanitizeBody(body, relativePath);
  const description = buildDescription(frontmatterDescription, bodyClean);
  const categoryKey = findCategoryKey(path.posix.dirname(relativePath));
  const tags = ensureArrayUnique(parseTags(frontmatter));
  const badge = badgeMap.get(categoryKey) ?? '';
  const targetParts = buildTargetParts(relativePath);
  const targetPath = path.join(targetRoot, ...targetParts);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(
    targetPath,
    `${buildFrontmatter({ title, description, date, tags, draft, badge })}${bodyClean}\n`
  );

  return {
    source: relativePath,
    target: path.relative(workspaceRoot, targetPath).split(path.sep).join('/')
  };
}

const files = walk(sourceRoot);
const migrated = [];

for (const file of files) {
  const result = migrateFile(file);
  if (result) migrated.push(result);
}

console.log(`Migrated ${migrated.length} files.`);
for (const item of migrated.slice(0, 20)) {
  console.log(`${item.source} -> ${item.target}`);
}
