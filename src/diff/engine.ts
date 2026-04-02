import { ComponentNode, PageSnapshot, SnapshotWarning } from '../types.js';

export interface SnapshotDiff {
  added: ComponentNode[];
  removed: ComponentNode[];
  modified: Array<{
    id: string;
    selector: string;
    changes: Record<string, { before: any, after: any }>;
  }>;
  warnings: {
    added: SnapshotWarning[];
    resolved: SnapshotWarning[];
  };
}

export class DiffEngine {
  diff(before: PageSnapshot, after: PageSnapshot): SnapshotDiff {
    const beforeNodes = this.flatten(before.tree[0]);
    const afterNodes = this.flatten(after.tree[0]);

    const added: ComponentNode[] = [];
    const removed: ComponentNode[] = [];
    const modified: SnapshotDiff['modified'] = [];

    // Diff Nodes
    for (const [id, a] of afterNodes.entries()) {
      const b = beforeNodes.get(id);
      if (!b) {
        added.push(a);
      } else {
        const changes = this.diffObject(b, a);
        if (Object.keys(changes).length > 0) {
          modified.push({
            id,
            selector: a.selector,
            changes
          });
        }
      }
    }

    for (const [id, b] of beforeNodes.entries()) {
      if (!afterNodes.has(id)) {
        removed.push(b);
      }
    }

    // Diff Warnings
    const warnAdded = after.summary.warnings.filter(aw => 
      !before.summary.warnings.some(bw => bw.type === aw.type && bw.selector === aw.selector)
    );
    const warnResolved = before.summary.warnings.filter(bw => 
      !after.summary.warnings.some(aw => aw.type === bw.type && aw.selector === bw.selector)
    );

    return {
      added,
      removed,
      modified,
      warnings: {
        added: warnAdded,
        resolved: warnResolved
      }
    };
  }

  private flatten(node: ComponentNode, map = new Map<string, ComponentNode>()): Map<string, ComponentNode> {
    if (!node) return map;
    // Store a shallow copy without children for clean diffing
    const { children, ...rest } = node;
    map.set(node.id, rest as ComponentNode);
    for (const child of node.children) {
      this.flatten(child, map);
    }
    return map;
  }

  private diffObject(before: any, after: any, prefix = ''): Record<string, {before: any, after: any}> {
    const changes: Record<string, {before: any, after: any}> = {};
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    for (const k of keys) {
      const bProp = before ? before[k] : undefined;
      const aProp = after ? after[k] : undefined;
      const fullPath = prefix ? `${prefix}.${k}` : k;

      if (typeof bProp === 'object' && typeof aProp === 'object' && bProp !== null && aProp !== null) {
        if (!Array.isArray(bProp)) {
          const subChanges = this.diffObject(bProp, aProp, fullPath);
          Object.assign(changes, subChanges);
        } else if (JSON.stringify(bProp) !== JSON.stringify(aProp)) {
           changes[fullPath] = { before: bProp, after: aProp };
        }
      } else if (bProp !== aProp) {
        changes[fullPath] = { before: bProp, after: aProp };
      }
    }

    return changes;
  }
}
