import { describe, expect, it, vi } from 'vitest';
import { WebCryptoContentHasher } from './WebCryptoContentHasher';

describe('WebCryptoContentHasher', () => {
  it('encodes UTF-8 input and returns a prefixed lowercase SHA-256 digest', async () => {
    const digest = vi.fn(
      async (_algorithm: AlgorithmIdentifier, _data: BufferSource) =>
        Uint8Array.from([0, 1, 15, 16, 254, 255]).buffer,
    );
    const hasher = new WebCryptoContentHasher({ digest });

    await expect(hasher.hash('café')).resolves.toBe('sha256:00010f10feff');

    expect(digest).toHaveBeenCalledOnce();
    expect(digest.mock.calls[0]?.[0]).toBe('SHA-256');
    expect(Array.from(digest.mock.calls[0]?.[1] as Uint8Array)).toEqual([
      99, 97, 102, 195, 169,
    ]);
  });
});
