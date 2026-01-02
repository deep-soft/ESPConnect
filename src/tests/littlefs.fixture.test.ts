import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createLittleFSFromImage, DISK_VERSION_2_1, LittleFSError } from '../wasm/littlefs/index.js';

const FIXTURE_PATH = path.resolve(process.cwd(), 'src/tests/fixtures/fs-images/littlefs/littlefs_v2_1.bin');
const DEFAULT_WASM_PATH = path.resolve(process.cwd(), 'wasm/littlefs/littlefs.wasm');
const FALLBACK_WASM_PATH = path.resolve(process.cwd(), 'src/wasm/littlefs/littlefs.wasm');

const fixtureImage = new Uint8Array(readFileSync(FIXTURE_PATH));
const wasmURL = pathToFileURL(existsSync(DEFAULT_WASM_PATH) ? DEFAULT_WASM_PATH : FALLBACK_WASM_PATH).href;

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

const KNOWN_FILE = '/info.txt';
const RENAMED_FILE = '/info-renamed.txt';
const NESTED_FILE_NAME = 'nested_info.txt';

const createFixtureLittleFS = async () => createLittleFSFromImage(new Uint8Array(fixtureImage), { wasmURL });

type LittleFSEntry = { path: string; type: 'file' | 'dir'; size?: number; name?: string };

function listAllEntries(fs: { list: (path?: string) => LittleFSEntry[] }) {
  const entries: LittleFSEntry[] = [];
  const stack = ['/'];

  while (stack.length) {
    const dir = stack.pop();
    if (!dir) continue;
    const listed = fs.list(dir);
    for (const entry of listed) {
      entries.push(entry);
      if (entry.type === 'dir') {
        stack.push(entry.path);
      }
    }
  }

  return entries;
}

let originalFetch: typeof fetch;
let originalConsoleInfo: typeof console.info;

beforeAll(() => {
  originalConsoleInfo = console.info;
  console.info = vi.fn();

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof URL ? input : typeof input === 'string' ? new URL(input) : new URL(input.url);

    if (url.protocol === 'file:') {
      const bytes = readFileSync(fileURLToPath(url));
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/wasm',
        },
      });
    }

    return originalFetch(input, init);
  };
});

afterAll(() => {
  console.info = originalConsoleInfo;
  globalThis.fetch = originalFetch;
});

describe('littlefs fixture image', () => {
  it('mounts and lists known entries', async () => {
    const lfs = await createFixtureLittleFS();
    const entries = listAllEntries(lfs);

    expect(entries.length).toBeGreaterThan(0);

    const infoEntry = entries.find((entry) => entry.path === KNOWN_FILE);
    expect(infoEntry).toBeDefined();
    expect(infoEntry?.type).toBe('file');

    const nestedEntry = entries.find((entry) => entry.path.endsWith(`/${NESTED_FILE_NAME}`));
    expect(nestedEntry).toBeDefined();
    expect(nestedEntry?.type).toBe('file');
  });

  it('reports disk version 2.1', async () => {
    const lfs = await createFixtureLittleFS();
    expect(lfs.getDiskVersion()).toBe(DISK_VERSION_2_1);
  });

  it('reads known file bytes', async () => {
    const lfs = await createFixtureLittleFS();
    const bytes = lfs.readFile(KNOWN_FILE);

    expect(textDecoder.decode(bytes)).toBe('ESPConnect_LittleFS_test\n');
  });

  it('round-trips mutations through toImage and remount', async () => {
    const lfs = await createFixtureLittleFS();

    lfs.mkdir('/newdir');
    lfs.writeFile('/newdir/a.txt', textEncoder.encode('abc'));
    lfs.rename(KNOWN_FILE, RENAMED_FILE);
    lfs.writeFile('/todelete.bin', new Uint8Array([1, 2, 3]));
    lfs.deleteFile('/todelete.bin');

    const img2 = lfs.toImage();
    const lfs2 = await createLittleFSFromImage(img2, { wasmURL });

    expect(textDecoder.decode(lfs2.readFile('/newdir/a.txt'))).toBe('abc');
    expect(textDecoder.decode(lfs2.readFile(RENAMED_FILE))).toBe('ESPConnect_LittleFS_test\n');
    expect(() => lfs2.readFile(KNOWN_FILE)).toThrow();
    expect(() => lfs2.readFile('/todelete.bin')).toThrow();
  });

  it('formats and remounts cleanly', async () => {
    const lfs = await createFixtureLittleFS();

    lfs.format();
    expect(lfs.list('/')).toEqual([]);
    expect(() => lfs.readFile(KNOWN_FILE)).toThrow();

    const img3 = lfs.toImage();
    const lfs2 = await createLittleFSFromImage(img3, { wasmURL });
    const entries = lfs2.list('/');

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBe(0);
    expect(() => lfs2.readFile(KNOWN_FILE)).toThrow();
  });

  it('reports usage invariants', async () => {
    const lfs = await createFixtureLittleFS();
    const usage = lfs.getUsage();

    expect(usage && typeof usage === 'object').toBe(true);
    expect(Array.isArray(usage)).toBe(false);

    const numericValues = Object.values(usage).filter((value): value is number => typeof value === 'number');
    expect(numericValues.length).toBeGreaterThan(0);
    for (const value of numericValues) {
      expect(value).toBeGreaterThanOrEqual(0);
    }

    if ('capacityBytes' in usage && 'usedBytes' in usage && 'freeBytes' in usage) {
      const capacityBytes = (usage as { capacityBytes: number }).capacityBytes;
      const usedBytes = (usage as { usedBytes: number }).usedBytes;
      const freeBytes = (usage as { freeBytes: number }).freeBytes;

      expect(usedBytes + freeBytes).toBeLessThanOrEqual(capacityBytes);
    }
  });

  it('throws a typed error for missing files when possible', async () => {
    const lfs = await createFixtureLittleFS();

    let caught: unknown;
    try {
      lfs.readFile('/__missing__');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeTruthy();
    if (caught instanceof LittleFSError) {
      expect(typeof caught.code).toBe('number');
    }
  });
});
