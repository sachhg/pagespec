export class DiffEngine {
    diff(before, after) {
        const beforeNodes = this.flatten(before.tree[0]);
        const afterNodes = this.flatten(after.tree[0]);
        const added = [];
        const removed = [];
        const modified = [];
        // Diff Nodes
        for (const [id, a] of afterNodes.entries()) {
            const b = beforeNodes.get(id);
            if (!b) {
                added.push(a);
            }
            else {
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
        const warnAdded = after.summary.warnings.filter(aw => !before.summary.warnings.some(bw => bw.type === aw.type && bw.selector === aw.selector));
        const warnResolved = before.summary.warnings.filter(bw => !after.summary.warnings.some(aw => aw.type === bw.type && aw.selector === bw.selector));
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
    flatten(node, map = new Map()) {
        if (!node)
            return map;
        // Store a shallow copy without children for clean diffing
        const { children, ...rest } = node;
        map.set(node.id, rest);
        for (const child of node.children) {
            this.flatten(child, map);
        }
        return map;
    }
    diffObject(before, after, prefix = '') {
        const changes = {};
        const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
        for (const k of keys) {
            const bProp = before ? before[k] : undefined;
            const aProp = after ? after[k] : undefined;
            const fullPath = prefix ? `${prefix}.${k}` : k;
            if (typeof bProp === 'object' && typeof aProp === 'object' && bProp !== null && aProp !== null) {
                if (!Array.isArray(bProp)) {
                    const subChanges = this.diffObject(bProp, aProp, fullPath);
                    Object.assign(changes, subChanges);
                }
                else if (JSON.stringify(bProp) !== JSON.stringify(aProp)) {
                    changes[fullPath] = { before: bProp, after: aProp };
                }
            }
            else if (bProp !== aProp) {
                changes[fullPath] = { before: bProp, after: aProp };
            }
        }
        return changes;
    }
}
