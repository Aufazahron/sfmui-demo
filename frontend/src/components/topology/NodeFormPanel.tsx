import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ParentSearchSelect from '@/components/topology/ParentSearchSelect';
import type { SFMNode } from '@/types';

export interface NodeFormValues {
  deviceId: string;
  name: string;
  location: string;
  parentId: string | null;
}

interface NodeFormPanelProps {
  open: boolean;
  mode: 'create' | 'edit';
  nodes: SFMNode[];
  excludeId?: string;
  initial: NodeFormValues;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: NodeFormValues) => void;
}

const fieldClass = 'h-10 placeholder:text-[#9aa0a6]';

export default function NodeFormPanel({
  open,
  mode,
  nodes,
  excludeId,
  initial,
  submitting,
  onClose,
  onSubmit,
}: NodeFormPanelProps) {
  const [deviceId, setDeviceId] = useState(initial.deviceId);
  const [name, setName] = useState(initial.name);
  const [location, setLocation] = useState(initial.location);
  const [parentId, setParentId] = useState(initial.parentId ?? 'none');

  useEffect(() => {
    if (!open) return;
    setDeviceId(initial.deviceId);
    setName(initial.name);
    setLocation(initial.location);
    setParentId(initial.parentId ?? 'none');
  }, [open, initial.deviceId, initial.name, initial.location, initial.parentId]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className="sm:max-w-md overflow-visible"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-parent-search]')) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add device' : 'Edit device'}</DialogTitle>
          <DialogDescription className="sr-only">
            {mode === 'create' ? 'Add a new device node' : 'Edit device node'}
          </DialogDescription>
        </DialogHeader>

        <div className="relative z-10 space-y-3 overflow-visible py-1">
          <label className="block space-y-1.5">
            <span className="sfm-label-caps">Device ID</span>
            <Input
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="Masukkan ID perangkat"
              disabled={mode === 'edit'}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="sfm-label-caps">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masukkan nama perangkat"
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="sfm-label-caps">Location</span>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Masukkan lokasi"
              className={fieldClass}
            />
          </label>
          <div className="space-y-1.5">
            <span className="sfm-label-caps">Parent</span>
            <ParentSearchSelect
              value={parentId}
              nodes={nodes}
              excludeId={excludeId}
              onChange={setParentId}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting}
            className="font-semibold"
            style={{ background: '#57dffe', color: '#091426', border: 'none' }}
            onClick={() =>
              onSubmit({
                deviceId: deviceId.trim(),
                name: name.trim(),
                location: location.trim(),
                parentId: parentId === 'none' ? null : parentId,
              })
            }
          >
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
