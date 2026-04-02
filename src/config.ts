import fs from 'fs';
import path from 'path';
import { PageSpecConfig } from './types.js';

export const DEFAULT_CONFIG: PageSpecConfig = {
  viewport: "1440x900",
  defaultFormat: "json",
  defaultDepth: 6,
  waitFor: "networkidle",
  ignoredSelectors: ["#analytics-pixel", "[data-testid='loading-spinner']", "script", "style", "noscript", "meta", "link"],
  styleFields: [
    "display", "visibility", "opacity", "position", "zIndex", 
    "overflow", "width", "height", "color", "backgroundColor", 
    "fontSize", "fontWeight", "transform", "pointerEvents", "clipPath"
  ],
  mcpPort: 3789,
  baselinesDir: "./.pagespec/baselines"
};

export function loadConfig(cwd: string = process.cwd()): PageSpecConfig {
  const localConfigPath = path.join(cwd, '.pagespec.json');
  const globalConfigPath = path.join(process.env.HOME || '', '.pagespec', 'config.json');

  let config = { ...DEFAULT_CONFIG };

  if (fs.existsSync(globalConfigPath)) {
    try {
      const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8'));
      config = { ...config, ...globalConfig };
    } catch(e) {}
  }

  if (fs.existsSync(localConfigPath)) {
    try {
      const localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf-8'));
      config = { ...config, ...localConfig };
    } catch(e) {}
  }

  return config;
}
