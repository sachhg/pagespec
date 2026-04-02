import { expect, test, describe } from 'vitest';
import { ExtractorDriver } from '../src/extractor/driver.js';
import { Serializer } from '../src/extractor/serializer.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import path from 'path';
describe('Extraction Pipeline', () => {
    test('Extracts simple DOM tree and warnings', async () => {
        const driver = new ExtractorDriver({ ...DEFAULT_CONFIG, viewport: "1000x1000" });
        const serializer = new Serializer({ depth: 6 });
        const url = `file://${path.resolve(__dirname, 'fixtures/test.html')}`;
        await driver.start();
        const raw = await driver.snapshot(url, {});
        await driver.stop();
        const snap = serializer.process(url, raw.domTree, raw.viewport, raw.console, raw.network);
        // Assertions
        expect(snap.tree.length).toBe(1);
        const body = snap.tree[0];
        expect(body.tag).toBe('body');
        // Assert ID generation for child buttons (nth-of-role-under-nearest-named-ancestor)
        const parentSection = body.children.find(c => c.tag === 'section');
        expect(parentSection).toBeDefined();
        const btn1 = parentSection.children[0];
        const btn2 = parentSection.children[1];
        // Expected ID: 'button-childbtn1-aria-test-ances-0'
        expect(btn1.id).toContain('test-ances');
        expect(btn1.id).toContain('-0');
        expect(btn2.id).toContain('-1');
        // Check new event properties
        expect(btn1.events).toContain('click');
        expect(btn1.events).toContain('mouseenter');
        // Check warnings
        const warnings = snap.summary.warnings;
        const hasHiddenInteractive = warnings.some(w => w.type === 'hidden-interactive' && w.selector.includes('#btn1'));
        expect(hasHiddenInteractive).toBe(true);
        const hasMissingLabel = warnings.some(w => w.type === 'missing-label' && w.selector.includes('#link1'));
        expect(hasMissingLabel).toBe(true);
        const hasZeroSize = warnings.some(w => w.type === 'zero-size' && w.selector.includes('#zero'));
        expect(hasZeroSize).toBe(true);
        const hasOverflow = warnings.some(w => w.type === 'overflow-clipped' && w.selector.includes('#overflow'));
        expect(hasOverflow).toBe(true);
        // Check Occlusion
        const testContainer = body.children.find(c => c.tag === 'div' && c.children && c.children.find(ch => ch.selector === '#obscured-btn'));
        expect(testContainer).toBeDefined();
        const obscuredBtn = testContainer.children.find(c => c.selector === '#obscured-btn');
        expect(obscuredBtn).toBeDefined();
        expect(obscuredBtn.isObscured).toBe(true);
        expect(obscuredBtn.obscuredBy).toBe('#blocker');
        // Check console array
        expect(snap.summary.console.length).toBeGreaterThan(0);
        expect(snap.summary.console.some(c => c.text.includes('Test console error'))).toBe(true);
        // Check summary counts
        expect(snap.summary.interactiveNodes).toBeGreaterThanOrEqual(5);
    });
    test('Isolated component extraction (--focus)', async () => {
        const driver = new ExtractorDriver({ ...DEFAULT_CONFIG, viewport: "1000x1000" });
        const serializer = new Serializer({ depth: 6, focus: true });
        const url = `file://${path.resolve(__dirname, 'fixtures/test.html')}`;
        await driver.start();
        const raw = await driver.snapshot(url, { focus: "section[aria-label='test-ancestor']" });
        await driver.stop();
        const snap = serializer.process(url, raw.domTree, raw.viewport, raw.console, raw.network);
        // Assertions
        expect(snap.tree.length).toBe(1);
        const root = snap.tree[0];
        // It heavily clipped the tree, the root is now exclusively the section
        expect(root.tag).toBe('section');
        expect(root.children.length).toBe(2);
        expect(root.children[0].tag).toBe('button');
        // Ensure isolatedHtml was successfully built into the JSON
        expect(snap.isolatedHtml).toBeDefined();
        expect(snap.isolatedHtml).toContain('<section');
        expect(snap.isolatedHtml).toContain('childbtn1</button>');
        expect(snap.isolatedHtml).toContain('style="');
    });
});
