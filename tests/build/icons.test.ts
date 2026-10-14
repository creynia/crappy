// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const ICONS: Record<string, number> = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'icon-maskable-512.png': 512,
  'apple-touch-icon.png': 180,
};

describe('gen-icons', () => {
  beforeAll(() => {
    execFileSync('node', ['scripts/gen-icons.mjs'], { stdio: 'pipe' });
  });

  for (const [name, size] of Object.entries(ICONS)) {
    it(`${name} is a ${size}x${size} PNG`, () => {
      const buf = readFileSync(`public/icons/${name}`);
      expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
      expect(buf.readUInt32BE(16)).toBe(size);
      expect(buf.readUInt32BE(20)).toBe(size);
    });
  }
});
