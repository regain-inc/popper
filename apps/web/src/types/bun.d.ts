// Type declarations for Bun APIs used in the web app
// This avoids conflicts with other libraries when including full bun-types

declare namespace Bun {
  const password: {
    hash(
      password: string,
      options?: {
        algorithm?: 'argon2id' | 'argon2d' | 'argon2i' | 'bcrypt';
        memoryCost?: number;
        timeCost?: number;
      },
    ): Promise<string>;
    verify(password: string, hash: string): Promise<boolean>;
  };
}
