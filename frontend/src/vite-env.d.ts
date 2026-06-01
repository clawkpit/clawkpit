/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string;
  /** Base URL for agent skill docs (e.g. https://clawkpit.com when app is on app.clawkpit.com). */
  readonly VITE_AGENT_DOCS_URL?: string;
  /** @deprecated Use VITE_AGENT_DOCS_URL */
  readonly VITE_OPENCLAW_DOCS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
