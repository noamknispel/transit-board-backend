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
    <div ref={setNodeRef} style={style} {...attributes}>
      <WidgetCard
        widget={widget}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleEnabled={onToggleEnabled}
        isDragging={isDragging}
        dragHandleProps={listeners}
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
    <div className="tb-panel p-5 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl text-ops-100">Widget Stack</h2>
          <p className="text-sm text-ops-300">Drag to reorder playback priority and timing.</p>
        </div>
        <button
          onClick={onAddWidget}
          className="tb-btn-primary"
        >
          + Add Widget
        </button>
      </div>

      {widgets.length === 0 ? (
        <div className="tb-panel-soft py-12 text-center">
          <p className="font-display text-2xl text-ops-100">No widgets configured</p>
          <p className="mt-2 text-sm text-ops-300">Add your first widget to start rendering board content.</p>
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
