import { useEffect, useState } from 'react';
import { CountdownWidget, UpdateWidgetRequest, Widget } from '../types';
import { describeSchedule } from '../schedule';

function countdownStatus(config: CountdownWidget['config'], now: number): string {
  const remainingMs = Date.parse(config.target) - now;
  if (remainingMs <= 0) return 'Finished';
  const minutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const left = days >= 2 ? `${days} days` : days === 1 ? `1 day ${hours % 24}h` : hours >= 1 ? `${hours}h ${minutes % 60}m` : `${minutes} min`;
  return `${left} left · ${new Date(config.target).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
}

interface WidgetCardProps {
  widget: Widget;
  onEdit: (widget: Widget) => void;
  onDelete: (widgetId: number) => void;
  onToggleEnabled: (widgetId: number, enabled: boolean) => void;
  onUpdate: (widgetId: number, data: UpdateWidgetRequest) => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export function WidgetCard({ widget, onEdit, onDelete, onToggleEnabled, onUpdate, isDragging, dragHandleProps }: WidgetCardProps) {
  // Re-render every 30s so countdown status stays current.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (widget.type !== 'countdown') return;
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, [widget.type]);

  const countdownFinished = widget.type === 'countdown' && Date.parse(widget.config.target) <= now;

  const getWidgetIcon = (type: string) => {
    switch (type) {
      case 'transit':
        return 'TR';
      case 'message':
        return 'MSG';
      case 'clock':
        return 'CLK';
      case 'countdown':
        return 'CDN';
      default:
        return 'WGT';
    }
  };

  const getWidgetSummary = (widget: Widget) => {
    switch (widget.type) {
      case 'transit':
        return `Transit arrivals${widget.config.subscriptionIds?.length ? ` (${widget.config.subscriptionIds.length} routes)` : ''}`;
      case 'message':
        return widget.config.text.substring(0, 50) + (widget.config.text.length > 50 ? '...' : '');
      case 'clock':
        return `${widget.config.format.toUpperCase()} ${widget.config.showDate ? '+ Date' : ''}`;
      case 'countdown':
        return `${widget.config.message} · ${countdownStatus(widget.config, now)}`;
      default:
        return 'Unknown widget';
    }
  };

  return (
    <div
      className={`mb-3 rounded-xl border p-4 transition ${
        isDragging ? 'border-accent-cyan shadow-glow bg-ops-900/85' : 'border-ops-700/70 bg-ops-900/60'
      } ${!widget.enabled || countdownFinished ? 'opacity-65' : ''}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div 
          {...dragHandleProps}
          className="cursor-grab self-start rounded-md border border-ops-600 p-1.5 text-ops-300 transition hover:text-accent-cyan active:cursor-grabbing"
          title="Drag to reorder"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="7" cy="5" r="1.5" />
            <circle cx="13" cy="5" r="1.5" />
            <circle cx="7" cy="10" r="1.5" />
            <circle cx="13" cy="10" r="1.5" />
            <circle cx="7" cy="15" r="1.5" />
            <circle cx="13" cy="15" r="1.5" />
          </svg>
        </div>

        <div className="flex flex-1 items-start gap-3">
          <div className="rounded-lg border border-ops-600 bg-ops-950/70 px-2.5 py-1 font-mono text-xs font-semibold text-accent-cyan">
            {getWidgetIcon(widget.type)}
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg capitalize text-ops-100">{widget.type} Widget</h3>
            <p className="mb-2 text-sm text-ops-300">{getWidgetSummary(widget)}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-ops-300">
              <span className="rounded bg-ops-900 px-2 py-1">Duration: {widget.duration}s</span>
              <span className="rounded bg-ops-900 px-2 py-1">Order: {widget.displayOrder + 1}</span>
              {widget.schedule && (
                <span
                  className={`rounded px-2 py-1 ${widget.showOnly ? 'bg-ops-900 text-ops-400 line-through' : 'bg-accent-cyan/15 text-accent-cyan'}`}
                  title={widget.showOnly ? 'Ignored while show only is on' : undefined}
                >
                  {describeSchedule(widget.schedule)}
                </span>
              )}
              {widget.showOnly && (
                <span className="rounded bg-accent-amber/20 px-2 py-1 text-accent-amber">Show only</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-row flex-wrap gap-2 sm:ml-4 sm:flex-col">
          <button
            onClick={() => onToggleEnabled(widget.id, !widget.enabled)}
            className={`rounded px-3 py-1.5 text-xs font-semibold ${
              widget.enabled
                ? 'bg-accent-mint/20 text-accent-mint hover:bg-accent-mint/30'
                : 'bg-ops-800 text-ops-200 hover:bg-ops-700'
            }`}
          >
            {widget.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button
            onClick={() => onUpdate(widget.id, { showOnly: !widget.showOnly })}
            title="Show this widget now, even outside its schedule, and hide every widget that isn't show only"
            className={`rounded px-3 py-1.5 text-xs font-semibold ${
              widget.showOnly
                ? 'bg-accent-amber/20 text-accent-amber hover:bg-accent-amber/30'
                : 'bg-ops-800 text-ops-200 hover:bg-ops-700'
            }`}
          >
            {widget.showOnly ? 'Show only: on' : 'Show only: off'}
          </button>
          <button
            onClick={() => onEdit(widget)}
            className="rounded bg-accent-cyan/15 px-3 py-1.5 text-xs font-semibold text-accent-cyan hover:bg-accent-cyan/25"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(widget.id)}
            className="tb-btn-danger"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
