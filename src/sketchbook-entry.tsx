import { createRoot } from 'react-dom/client';
import { useLayoutEffect, useRef, useState } from 'react';
import { Sketchbook } from '@designcodeio/threeui';
import authoredStyle from '@designcodeio/threeui/style.css';
import { createPulseSketchbookDocument } from './pulse-sketchbook-document.js';
import { createPulseSketchbookSpreads } from './pulse-sketchbook-spreads.js';

// The exact authored reference remains separate from the live personal book.
function ConfiguredScene() {
  return <div className="shader-frame"><Sketchbook assetBaseUrl="/sketchbook/" /></div>;
}

function PersonalScene({ documentSource }: { documentSource: string }) {
  const [state, setState] = useState('loading');
  const frame = useRef<HTMLIFrameElement>(null);
  useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== 'pulse-sketchbook-ready') return;
      setState(event.data.ok === true ? 'ready' : 'error');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return <div className="shader-frame"><div className="sketchbook" data-state={state}><iframe
    ref={frame}
    className={`sketchbook__frame${state === 'ready' ? ' is-ready' : ''}`}
    title="Your pulse painting sketchbook"
    srcDoc={documentSource}
    sandbox="allow-scripts"
  /></div></div>;
}

// A sandboxed opaque document cannot resolve a parent-origin blob URL. Embed
// only our freshly composed PNGs; never grant the iframe same-origin access.
async function embeddedPlate(page: { url: string; title: string; place: string }, signal: AbortSignal) {
  const url = new URL(page.url);
  if (url.protocol !== 'blob:' || url.origin !== location.origin) throw new Error('A locally prepared sketchbook plate is required.');
  const response = await fetch(url.href, { signal });
  const blob = await response.blob();
  if (blob.type !== 'image/png' || !blob.size || blob.size > 12 * 1024 * 1024) throw new Error('The sketchbook plate could not be prepared.');
  const dataURL = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => { reader.abort(); cleanup(); reject(new DOMException('The sketchbook was closed.', 'AbortError')); };
    reader.onload = () => { cleanup(); resolve(String(reader.result)); };
    reader.onerror = () => { cleanup(); reject(reader.error || new Error('The sketchbook plate could not be read.')); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    reader.readAsDataURL(blob);
  });
  return { ...page, url: dataURL };
}

function createIsland(container: HTMLElement) {
  const host = document.createElement('div');
  host.className = 'pulse-sketchbook-island';
  const shadow = host.attachShadow({ mode: 'open' });
  const sizing = document.createElement('style');
  sizing.textContent = ':host{display:block;width:100%;height:100%;min-height:0}.shader-frame,.pulse-sketchbook-react-root{width:100%;height:100%;min-height:0}';
  const style = document.createElement('style');
  style.textContent = authoredStyle;
  const node = document.createElement('div');
  node.className = 'pulse-sketchbook-react-root';
  shadow.append(sizing, style, node);
  container.append(host);
  const root = createRoot(node);
  let disposed = false;
  let settleReady: (ready: boolean) => void;
  const ready = new Promise<boolean>(resolve => { settleReady = resolve; });
  const observer = new MutationObserver(() => {
    const state = shadow.querySelector('.sketchbook')?.getAttribute('data-state');
    if (state !== 'ready' && state !== 'error') return;
    clearTimeout(timeout); observer.disconnect(); settleReady(state === 'ready');
  });
  observer.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });
  const timeout = setTimeout(() => { observer.disconnect(); settleReady(false); }, 30000);
  return {
    render: root.render.bind(root),
    ready,
    destroy() {
      if (disposed) return;
      disposed = true;
      clearTimeout(timeout); observer.disconnect(); settleReady(false);
      root.unmount();
      host.remove();
    },
  };
}

// Original authored study: retained for the exact-source reference fixture.
export function mountSketchbook(container: HTMLElement) {
  const island = createIsland(container);
  island.render(<ConfiguredScene />);
  return { ready: island.ready, destroy: island.destroy };
}

// Live adaptation: receives only the already-prepared image, never recording
// samples, metrics objects or publication capabilities.
export function mountPulseSketchbook(container: HTMLElement, { blob }: { blob: Blob }) {
  const controller = new AbortController();
  let disposed = false, island: ReturnType<typeof createIsland> | null = null;
  let spreads: Awaited<ReturnType<typeof createPulseSketchbookSpreads>> | null = null;
  const ready = (async () => {
    try {
      const prepared = await createPulseSketchbookSpreads(blob, { signal: controller.signal });
      if (disposed) { prepared.dispose(); return false; }
      spreads = prepared;
      const pages = [];
      for (const page of spreads.pages) pages.push(await embeddedPlate(page, controller.signal));
      if (disposed) return false;
      const documentSource = createPulseSketchbookDocument(pages);
      island = createIsland(container);
      island.render(<PersonalScene documentSource={documentSource} />);
      return await island.ready;
    } catch (error) {
      if (disposed || controller.signal.aborted) return false;
      spreads?.dispose(); spreads = null;
      throw error;
    }
  })();
  return {
    ready,
    destroy() {
      if (disposed) return;
      disposed = true; controller.abort(); island?.destroy(); spreads?.dispose();
      island = null; spreads = null;
    },
  };
}
