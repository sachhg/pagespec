export interface PageSnapshot {
  url: string;
  timestamp: string;
  viewport: { width: number; height: number };
  tree: ComponentNode[];
  summary: SnapshotSummary;
  metadata?: {
    truncated: boolean;
    actualDepth: number;
    tokens: number;
  };
}

export interface ConsoleLog {
  type: string;
  text: string;
  location?: string;
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  error?: string;
}

export interface ComponentNode {
  id: string;                    // stable: computed from role+label+position
  role: string;                  // ARIA role (button, heading, listitem, etc.)
  label: string;                 // accessible name
  tag: string;                   // HTML tag
  selector: string;              // shortest unambiguous CSS selector
  bounds: { x: number; y: number; w: number; h: number };
  visible: boolean;
  isObscured?: boolean;          // true if elementFromPoint hits something else
  obscuredBy?: string;           // CSS selector of the obscuring element
  events?: string[];             // captured event listener types
  state: {
    focused: boolean;
    disabled: boolean;
    expanded?: boolean;
    checked?: boolean;
    value?: string;
  };
  styles: {
    display?: string;
    position?: string;
    zIndex?: number | "auto";
    opacity?: number;
    overflow?: string;
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    visibility?: string;
    width?: string;
    height?: string;
    fontWeight?: string;
    transform?: string;
    pointerEvents?: string;
    clipPath?: string;
    [key: string]: any;
  };
  children: ComponentNode[];
  hiddenCount?: number;           // If a subtree is hidden, it is collapsed here
}

export interface SnapshotSummary {
  totalNodes: number;
  visibleNodes: number;
  hiddenNodes: number;
  interactiveNodes: number;
  warnings: SnapshotWarning[];
  console: ConsoleLog[];
  network: NetworkRequest[];
}

export interface SnapshotWarning {
  type: "hidden-interactive" | "zero-size" | "missing-label" | "z-collision" | "overflow-clipped";
  selector: string;
  detail: string;
}

export interface PageSpecConfig {
  baseUrl?: string;
  viewport: string;
  defaultFormat: "json" | "yaml" | "compact";
  defaultDepth: number;
  cookies?: string;
  waitFor: string;
  ignoredSelectors: string[];
  styleFields: string[];
  mcpPort: number;
  baselinesDir: string;
}
