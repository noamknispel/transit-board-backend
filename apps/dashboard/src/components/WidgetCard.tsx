import { Widget } from '../types';

interface WidgetCardProps {
  widget: Widget;
  onEdit: (widget: Widget) => void;
  onDelete: (widgetId: number) => void;
  onToggleEnabled: (widgetId: number, enabled: boolean) => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export function WidgetCard({ widget, onEdit, onDelete, onToggleEnabled, isDragging, dragHandleProps }: WidgetCardProps) {
  const getWidgetIcon = (type: string) => {
    switch (type) {
      case 'transit':
        return 'TR';
      case 'message':
        return 'MSG';
      case 'clock':
        return 'CLK';
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
      default:
        return 'Unknown widget';
    }
  };

  return (
    <div
      className={`mb-3 rounded-xl border p-4 transition ${
        isDragging ? 'border-accent-cyan shadow-glow bg-ops-900/85' : 'border-ops-700/70 bg-ops-900/60'
      } ${!widget.enabled ? 'opacity-65' : ''}`}
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
