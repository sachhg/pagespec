import { encode } from 'gpt-tokenizer';
import { ComponentNode, PageSnapshot, SnapshotSummary, SnapshotWarning } from '../types.js';

export class Serializer {
  constructor(private options: { depth: number, tokens?: number }) {}

  process(url: string, rawTree: any, viewport: { width: number, height: number }, consoleLogs: import('../types.js').ConsoleLog[] = [], networkRequests: import('../types.js').NetworkRequest[] = []): PageSnapshot {
    let tree = this.normalize(rawTree);
    tree = this.pruneNoise(tree);
    tree = this.collapseHidden(tree);

    let warnings: SnapshotWarning[] = [];
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
    } else {
      finalTree = this.limitDepth(tree, actualDepth);
      tokens = this.estimateTokens(finalTree);
    }

    const summary = this.computeSummary(finalTree, warnings, consoleLogs, networkRequests);

    return {
      url,
      timestamp: new Date().toISOString(),
      viewport,
      tree: [finalTree],
      summary,
      metadata: {
        truncated: actualDepth < this.options.depth,
        actualDepth,
        tokens
      }
    };
  }

  private normalize(node: any): ComponentNode {
     return node as ComponentNode;
  }

  private pruneNoise(node: ComponentNode): ComponentNode {
     node.children = node.children
        .map(child => this.pruneNoise(child))
        .filter(child => child != null);
     return node;
  }

  private collapseHidden(node: ComponentNode): ComponentNode {
    if (!node.visible) {
      const count = this.countNodes(node) - 1;
      node.children = [];
      if (count > 0) {
         node.hiddenCount = count;
      }
    } else {
      node.children = node.children.map(child => this.collapseHidden(child));
    }
    return node;
  }

  private limitDepth(node: ComponentNode, currentDepth: number): ComponentNode {
    if (currentDepth <= 0) {
      const copy = { ...node, children: [] };
      const count = this.countNodes(node) - 1;
      if (count > 0) copy.hiddenCount = count;
      return copy;
    }
    const copy = { ...node };
    copy.children = copy.children.map(child => this.limitDepth(child, currentDepth - 1));
    return copy;
  }

  private countNodes(node: ComponentNode): number {
    return 1 + node.children.reduce((acc, c) => acc + this.countNodes(c), 0);
  }

  private collectWarnings(node: ComponentNode, warnings: SnapshotWarning[]) {
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

  private computeSummary(tree: ComponentNode, warnings: SnapshotWarning[], consoleLogs: import('../types.js').ConsoleLog[], networkRequests: import('../types.js').NetworkRequest[]): SnapshotSummary {
    let total = 0, visible = 0, hidden = 0, interactive = 0;
    
    const count = (node: ComponentNode) => {
       total++;
       if (node.visible) visible++;
       if (!node.visible) hidden++;
       if (['button', 'link', 'textbox', 'checkbox', 'radio'].includes(node.role)) interactive++;
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

  private estimateTokens(tree: ComponentNode): number {
    const text = JSON.stringify(tree);
    return encode(text).length;
  }
}
