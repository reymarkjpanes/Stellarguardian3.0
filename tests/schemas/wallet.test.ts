/**
 * tests/schemas/wallet.test.ts
 * Unit tests for wallet validation schemas.
 */
import { describe, it, expect } from 'vitest';
import { ConnectWalletSchema } from '../../server/schemas/wallet';

describe('ConnectWalletSchema', () => {
  // Valid Stellar public key format (56 chars, starts with G, base32 encoding)
  const validKey = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI';

  it('accepts valid Stellar public key', () => {
    const result = ConnectWalletSchema.safeParse({ walletAddress: validKey });
    expect(result.success).toBe(true);
  });

  it('accepts null (disconnect wallet)', () => {
    const result = ConnectWalletSchema.safeParse({ walletAddress: null });
    expect(result.success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = ConnectWalletSchema.safeParse({ walletAddress: '' });
    expect(result.success).toBe(false);
  });

  it('rejects key not starting with G', () => {
    const result = ConnectWalletSchema.safeParse({
      walletAddress: 'SBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI',
    });
    expect(result.success).toBe(false);
  });

  it('rejects key too short', () => {
    const result = ConnectWalletSchema.safeParse({ walletAddress: 'GBZXN7PIRZGNMHGA7' });
    expect(result.success).toBe(false);
  });

  it('rejects key too long', () => {
    const result = ConnectWalletSchema.safeParse({
      walletAddress: validKey + 'EXTRA',
    });
    expect(result.success).toBe(false);
  });

  it('rejects key with lowercase characters', () => {
    const result = ConnectWalletSchema.safeParse({
      walletAddress: 'Gbzxn7pirzgnmhga7muuuf4gwpy5aypv6ly4uv2gl6vjgiqrxfdnmadi',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing walletAddress field', () => {
    const result = ConnectWalletSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects numeric walletAddress', () => {
    const result = ConnectWalletSchema.safeParse({ walletAddress: 12345 });
    expect(result.success).toBe(false);
  });
});
