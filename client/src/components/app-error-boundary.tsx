import { Component, type ErrorInfo, type ReactNode } from 'react';
export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, _info: ErrorInfo) { console.error('Screen could not load', error.name); }
  render() {
    return this.state.failed ? <main className="p-8 space-y-4 max-w-xl mx-auto" role="alert"><h1 className="text-2xl font-semibold">This screen needs a fresh start.</h1><p>Your saved café data is safe. Reload to load the latest application.</p><button className="rounded-lg border px-4 py-2" onClick={() => window.location.reload()}>Reload application</button></main> : this.props.children;
  }
}
