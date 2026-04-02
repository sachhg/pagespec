# Pagespec

Pagespec is a headless command line utility and Model Context Protocol server. It extracts structural, visual, and layout states from web applications to provide autonomous coding agents with a feedback loop for what actually rendered on the Document Object Model. 

## The Core Problem
Current agentic coding assistants operate blindly. They lack intrinsic visual feedback loops when editing UI code. When an agent modifies a React component or writes styling rules, it cannot independently verify if the resulting changes look correct. It might unknowingly introduce an accessibility error or block a button. Pagespec fixes this gap. The software acts as a synthetic eye for your agent.

## How It Works
Pagespec spins up a headless Chromium instance using Playwright. It bypasses conventional DOM parsing by directly injecting a client side object walker into the active page context. This custom script runs against the live DOM after all rendering finishes. 

The tool captures several vital full stack metrics:
* Component Bounds: The precise X, Y, Width, and Height coordinate geometry of elements.
* Computed Styles: Live CSS values including opacity and zIndex to identify invisible elements.
* Event Interception: Hooking into EventTarget prototype methods to catalog attached listeners like clicks and hovers.
* Target Occlusion: Firing simulated interaction events to map elements that are structurally present but visually blocked by layering issues.
* Network and Console Output: Capturing asynchronous request failures and error logs natively.

The output is processed through a serialization engine to collapse empty formatting wrappers and produce an optimized JSON tree tailored to fit strictly within language model token limits.

## Installation and Testing
You can run the repository locally or link it for global system usage.

1. Install dependencies using your package manager.
```bash
npm install
```

2. Compile the typescript code.
```bash
npx tsc
```

3. Make the executable available globally.
```bash
npm link
```

To execute the test suite to verify the extraction and occlusion logic:
```bash
npx vitest run
```

## Usage Instructions

### Command Line Interface
The CLI interfaces perfectly for manual intervention or custom scripted workflows.

**Taking a Snapshot**
Generate a full structural tree of any target page. This output trims unnecessary wrapper nodes and highlights actionable layout warnings.

```bash
pagespec snapshot http://localhost:3000 --format json
```

You can target specific visual sectors or cap the total tokenizer count using optional CLI flags. Run `pagespec snapshot --help` for all arguments.

**Calculating Diffs**
Compare your live application against a stored JSON snapshot baseline. The diff engine utilizes graph logic to return exclusively the nodes that were modified, added, or removed.

```bash
pagespec diff http://localhost:3000 --baseline default
```

**Live Development Watcher**
Create an interactive live reloading session. Pagespec utilizes Chokidar to observe your source code file paths locally. When a file is modified in your text editor, the tool recalculates the visual diff automatically and prints the output to your terminal.

```bash
pagespec watch http://localhost:3000 --on-change "**/*.tsx"
```

### Model Context Protocol Server
Configuration for autonomous agents involves utilizing the MCP server feature. Programs like Claude Desktop or Cursor can connect locally to request precise visual feedback queries on demand without human supervision.

Start the server using standard input and output streams:
```bash
pagespec serve
```

Agents gain native capabilities to use the snapshot, diff, warning, and baseline tools directly. This workflow unlocks fully autonomous UI debugging for modern client frameworks.
