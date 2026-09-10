import type { ContentHasher } from '../../application/planning/plan-sprint';

type DigestProvider = Pick<SubtleCrypto, 'digest'>;

export class WebCryptoContentHasher implements ContentHasher {
  constructor(private readonly subtle: DigestProvider = crypto.subtle) {}

  async hash(content: string): Promise<string> {
    const bytes = new TextEncoder().encode(content);
    const digest = await this.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    return `sha256:${hex}`;
  }
}
