import { encode } from 'gpt-tokenizer';
export class Serializer {
    options;
    constructor(options) {
        this.options = options;
    }
    process(url, rawTree, viewport, consoleLogs = [], networkRequests = []) {
        let tree = this.normalize(rawTree);
        tree = this.pruneNoise(tree);
        tree = this.collapseHidden(tree);
        let warnings = [];
        this.collectWarnings(tree, warnings);
        let actualDepth = this.options.depth;
        let tokens = 0;
        // Depth limiting and tokenizer token target
        let finalTree = tree;
        if (this.options.tokens && this.options.tokens > 0) {
            finalTree = this.limitDepth(tree, actualDepth);
            let currentTokens = this.estimateTokens(finalTree);
            while (currentTokens > this.options.tokens && actualDepth > 1) {
                actualDepth--;
                finalTree = this.limitDepth(tree, actualDepth);
                currentTokens = this.estimateTokens(finalTree);
            }
            tokens = currentTokens;
        }
        else {
            finalTree = this.limitDepth(tree, actualDepth);
            tokens = this.estimateTokens(finalTree);
        }
        const summary = this.computeSummary(finalTree, warnings, consoleLogs, networkRequests);
        let isolatedHtml = undefined;
        if (this.options.focus) {
            isolatedHtml = this.generateIsolatedHtml(finalTree);
        }
        return {
            url,
            timestamp: new Date().toISOString(),
            viewport,
            tree: [finalTree],
            isolatedHtml,
            summary,
            metadata: {
                truncated: actualDepth < this.options.depth,
                actualDepth,
                tokens
            }
        };
    }
    normalize(node) {
        return node;
    }
    pruneNoise(node) {
        node.children = node.children
            .map(child => this.pruneNoise(child))
            .filter(child => child != null);
        return node;
    }
    collapseHidden(node) {
        if (!node.visible) {
            const count = this.countNodes(node) - 1;
            node.children = [];
            if (count > 0) {
                node.hiddenCount = count;
            }
        }
        else {
            node.children = node.children.map(child => this.collapseHidden(child));
        }
        return node;
    }
    limitDepth(node, currentDepth) {
        if (currentDepth <= 0) {
            const copy = { ...node, children: [] };
            const count = this.countNodes(node) - 1;
            if (count > 0)
                copy.hiddenCount = count;
            return copy;
        }
        const copy = { ...node };
        copy.children = copy.children.map(child => this.limitDepth(child, currentDepth - 1));
        return copy;
    }
    countNodes(node) {
        return 1 + node.children.reduce((acc, c) => acc + this.countNodes(c), 0);
    }
    collectWarnings(node, warnings) {
        if (['button', 'link', 'textbox', 'checkbox', 'radio'].includes(node.role) && !node.label) {
            warnings.push({
                type: "missing-label",
                selector: node.selector,
                detail: `Element has role '${node.role}' but no accessible name. It will be unreadable to screen readers and agents.`
            });
        }
        if (!node.visible && node.styles?.pointerEvents !== 'none' && ['button', 'link', 'textbox'].includes(node.role)) {
            warnings.push({
                type: "hidden-interactive",
                selector: node.selector,
                detail: `Element is interactive but not visually accessible.`
            });
        }
        if ((node.bounds.w === 0 || node.bounds.h === 0) && node.role !== 'generic' && node.role !== 'none') {
            warnings.push({
                type: "zero-size",
                selector: node.selector,
                detail: `Element is in the accessibility tree but has zero dimensions.`
            });
        }
        if (node.styles?.overflow === 'hidden' && node.children.some(c => c.bounds.w > node.bounds.w || c.bounds.h > node.bounds.h)) {
            warnings.push({
                type: "overflow-clipped",
                selector: node.selector,
                detail: `Element specifies overflow: hidden and has children exceeding its bounds.`
            });
        }
        for (const child of node.children) {
            this.collectWarnings(child, warnings);
        }
    }
    computeSummary(tree, warnings, consoleLogs, networkRequests) {
        let total = 0, visible = 0, hidden = 0, interactive = 0;
        const count = (node) => {
            total++;
            if (node.visible)
                visible++;
            if (!node.visible)
                hidden++;
            if (['button', 'link', 'textbox', 'checkbox', 'radio'].includes(node.role))
                interactive++;
            node.children.forEach(count);
            if (node.hiddenCount) {
                total += node.hiddenCount;
                hidden += node.hiddenCount;
            }
        };
        count(tree);
        return {
            totalNodes: total,
            visibleNodes: visible,
            hiddenNodes: hidden,
            interactiveNodes: interactive,
            warnings,
            console: consoleLogs,
            network: networkRequests
        };
    }
    estimateTokens(tree) {
        const text = JSON.stringify(tree);
        return encode(text).length;
    }
    generateIsolatedHtml(node) {
        const tag = node.tag || 'div';
        let styleStr = '';
        if (node.styles) {
            styleStr = Object.entries(node.styles)
                .filter(([_, value]) => value !== '' && value !== undefined)
                .map(([key, value]) => {
                const kebab = key.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
                return `${kebab}: ${value};`;
            }).join(' ');
        }
        const attrs = [];
        if (node.id && !node.id.startsWith('generic-') && !node.id.startsWith('region-')) {
            attrs.push(`id="${node.id}"`);
        }
        else if (node.selector && node.selector.startsWith('#')) {
            attrs.push(`id="${node.selector.slice(1)}"`);
        }
        if (styleStr)
            attrs.push(`style="${styleStr}"`);
        const attrString = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
        let childrenHtml = '';
        if (node.children && node.children.length > 0) {
            childrenHtml = node.children.map(c => this.generateIsolatedHtml(c)).join('');
        }
        else if (node.label) {
            childrenHtml = node.label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
        return `<${tag}${attrString}>${childrenHtml}</${tag}>`;
    }
}
