import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=',
  'base64'
);

describe('admin media api', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-media-api-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;

    await mkdir(path.join(tempRoot, 'public', 'author'), { recursive: true });
    await mkdir(path.join(tempRoot, 'public', 'bits'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'bits'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'essay', 'guide-assets'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'assets'), { recursive: true });

    await writeFile(path.join(tempRoot, 'public', 'author', 'avatar.png'), PNG_1X1);
    await writeFile(path.join(tempRoot, 'public', 'bits', 'demo.png'), PNG_1X1);
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'guide.md'),
      ['---', 'title: 附件映射测试', '---', '', '![封面](./guide-assets/hero.png)'].join('\n')
    );
    await writeFile(path.join(tempRoot, 'src', 'content', 'essay', 'guide-assets', 'hero.png'), PNG_1X1);
    await writeFile(path.join(tempRoot, 'src', 'content', 'bits', 'inline.png'), PNG_1X1);
    await writeFile(path.join(tempRoot, 'src', 'assets', 'hero.png'), PNG_1X1);
  });

  afterEach(async () => {
    delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('lists field-scoped items in dev/test mode', async () => {
    const { GET } = await import('../src/pages/api/admin/media/list');

    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/list?field=bits.images&dir=public/bits&page=1&limit=10')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.directory).toBe('public/bits');
    expect(payload.result.items.every((item: { path: string }) => item.path.startsWith('public/bits/'))).toBe(true);
    expect(payload.result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'bits/demo.png',
          origin: 'public'
        })
      ])
    );
  });

  it('supports directory browsing without field-scoped value mapping', async () => {
    const { GET } = await import('../src/pages/api/admin/media/list');

    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/list?dir=src/assets&page=1&limit=10')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.directory).toBe('src/assets');
    expect(payload.result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/assets/hero.png',
          value: 'src/assets/hero.png',
          origin: 'src/assets'
        })
      ])
    );
  });

  it('filters content attachments by owner and resolves relative asset references', async () => {
    const { GET } = await import('../src/pages/api/admin/media/list');

    const response = await GET({
      url: new URL(
        'http://127.0.0.1:4321/api/admin/media/list?dir=src/content&owner=src/content/essay/guide&page=1&limit=10'
      )
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.directory).toBe('src/content');
    expect(payload.result.owner).toBe('src/content/essay/guide');
    expect(payload.result.ownerOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'src/content/essay/guide',
          label: '随笔 · 附件映射测试'
        })
      ])
    );
    expect(payload.result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/content/essay/guide-assets/hero.png',
          value: 'src/content/essay/guide-assets/hero.png',
          origin: 'src/content',
          owner: 'src/content/essay/guide',
          ownerLabel: '随笔 · 附件映射测试'
        })
      ])
    );
    expect(payload.result.items.every((item: { owner: string | null }) => item.owner === 'src/content/essay/guide')).toBe(true);
  });

  it('returns metadata for field values and keeps remote urls readonly-compatible', async () => {
    const { GET } = await import('../src/pages/api/admin/media/meta');

    const localResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/meta?field=home.heroImageSrc&value=src/assets/hero.png')
    } as never);
    expect(localResponse.status).toBe(200);
    const localPayload = JSON.parse(await localResponse.text());
    expect(localPayload.ok).toBe(true);
    expect(localPayload.result.kind).toBe('local');
    expect(localPayload.result.width).toBe(1);
    expect(localPayload.result.height).toBe(1);

    const remoteResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/meta?field=bits.images&value=https://example.com/demo.webp')
    } as never);
    expect(remoteResponse.status).toBe(200);
    const remotePayload = JSON.parse(await remoteResponse.text());
    expect(remotePayload.ok).toBe(true);
    expect(remotePayload.result.kind).toBe('remote');
    expect(remotePayload.result.width).toBeNull();
    expect(remotePayload.result.height).toBeNull();
  });
});
