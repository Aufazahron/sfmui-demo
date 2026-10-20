import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Server, Activity, Droplets, Clock, Unlock, Save, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { getNodes } from '@/services/nodes';
import { createNode, deleteNodeApi, enableHybridAp, updateNodeApi } from '@/services/nodesApi';
import TopologyNode from '@/components/topology/TopologyNode';
import TopologyContextMenu, { type TopologyMenu } from '@/components/topology/TopologyContextMenu';
import NodeFormPanel, { type NodeFormValues } from '@/components/topology/NodeFormPanel';
import NodeDetailView from '@/components/nodes/NodeDetailView';
import type { NodeMode, NodeSchedule, SFMNode } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { applyLivePatch, useLiveTelemetry } from '@/context/LiveTelemetryContext';
import StatusBadge from '@/components/common/StatusBadge';
import ValveBadge from '@/components/common/ValveBadge';
import ModeBadge from '@/components/common/ModeBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TopologyFlowNode = Node<{ node: SFMNode; onClick: (node: SFMNode) => void }>;

const nodeTypes = {
  customNode: TopologyNode,
};

const calculateInitialLayout = (nodes: SFMNode[]) => {
  const flowNodes: any[] = [];
  const flowEdges: any[] = [];
  const nodeHeight = 200;

  const savedLayoutStr = localStorage.getItem('sfm_topology_layout');
  let savedPositions: Record<string, { x: number; y: number }> = {};
  if (savedLayoutStr) {
    try {
      savedPositions = JSON.parse(savedLayoutStr);
    } catch (e) {}
  }

  const buildTree = (node: SFMNode, level: number, xStart: number, width: number) => {
    const x = xStart + width / 2;
    const y = 50 + level * nodeHeight;

    const defaultPos = { x: x - 130, y };
    const position = savedPositions[node.id] || defaultPos;

    flowNodes.push({
      id: node.id,
      type: 'customNode',
      position,
      data: { node },
    });

    const children = nodes.filter(n => n.parentId === node.id);
    if (children.length > 0) {
      const childWidth = width / children.length;
      children.forEach((child, index) => {
        const childXStart = xStart + index * childWidth;

        flowEdges.push({
          id: `e-${node.id}-${child.id}`,
          source: node.id,
          target: child.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#57dffe', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#57dffe' },
        });

        buildTree(child, level + 1, childXStart, childWidth);
      });
    }
  };

  const roots = nodes.filter(n => n.parentId === null || !nodes.some(p => p.id === n.parentId));
  if (roots.length === 0) return { initialNodes: [], initialEdges: [] };

  roots.forEach((root, index) => {
    const width = 1200 / roots.length;
    buildTree(root, 0, index * width, width);
  });

  return { initialNodes: flowNodes, initialEdges: flowEdges };
};

export default function Topology() {
  return (
    <ReactFlowProvider>
      <TopologyInner />
    </ReactFlowProvider>
  );
}

