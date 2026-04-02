import { ExtractorDriver } from './src/extractor/driver.js';
import { Serializer } from './src/extractor/serializer.js';
import { DEFAULT_CONFIG } from './src/config.js';
import path from 'path';

async function run() {
    const driver = new ExtractorDriver({ ...DEFAULT_CONFIG, viewport: "1000x1000" });
    const serializer = new Serializer({ depth: 10 });
    const url = `file://${path.resolve('tests/fixtures/test.html')}`;
    await driver.start();
    const raw = await driver.snapshot(url, {});
    await driver.stop();
    const snap = serializer.process(url, raw.domTree, raw.viewport, raw.console, raw.network);
    console.log(JSON.stringify(snap.tree, null, 2));
}
run();
