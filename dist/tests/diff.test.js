import { expect, test, describe } from 'vitest';
import { DiffEngine } from '../src/diff/engine.js';
describe('Diff Engine', () => {
    const mockSnap = (nodes, warnings = []) => ({
        url: 'http://localhost',
        timestamp: 'time',
        viewport: { width: 1000, height: 1000 },
        tree: [{
                id: 'root-0', role: 'main', label: '', tag: 'div', selector: 'div',
                bounds: { x: 0, y: 0, w: 100, h: 100 }, visible: true, state: { focused: false, disabled: false },
                styles: {},
                children: nodes
            }],
        summary: { totalNodes: 2, visibleNodes: 2, hiddenNodes: 0, interactiveNodes: 0, warnings, console: [], network: [] }
    });
    test('Identifies added, removed, and modified nodes cleanly', () => {
        const before = mockSnap([
            { id: 'btn-1', role: 'button', label: 'Old', tag: 'button', selector: '#btn', bounds: { w: 10, h: 10 }, visible: true, styles: { zIndex: 1 }, children: [] },
            { id: 'btn-2', role: 'button', label: 'Deleted', tag: 'button', selector: '#del', bounds: { w: 10, h: 10 }, visible: true, styles: {}, children: [] }
        ]);
        const after = mockSnap([
            { id: 'btn-1', role: 'button', label: 'Old', tag: 'button', selector: '#btn', bounds: { w: 10, h: 10 }, visible: false, styles: { zIndex: 5 }, children: [] },
            { id: 'btn-3', role: 'button', label: 'New', tag: 'button', selector: '#new', bounds: { w: 10, h: 10 }, visible: true, styles: {}, children: [] }
        ]);
        const engine = new DiffEngine();
        const diff = engine.diff(before, after);
        expect(diff.added.length).toBe(1);
        expect(diff.added[0].id).toBe('btn-3');
        expect(diff.removed.length).toBe(1);
        expect(diff.removed[0].id).toBe('btn-2');
        expect(diff.modified.length).toBe(1);
        expect(diff.modified[0].id).toBe('btn-1');
        expect(diff.modified[0].changes).toEqual({
            "visible": { before: true, after: false },
            "styles.zIndex": { before: 1, after: 5 }
        });
    });
});
