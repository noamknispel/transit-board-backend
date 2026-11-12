import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { LogLine, SerialStatus } from '../types';

const MAX_LINES = 1000;

export function DeviceLogs() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<SerialStatus | null>(null);
  const [streamOpen, setStreamOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [clearedAt, setClearedAt] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const source = new EventSource(api.logStreamUrl());

    source.onopen = () => setStreamOpen(true);
    source.onerror = () => setStreamOpen(false);
    source.addEventListener('status', (event) => {
      setStatus(JSON.parse((event as MessageEvent).data));
    });
    source.onmessage = (event) => {
      const line: LogLine = JSON.parse(event.data);
      setLines((prev) => {
        const next = prev.length >= MAX_LINES ? prev.slice(-MAX_LINES + 1) : prev.slice();
        next.push(line);
        return next;
      });
    };

    return () => source.close();
  }, []);

  // Follow the tail unless paused
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, paused]);

  const visible = lines.filter((line) => line.id > clearedAt);

  const statusLabel = !streamOpen
    ? 'Backend offline'
    : !status?.enabled
      ? 'Serial disabled'
      : status.connected
        ? `Connected · ${status.port}`
        : 'Board not connected';
  const statusColor = streamOpen && status?.connected ? 'bg-accent-mint' : 'bg-accent-amber';

  return (
    <div className="tb-panel mt-6 p-5 md:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl text-white">Board Console</h2>
          <p className="flex items-center gap-2 text-sm text-ops-200">
            <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
            {statusLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPaused((p) => !p)} className="tb-btn-secondary">
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={() => setClearedAt(lines.length ? lines[lines.length - 1].id : 0)}
            className="tb-btn-secondary"
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto rounded-lg border border-ops-700/70 bg-ops-950/80 p-3 font-mono text-xs leading-relaxed"
      >
        {visible.length === 0 ? (
          <p className="text-ops-400">No output yet.</p>
        ) : (
          visible.map((line) => (
            <div key={line.id} className="flex gap-3 whitespace-pre-wrap break-all">
              <span className="shrink-0 text-ops-500">
                {new Date(line.ts).toLocaleTimeString()}
              </span>
              <span className={line.source === 'system' ? 'text-accent-cyan' : 'text-ops-100'}>
                {line.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
