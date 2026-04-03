import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Widget } from '../types';
import { WidgetCard } from './WidgetCard';

interface WidgetListProps {
  widgets: Widget[];
  onReorder: (widgetIds: number[]) => void;
  onEdit: (widget: Widget) => void;
  onDelete: (widgetId: number) => void;
  onToggleEnabled: (widgetId: number, enabled: boolean) => void;
  onAddWidget: () => void;
}

function SortableWidget({ widget, onEdit, onDelete, onToggleEnabled }: { 
  widget: Widget; 
  onEdit: (widget: Widget) => void;
  onDelete: (widgetId: number) => void;
  onToggleEnabled: (widgetId: number, enabled: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <WidgetCard
        widget={widget}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleEnabled={onToggleEnabled}
        isDragging={isDragging}
      />
    </div>
  );
}

export function WidgetList({ widgets, onReorder, onEdit, onDelete, onToggleEnabled, onAddWidget }: WidgetListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);

      const reorderedWidgets = arrayMove(widgets, oldIndex, newIndex);
      onReorder(reorderedWidgets.map((w) => w.id));
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Widgets</h2>
        <button
          onClick={onAddWidget}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Add Widget
        </button>
      </div>

      {widgets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No widgets configured</p>
          <p className="text-sm">Click "Add Widget" to get started</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={widgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
            {widgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleEnabled={onToggleEnabled}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
