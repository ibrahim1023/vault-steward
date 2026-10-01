export type VaultFile = {
  path: string;
  content: string;
  revision?: string;
  subjectId?: string;
};

export type VaultReader = {
  listFiles(signal?: AbortSignal): Promise<readonly VaultFile[]>;
};
