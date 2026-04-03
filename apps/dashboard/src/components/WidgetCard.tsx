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
        return '🚇';
      case 'message':
        return '💬';
      case 'clock':
        return '🕐';
      default:
        return '📱';
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
      className={`bg-white rounded-lg shadow-md p-4 mb-3 border-2 ${
        isDragging ? 'border-blue-500 opacity-50' : 'border-transparent'
      } ${!widget.enabled ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between">
        {/* Drag handle */}
        <div 
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 mr-2 pt-1"
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

        <div className="flex items-start flex-1">
          <div className="text-3xl mr-3">{getWidgetIcon(widget.type)}</div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg capitalize">{widget.type} Widget</h3>
            <p className="text-gray-600 text-sm mb-2">{getWidgetSummary(widget)}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Duration: {widget.duration}s</span>
              <span>Order: {widget.displayOrder + 1}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 ml-4">
          <button
            onClick={() => onToggleEnabled(widget.id, !widget.enabled)}
            className={`px-3 py-1 text-xs rounded ${
              widget.enabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {widget.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button
            onClick={() => onEdit(widget)}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(widget.id)}
            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
