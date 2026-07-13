export type VaultFile = {
  path: string;
  content: string;
  revision?: string;
};

export type VaultReader = {
  listFiles(): readonly VaultFile[];
};
