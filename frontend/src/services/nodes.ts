import type { SFMNode } from '@/types';
import { fetchApiNodes, mapApiNode } from '@/services/nodesApi';

export async function getNodes(): Promise<SFMNode[]> {
  const data = await fetchApiNodes();
  return data.nodes.map(mapApiNode);
}
