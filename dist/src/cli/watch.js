import chokidar from 'chokidar';
import { loadConfig } from '../config.js';
import { ExtractorDriver } from '../extractor/driver.js';
import { Serializer } from '../extractor/serializer.js';
import { DiffEngine } from '../diff/engine.js';
import { formatOutput } from './format.js';
export async function startWatch(url, options) {
    const config = loadConfig();
    const depth = options.depth ? parseInt(options.depth) : config.defaultDepth;
    const format = options.format || config.defaultFormat;
    const driver = new ExtractorDriver(config);
    const serializer = new Serializer({ depth, tokens: options.tokens ? parseInt(options.tokens) : undefined });
    const diffEngine = new DiffEngine();
    let previousSnapshot = null;
    let isProcessing = false;
    async function processChange(triggerFile) {
        if (isProcessing)
            return;
        isProcessing = true;
        try {
            if (triggerFile) {
                console.log(`\nDetected change in ${triggerFile}, capturing snapshot...`);
            }
            else {
                console.log(`Capturing initial baseline snapshot of ${url}...`);
            }
            const raw = await driver.snapshot(url, {});
            const currentSnapshot = serializer.process(url, raw.domTree, raw.viewport, raw.console, raw.network);
            if (previousSnapshot) {
                const diffResult = diffEngine.diff(previousSnapshot, currentSnapshot);
                console.log(formatOutput(diffResult, format));
            }
            else {
                console.log(`Initial snapshot captured. Listening for file changes...`);
            }
            previousSnapshot = currentSnapshot;
        }
        catch (err) {
            console.error("Failed to capture snapshot:", err);
        }
        finally {
            isProcessing = false;
        }
    }
    try {
        await driver.start();
        // Initial process
        await processChange();
        const globPattern = options.onChange || '**/*.{html,css,js,ts,tsx,jsx}';
        console.log(`Watching (${globPattern}) for changes...\n`);
        const watcher = chokidar.watch(globPattern, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100
            }
        });
        watcher.on('change', (path) => {
            processChange(path);
        });
        // Handle clean exit
        process.on('SIGINT', async () => {
            console.log("\nShutting down watcher...");
            await watcher.close();
            await driver.stop();
            process.exit(0);
        });
    }
    catch (e) {
        console.error("Error starting watch mode:", e);
        await driver.stop();
        process.exit(1);
    }
}
