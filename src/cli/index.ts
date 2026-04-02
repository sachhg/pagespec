#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from '../config.js';
import { ExtractorDriver } from '../extractor/driver.js';
import { Serializer } from '../extractor/serializer.js';
import { DiffEngine } from '../diff/engine.js';
import { formatOutput } from './format.js';
import fs from 'fs';
import path from 'path';

// Import the specific command functions
import { startServer } from '../mcp/server.js';
import { startWatch } from './watch.js';

const program = new Command();
program.name('pagespec').description('Headless CLI tool to extract structured web app rendered state');

program.command('snapshot <url>')
  .option('--format <format>', 'json | yaml | compact')
  .option('--depth <depth>', 'max tree depth')
  .option('--focus <selector>', 'CSS selector - only subtree under this element')
  .option('--state <state>', 'stable | hover | focus')
  .option('--visual', 'also write screenshot.png')
  .option('--tokens <count>', 'target max token count')
  .option('--out <file>', 'output file path')
  .action(async (url, options) => {
    const config = loadConfig();
    const depth = options.depth ? parseInt(options.depth) : config.defaultDepth;
    const format = options.format || config.defaultFormat;
    
    const driver = new ExtractorDriver(config);
    const serializer = new Serializer({ depth, tokens: options.tokens ? parseInt(options.tokens) : undefined });

    try {
      await driver.start();
      const raw = await driver.snapshot(url, options);
      const pageSnap = serializer.process(url, raw.domTree, raw.viewport, raw.console, raw.network);
      
      const outStr = formatOutput(pageSnap, format);
      if (options.out) {
        fs.writeFileSync(options.out, outStr);
      } else {
        console.log(outStr);
      }
    } finally {
      await driver.stop();
    }
  });

program.command('diff <url>')
  .option('--format <format>', 'json | yaml | compact')
  .option('--baseline <name>', 'name of the baseline to diff against', 'default')
  .option('--focus <selector>', 'CSS selector focusing the subtree')
  .option('--tokens <count>', 'target max token count')
  .option('--out <file>', 'output file path')
  .action(async (url, options) => {
    const config = loadConfig();
    const depth = config.defaultDepth;
    const format = options.format || config.defaultFormat;
    
    const driver = new ExtractorDriver(config);
    const serializer = new Serializer({ depth, tokens: options.tokens ? parseInt(options.tokens) : undefined });
    const diffEngine = new DiffEngine();

    const baselinePath = path.join(process.cwd(), config.baselinesDir, `${options.baseline}.json`);
    
    let baselineData;
    if (!fs.existsSync(baselinePath)) {
      console.warn(`[WARNING] Baseline '${options.baseline}' not found at ${baselinePath}, printing full snapshot instead.`);
    } else {
      baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
    }

    try {
      await driver.start();
      const raw = await driver.snapshot(url, options);
      const afterSnap = serializer.process(url, raw.domTree, raw.viewport, raw.console, raw.network);
      
      let outStr;
      if (baselineData) {
        const diffResult = diffEngine.diff(baselineData, afterSnap);
        outStr = formatOutput(diffResult, format);
      } else {
        outStr = formatOutput(afterSnap, format);
      }
      
      if (options.out) {
        fs.writeFileSync(options.out, outStr);
      } else {
        console.log(outStr);
      }
    } finally {
      await driver.stop();
    }
  });

program.command('watch <url>')
  .option('--on-change <glob>', 'Files to watch on')
  .action(async (url, options) => {
    await startWatch(url, options);
  });

program.command('serve')
  .action(async () => {
    await startServer();
  });

program.parse(process.argv);
