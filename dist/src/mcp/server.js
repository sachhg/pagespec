import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from '../config.js';
import { ExtractorDriver } from '../extractor/driver.js';
import { Serializer } from '../extractor/serializer.js';
import { DiffEngine } from '../diff/engine.js';
import fs from 'fs';
import path from 'path';
export async function startServer() {
    const server = new Server({ name: "pagespec-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });
    const config = loadConfig();
    // Basic Cache
    const snapshotCache = new Map();
    const CACHE_TTL = 2000;
    async function getSnapshot(url, depth = config.defaultDepth, focusSelector) {
        const now = Date.now();
        const cacheKey = `${url}::${focusSelector || ''}`;
        const cached = snapshotCache.get(cacheKey);
        if (cached && (now - cached.time) < CACHE_TTL) {
            return cached.data;
        }
        const driver = new ExtractorDriver(config);
        const serializer = new Serializer({ depth, focus: !!focusSelector });
        await driver.start();
        try {
            const raw = await driver.snapshot(url, { focus: focusSelector });
            const snap = serializer.process(url, raw.domTree, raw.viewport, raw.console, raw.network);
            snapshotCache.set(cacheKey, { time: Date.now(), data: snap });
            return snap;
        }
        finally {
            await driver.stop();
        }
    }
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "snapshot",
                    description: "Get a structured representation of the running web app's rendered state",
                    inputSchema: { type: "object", properties: { url: { type: "string" }, depth: { type: "number" }, focus: { type: "string" } }, required: ["url"] },
                },
                {
                    name: "diff",
                    description: "Get changes between a baseline and the current state",
                    inputSchema: { type: "object", properties: { url: { type: "string" }, baseline: { type: "string" }, focus: { type: "string" } }, required: ["url"] },
                },
                {
                    name: "warnings",
                    description: "Get actionable layout/accessibility warnings for the current state",
                    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
                },
                {
                    name: "baseline",
                    description: "Store a named baseline for future diffs",
                    inputSchema: { type: "object", properties: { url: { type: "string" }, baseline: { type: "string" } }, required: ["url", "baseline"] },
                }
            ]
        };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        switch (request.params.name) {
            case "snapshot": {
                const url = String(request.params.arguments?.url);
                const depth = Number(request.params.arguments?.depth || config.defaultDepth);
                const focus = request.params.arguments?.focus ? String(request.params.arguments?.focus) : undefined;
                const snap = await getSnapshot(url, depth, focus);
                return { content: [{ type: "text", text: JSON.stringify(snap, null, 2) }] };
            }
            case "warnings": {
                const url = String(request.params.arguments?.url);
                const snap = await getSnapshot(url);
                return { content: [{ type: "text", text: JSON.stringify(snap.summary.warnings, null, 2) }] };
            }
            case "baseline": {
                const url = String(request.params.arguments?.url);
                const baselineName = String(request.params.arguments?.baseline);
                const snap = await getSnapshot(url);
                const dir = path.join(process.cwd(), config.baselinesDir);
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, `${baselineName}.json`), JSON.stringify(snap, null, 2));
                return { content: [{ type: "text", text: `Saved baseline '${baselineName}'` }] };
            }
            case "diff": {
                const url = String(request.params.arguments?.url);
                const baselineName = String(request.params.arguments?.baseline || 'default');
                const focus = request.params.arguments?.focus ? String(request.params.arguments?.focus) : undefined;
                const baselinePath = path.join(process.cwd(), config.baselinesDir, `${baselineName}.json`);
                if (!fs.existsSync(baselinePath)) {
                    throw new Error(`Baseline '${baselineName}' not found`);
                }
                const baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
                const snap = await getSnapshot(url, config.defaultDepth, focus);
                const engine = new DiffEngine();
                const diffData = engine.diff(baselineData, snap);
                return { content: [{ type: "text", text: JSON.stringify(diffData, null, 2) }] };
            }
            default:
                throw new Error("Unknown tool");
        }
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("pagespec MCP server running on stdio");
}
