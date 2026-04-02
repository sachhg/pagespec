import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { extractDomTreeScript } from './evaluate.js';
export class ExtractorDriver {
    config;
    browser = null;
    context = null;
    page = null;
    constructor(config) {
        this.config = config;
    }
    async start() {
        this.browser = await chromium.launch({ headless: true });
        this.context = await this.browser.newContext({
            viewport: this.parseViewport(this.config.viewport)
        });
        if (this.config.cookies) {
            const cookiePath = path.resolve(this.config.cookies);
            if (fs.existsSync(cookiePath)) {
                const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
                await this.context.addCookies(cookies);
            }
        }
        this.page = await this.context.newPage();
        await this.page.addInitScript(() => {
            window._pagespec_events = new WeakMap();
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function (type, listener, options) {
                if (!window._pagespec_events.has(this)) {
                    window._pagespec_events.set(this, new Set());
                }
                window._pagespec_events.get(this).add(type);
                return originalAddEventListener.call(this, type, listener, options);
            };
        });
    }
    async stop() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
        }
    }
    parseViewport(vp) {
        const [width, height] = vp.split('x').map(Number);
        return { width: width || 1440, height: height || 900 };
    }
    async snapshot(url, options = {}) {
        if (!this.page)
            throw new Error("Driver not started");
        const capturedLogs = [];
        const capturedNetwork = [];
        const onConsole = (msg) => {
            capturedLogs.push({ type: msg.type(), text: msg.text(), location: msg.location().url });
        };
        const onPageError = (err) => {
            capturedLogs.push({ type: 'pageerror', text: err.stack || err.message || String(err) });
        };
        const onResponse = (res) => {
            const req = res.request();
            if (req.resourceType() === 'fetch' || req.resourceType() === 'xhr' || !res.ok()) {
                capturedNetwork.push({ url: res.url(), method: req.method(), status: res.status() });
            }
        };
        const onRequestFailed = (req) => {
            if (req.resourceType() === 'fetch' || req.resourceType() === 'xhr' || req.resourceType() === 'document') {
                capturedNetwork.push({ url: req.url(), method: req.method(), status: 0, error: req.failure()?.errorText });
            }
        };
        this.page.on('console', onConsole);
        this.page.on('pageerror', onPageError);
        this.page.on('response', onResponse);
        this.page.on('requestfailed', onRequestFailed);
        try {
            await this.page.goto(url, { waitUntil: this.config.waitFor === 'networkidle' ? 'networkidle' : 'load' });
            if (this.config.waitFor && this.config.waitFor !== 'networkidle' && this.config.waitFor !== 'load') {
                await this.page.waitForSelector(this.config.waitFor);
            }
            if (options.focus) {
                // Optional: wait for focus element
                await this.page.waitForSelector(options.focus, { state: 'visible' }).catch(() => { });
            }
            if (options.state) {
                // simulate states like hover, focus
                // this is simplified; we'll assume state is a CSS selector to hover/focus
                if (options.state === 'hover' && options.focus) {
                    await this.page.hover(options.focus).catch(() => { });
                }
                else if (options.state === 'focus' && options.focus) {
                    await this.page.focus(options.focus).catch(() => { });
                }
            }
            // Channel A: Accessibility tree via CDP or DOM (we use DOM via Channel B instead, as Playwright dropped direct a11yTree access)
            const a11yTree = null;
            const domTree = await this.page.evaluate(`
      (function() {
        const config = ${JSON.stringify({
                styleFields: this.config.styleFields,
                ignoredSelectors: this.config.ignoredSelectors
            })};
        ${extractDomTreeScript}
      })();
    `);
            // Channel C: Visual snapshot
            if (options.visual) {
                await this.page.screenshot({ path: 'screenshot.png', fullPage: true });
            }
            return {
                a11yTree,
                domTree,
                viewport: this.page.viewportSize() || { width: 0, height: 0 },
                console: capturedLogs,
                network: capturedNetwork
            };
        }
        finally {
            this.page.off('console', onConsole);
            this.page.off('pageerror', onPageError);
            this.page.off('response', onResponse);
            this.page.off('requestfailed', onRequestFailed);
        }
    }
}
