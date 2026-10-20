import { Code2, Pencil, Plus, Trash2 } from 'lucide-react';

export type TopologyMenu =
  | { kind: 'pane'; x: number; y: number }
  | { kind: 'node'; x: number; y: number; nodeId: string };

interface TopologyContextMenuProps {
  menu: TopologyMenu;
  canManage: boolean;
  onAdd: () => void;
  onAddChild?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDeveloperMode?: () => void;
}

export default function TopologyContextMenu({
  menu,
  canManage,
  onAdd,
  onAddChild,
  onEdit,
  onDelete,
  onDeveloperMode,
}: TopologyContextMenuProps) {
  if (!canManage) return null;

  const left = Math.min(menu.x, window.innerWidth - 220);
  const top = Math.min(menu.y, window.innerHeight - 220);

  return (
    <div
      className="fixed z-[60] min-w-[180px] rounded-lg border bg-white py-1 shadow-lg"
      style={{ top: Math.max(8, top), left: Math.max(8, left), borderColor: '#e2e8f0' }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.kind === 'pane' && (
        <button type="button" className="sfm-ctx-item" onClick={onAdd}>
          <Plus className="w-4 h-4" /> Add device
        </button>
      )}
      {menu.kind === 'node' && canManage && (
        <>
          <button type="button" className="sfm-ctx-item" onClick={onAddChild}>
            <Plus className="w-4 h-4" /> Add child device
          </button>
          <button type="button" className="sfm-ctx-item" onClick={onEdit}>
            <Pencil className="w-4 h-4" /> Edit device
          </button>
          <button type="button" className="sfm-ctx-item" onClick={onDeveloperMode}>
            <Code2 className="w-4 h-4" /> Developer mode
          </button>
          <button type="button" className="sfm-ctx-item text-destructive" onClick={onDelete}>
            <Trash2 className="w-4 h-4" /> Delete device
          </button>
        </>
      )}
    </div>
  );
}
