/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_HUB_DEFAULT_THEME?: "a" | "b" | "c";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

