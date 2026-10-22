declare module 'cloudflare:node' {
  export function handleAsNodeRequest(port: number, request: globalThis.Request): Promise<globalThis.Response>;
}