function TopologyInner() {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { patches } = useLiveTelemetry();
  const { screenToFlowPosition } = useReactFlow();
  const canManage = isSuperAdmin;

  const [nodesData, setNodesData] = useState<SFMNode[]>([]);
  const [nodesReady, setNodesReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void getNodes()
      .then((nodes) => {
        if (alive) {
          setNodesData(nodes);
          setNodesReady(true);
        }
      })
      .catch(() => {
        if (alive) {
          setNodesData([]);
          setNodesReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  const [selectedNode, setSelectedNode] = useState<SFMNode | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [menu, setMenu] = useState<TopologyMenu | null>(null);
  const [form, setForm] = useState<{ mode: 'create' | 'edit'; parentId: string | null; editId?: string } | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [flowPos, setFlowPos] = useState<{ x: number; y: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SFMNode | null>(null);
  const [developerTarget, setDeveloperTarget] = useState<SFMNode | null>(null);
  const [developerBusy, setDeveloperBusy] = useState(false);
  const [pickingEdit, setPickingEdit] = useState(false);
  const pickingEditRef = useRef(false);

  const liveNodesData = useMemo(
    () => nodesData.map((node) => applyLivePatch(node, patches)),
    [nodesData, patches],
  );

  const structureKey = useMemo(
    () => nodesData.map((node) => `${node.id}:${node.parentId ?? ''}`).join('|'),
    [nodesData],
  );

  const detailNode = useMemo(
    () => (nodeId ? liveNodesData.find(n => n.id === nodeId) ?? null : null),
    [nodeId, liveNodesData],
  );

  const { initialNodes, initialEdges } = useMemo(
    () => calculateInitialLayout(nodesData),
    // layout only when tree membership changes, not on live telemetry
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structureKey],
  );

  const onNodeClick = useCallback((node: SFMNode) => {
    if (pickingEditRef.current) {
      pickingEditRef.current = false;
      setPickingEdit(false);
      setSelectedNode(null);
      setMenu(null);
      setForm({ mode: 'edit', parentId: node.parentId, editId: node.id });
      return;
    }
    setSelectedNode(node);
  }, []);

  const nodesWithClick = useMemo(() => {
    return initialNodes.map(n => ({
      ...n,
      data: { ...n.data, onClick: onNodeClick },
    }));
  }, [initialNodes, onNodeClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState<TopologyFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes(nodesWithClick as TopologyFlowNode[]);
    setEdges(initialEdges as Edge[]);
  }, [structureKey, nodesWithClick, initialEdges, setNodes, setEdges]);

  useEffect(() => {
    setNodes((current) =>
      current.map((flowNode) => {
        const base = nodesData.find((node) => node.id === flowNode.id);
        if (!base) return flowNode;
        const merged = applyLivePatch(base, patches);
        return { ...flowNode, data: { ...flowNode.data, node: merged, onClick: onNodeClick } };
      }),
    );
  }, [patches, nodesData, onNodeClick, setNodes]);

  const updateNode = (id: string, patch: Partial<SFMNode>) => {
    setNodesData(prev =>
      prev.map(n => (n.id === id ? { ...n, ...patch, lastUpdate: new Date().toISOString() } : n)),
    );
  };

  const handleModeChange = async (mode: NodeMode) => {
    if (!detailNode) return;
    try {
      await updateNodeApi(detailNode.id, { mode });
      updateNode(detailNode.id, { mode });
      toast.success('Mode updated', { description: `${detailNode.name} is now in ${mode} mode.` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update mode');
    }
  };

  const handleValveChange = async (state: 'open' | 'closed', reason: string) => {
    if (!detailNode) {
      throw new Error('Cannot send valve command');
    }
    try {
      await updateNodeApi(detailNode.id, { valveState: state, reason });
      toast.success('Command sent', {
        description: `${detailNode.name}: ${state === 'open' ? 'opening' : 'closing'} valve.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send valve command');
      throw err;
    }
  };

  const handleLimitSave = async (limit: number) => {
    if (!detailNode) return;
    try {
      await updateNodeApi(detailNode.id, { dailyLimit: limit });
      updateNode(detailNode.id, { dailyLimit: limit });
      toast.success('Daily limit saved', { description: `${detailNode.name} limit set to ${limit.toLocaleString()} L.` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save limit');
    }
  };

  const handleScheduleSave = async (schedule: NodeSchedule) => {
    if (!detailNode) return;
    try {
      await updateNodeApi(detailNode.id, { schedule });
      updateNode(detailNode.id, { schedule });
      toast.success('Schedule saved', { description: `${detailNode.name} operating schedule updated.` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save schedule');
    }
  };

  const handleSave = () => {
    const layout: Record<string, { x: number; y: number }> = {};
    nodes.forEach(n => {
      layout[n.id] = n.position;
    });
    localStorage.setItem('sfm_topology_layout', JSON.stringify(layout));
    setIsEditing(false);
    setShowConfirm(false);
    toast.success('Layout saved successfully', { description: 'The new topology arrangement has been saved for all users.' });
  };

  const handleCancel = () => {
    setIsEditing(false);
    window.location.reload();
  };

  const closeOverlays = () => {
    setMenu(null);
    setForm(null);
    if (pickingEditRef.current) {
      pickingEditRef.current = false;
      setPickingEdit(false);
    }
  };

  const rememberPosition = (id: string, pos: { x: number; y: number }) => {
    const raw = localStorage.getItem('sfm_topology_layout');
    let layout: Record<string, { x: number; y: number }> = {};
    if (raw) {
      try { layout = JSON.parse(raw); } catch { /* ignore */ }
    }
    layout[id] = pos;
    localStorage.setItem('sfm_topology_layout', JSON.stringify(layout));
  };

  const reloadNodes = async () => {
    const next = await getNodes();
    setNodesData(next);
  };

  const onPaneContextMenu = useCallback((event: { preventDefault: () => void; clientX: number; clientY: number }) => {
    event.preventDefault();
    setForm(null);
    setSelectedNode(null);
    setFlowPos(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    setMenu({ kind: 'pane', x: event.clientX, y: event.clientY });
  }, [screenToFlowPosition]);

  const onNodeContextMenu = useCallback((event: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }, node: { id: string }) => {
    event.preventDefault();
    event.stopPropagation();
    setForm(null);
    setSelectedNode(null);
    setFlowPos(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    setMenu({ kind: 'node', x: event.clientX, y: event.clientY, nodeId: node.id });
  }, [screenToFlowPosition, nodesData]);

  const handleToolbarAdd = () => {
    pickingEditRef.current = false;
    setPickingEdit(false);
    setMenu(null);
    setSelectedNode(null);
    openCreateForm(null);
  };

  const handleToolbarEdit = () => {
    const next = !pickingEditRef.current;
    pickingEditRef.current = next;
    setPickingEdit(next);
    setMenu(null);
    setSelectedNode(null);
    setForm(null);
    if (next) {
      toast.message('Pilih node di canvas untuk diedit');
    }
  };

  const openCreateForm = (parentId: string | null) => {
    setMenu(null);
    setForm({ mode: 'create', parentId });
  };

  const openEditForm = (target: SFMNode) => {
    setMenu(null);
    setForm({ mode: 'edit', parentId: target.parentId, editId: target.id });
  };

  const handleFormSubmit = async (values: NodeFormValues) => {
    if (!values.name || !values.location || (form?.mode === 'create' && !values.deviceId)) {
      toast.error('Device ID, name, and location are required');
      return;
    }
    if (form?.mode === 'create' && !/^[a-zA-Z0-9_-]+$/.test(values.deviceId)) {
      toast.error('Device ID may only contain letters, numbers, _ and -');
      return;
    }

    setFormBusy(true);
    try {
      if (form?.mode === 'edit' && form.editId) {
        await updateNodeApi(form.editId, {
          name: values.name,
          location: values.location,
          parentId: values.parentId,
        });
        await reloadNodes();
        toast.success('Device updated');
      } else {
        const result = await createNode({
          deviceId: values.deviceId,
          name: values.name,
          location: values.location,
          parentId: values.parentId,
        });
        if (flowPos) rememberPosition(result.node.id, flowPos);
        await reloadNodes();
        toast.success('Device added', {
          description: `MQTT topic ${result.provisioning.topicPrefix}/#`,
        });
      }
      setForm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save device');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteNodeApi(deleteTarget.id);
      await reloadNodes();
      toast.success('Device deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete device');
    }
  };

  const handleDeveloperMode = async () => {
    if (!developerTarget || developerBusy) return;
    setDeveloperBusy(true);
    try {
      await enableHybridAp(developerTarget.id);
      toast.success('Developer mode command sent', {
        description: `Hybrid Access Point requested on ${developerTarget.name}.`,
      });
      setDeveloperTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send developer command');
    } finally {
      setDeveloperBusy(false);
    }
  };

  const menuNode = menu?.kind === 'node' ? nodesData.find(n => n.id === menu.nodeId) : null;
  const editNode = form?.editId ? nodesData.find(n => n.id === form.editId) : null;
  const formInitial = useMemo<NodeFormValues>(() => {
    if (form?.mode === 'edit' && editNode) {
      return {
        deviceId: editNode.deviceId ?? '',
        name: editNode.name,
        location: editNode.location,
        parentId: editNode.parentId,
      };
    }
    return {
      deviceId: '',
      name: '',
      location: '',
      parentId: form?.parentId ?? null,
    };
  }, [form, editNode]);

  if (!nodesReady) {
    return (
      <div className="sfm-card p-8 text-center">
        <p className="text-sm" style={{ color: '#75777d' }}>Loading topology…</p>
      </div>
    );
  }

  if (nodeId && !detailNode) {
    return (
      <div className="sfm-card p-8 text-center animate-in fade-in duration-300">
        <p className="font-semibold mb-2" style={{ color: '#0d1c2d' }}>Node not found</p>
        <p className="text-sm mb-4" style={{ color: '#75777d' }}>
          No node with ID &quot;{nodeId}&quot; exists in the system.
        </p>
        <button
          type="button"
          onClick={() => navigate('/topology')}
          className="text-sm font-medium"
          style={{ color: '#00687a' }}
        >
          Back to Topology SFM
        </button>
      </div>
    );
  }

  if (detailNode) {
    return (
      <NodeDetailView
        node={detailNode}
        onBack={() => navigate('/topology')}
        onModeChange={handleModeChange}
        onValveChange={handleValveChange}
        onLimitSave={handleLimitSave}
        onScheduleSave={handleScheduleSave}
      />
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: '#75777d' }}>
          {pickingEdit
            ? 'Klik node di canvas untuk mengedit. Klik Edit device lagi untuk batal.'
            : canManage
              ? 'Unlock layout to drag nodes. Use Add / Edit device, or right-click the canvas.'
              : 'Unlock layout to rearrange nodes.'}
        </p>
        <div className="flex shrink-0 gap-2">
          {canManage && (
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-2 bg-white"
                style={{ borderColor: '#e2e8f0' }}
                onClick={handleToolbarAdd}
              >
                <Plus className="w-4 h-4" /> Add device
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                style={
                  pickingEdit
                    ? { background: '#57dffe', color: '#091426', border: 'none' }
                    : { borderColor: '#e2e8f0', background: '#ffffff' }
                }
                onClick={handleToolbarEdit}
              >
                <Pencil className="w-4 h-4" /> {pickingEdit ? 'Pilih node…' : 'Edit device'}
              </Button>
            </>
          )}
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button onClick={() => setShowConfirm(true)} className="gap-2 font-semibold" style={{ background: '#57dffe', color: '#091426', border: 'none' }}>
                <Save className="w-4 h-4" /> Save Layout
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} variant="outline" className="gap-2 bg-white" style={{ borderColor: '#e2e8f0' }}>
              <Unlock className="w-4 h-4" /> Unlock Layout
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[500px] border rounded-xl overflow-hidden bg-background relative flex" style={{ borderColor: pickingEdit ? '#00687a' : isEditing ? '#57dffe' : '#e2e8f0', borderWidth: pickingEdit || isEditing ? 2 : 1 }}>
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onPaneClick={closeOverlays}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={isEditing}
            nodesConnectable={false}
            attributionPosition="bottom-right"
            className="bg-muted/10"
          >
            <Background gap={16} size={1} color="#c5c6cd" />
            <Controls className="bg-background border shadow-sm" />
          </ReactFlow>
        </div>
      </div>

      {/* Node detail popup */}
      <Dialog open={!!selectedNode} onOpenChange={open => { if (!open) setSelectedNode(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedNode && (() => {
            const shown = applyLivePatch(
              liveNodesData.find((node) => node.id === selectedNode.id) ?? selectedNode,
              patches,
            );
            return (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Server className="w-4 h-4" style={{ color: '#00687a' }} />
                  {shown.name}
                </DialogTitle>
                <DialogDescription>{shown.location} · {shown.id}</DialogDescription>
              </DialogHeader>

              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={shown.status} since={shown.statusChangedAt} />
                <ValveBadge state={shown.valveState} />
                <ModeBadge mode={shown.mode} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Flowrate
                  </p>
                  <p className="text-lg font-semibold">
                    {shown.flowrate} <span className="text-sm font-normal text-muted-foreground">L/m</span>
                  </p>
                </div>
                <div className="space-y-1 bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Droplets className="w-3 h-3" /> Today
                  </p>
                  <p className="text-lg font-semibold">
                    {shown.todayUsage.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">L</span>
                  </p>
                </div>
                <div className="space-y-1 bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Droplets className="w-3 h-3" /> Monthly
                  </p>
                  <p className="text-lg font-semibold">
                    {shown.monthlyUsage.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">L</span>
                  </p>
                </div>
                <div className="space-y-1 bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Limit
                  </p>
                  <p className="text-lg font-semibold">
                    {shown.dailyLimit.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">L</span>
                  </p>
                </div>
                <div className="space-y-1 bg-muted/50 p-3 rounded-lg col-span-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Total Volume / Odometer
                  </p>
                  <p className="text-lg font-semibold">
                    {shown.odometer.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">L</span>
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelectedNode(null)}>Close</Button>
                <Button
                  style={{ background: '#57dffe', color: '#091426', border: 'none' }}
                  className="font-semibold"
                  onClick={() => {
                    navigate(`/topology/${shown.id}`);
                    setSelectedNode(null);
                  }}
                >
                  Detail Node
                </Button>
              </DialogFooter>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Topology Layout?</DialogTitle>
            <DialogDescription>
              This will save the current node positions as the new default for all users. Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={handleSave} className="font-semibold" style={{ background: '#57dffe', color: '#091426', border: 'none' }}>
              Confirm Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {menu && (
        <TopologyContextMenu
          menu={menu}
          canManage={canManage}
          onAdd={() => openCreateForm(null)}
          onAddChild={menuNode ? () => openCreateForm(menuNode.id) : undefined}
          onEdit={menuNode ? () => openEditForm(menuNode) : undefined}
          onDelete={menuNode ? () => { setMenu(null); setDeleteTarget(menuNode); } : undefined}
          onDeveloperMode={menuNode ? () => { setMenu(null); setDeveloperTarget(menuNode); } : undefined}
        />
      )}

      {form && (
        <NodeFormPanel
          open={!!form}
          mode={form.mode}
          nodes={nodesData}
          excludeId={form.editId}
          initial={formInitial}
          submitting={formBusy}
          onClose={() => setForm(null)}
          onSubmit={(values) => void handleFormSubmit(values)}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              Child nodes must be removed or reassigned first. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!developerTarget}
        onOpenChange={(open) => {
          if (!open && !developerBusy) setDeveloperTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Developer mode</DialogTitle>
            <DialogDescription>
              This will send a command to turn on the hybrid Access Point on{' '}
              {developerTarget?.name}
              {developerTarget?.deviceId ? ` (${developerTarget.deviceId})` : ''}. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={developerBusy}
              onClick={() => setDeveloperTarget(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={developerBusy}
              onClick={() => void handleDeveloperMode()}
              className="font-semibold"
              style={{ background: '#57dffe', color: '#091426', border: 'none' }}
            >
              {developerBusy ? 'Sending…' : 'Ya, nyalakan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
