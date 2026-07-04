import { getTemplateComponentNameFromTagName } from "./alpineTemplateComponents.js";

const loaded = new Set();

export function getLoadedComponents() {
    return [...loaded];
}

function generateScopeId() {
    return "v-" + Math.random().toString(36).slice(2, 10);
}

function extractTags(html) {
    const styles = [];
    const scripts = [];
    let body = html;

    body = body.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (match, attrs, css) => {
        const isGlobal = /\bglobal\b/i.test(attrs);
        styles.push({ global: isGlobal, css: css.trim() });
        return "";
    });

    body = body.replace(/<script[\s\S]*?<\/script>/gi, (match) => {
        scripts.push(match);
        return "";
    });

    return { body, styles, scripts };
}

function addScopeToRoot(html, scopeAttr) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const root = doc.body.firstElementChild;
    if (root) root.setAttribute(scopeAttr, "");
    return doc.body.innerHTML;
}

function rewriteScopedCss(css, scopeAttr) {
    const scopeSel = `[${scopeAttr}]`;
    let result = "";
    let i = 0;

    while (i < css.length) {
        if (/\s/.test(css[i])) {
            result += css[i];
            i++;
            continue;
        }

        // comment
        if (css[i] === "/" && css[i + 1] === "*") {
            const end = css.indexOf("*/", i + 2);
            result += css.slice(i, end + 2);
            i = end + 2;
            continue;
        }

        // @-rule
        if (css[i] === "@") {
            const br = css.indexOf("{", i);
            if (br === -1) {
                result += css.slice(i);
                break;
            }
            result += css.slice(i, br + 1);
            i = br + 1;
            let depth = 1;
            const blkStart = i;
            while (depth > 0 && i < css.length) {
                if (css[i] === "{") depth++;
                else if (css[i] === "}") depth--;
                i++;
            }
            const inner = css.slice(blkStart, i - 1);
            const rName = css.slice(css.lastIndexOf("@", br), br).trim().split(/\s/)[0];
            if (["@media", "@supports", "@container", "@scope"].includes(rName)) {
                result += rewriteScopedCss(inner, scopeAttr);
            } else {
                result += inner;
            }
            result += "}";
            continue;
        }

        // regular rule
        const br = css.indexOf("{", i);
        if (br === -1) {
            result += css.slice(i);
            break;
        }
        const selRaw = css.slice(i, br);
        i = br + 1;
        let depth = 1;
        const blkStart = i;
        while (depth > 0 && i < css.length) {
            if (css[i] === "{") depth++;
            else if (css[i] === "}") depth--;
            i++;
        }
        const block = css.slice(blkStart, i - 1);

        const parts = selRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const scoped = parts.map((s) => {
            if (s.includes(scopeSel)) return s;
            if (/^:scope\b/.test(s)) return s.replace(/^:scope\b/, scopeSel);
            return scopeSel + " " + s;
        });

        result += scoped.join(", ") + " {" + block + "}";
    }

    return result;
}

function injectStyle(css) {
    const el = document.createElement("style");
    el.textContent = css;
    document.head.append(el);
}

function executeScript(raw) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = raw;
    const scriptTag = wrapper.querySelector("script");
    if (!scriptTag) return;
    const ns = document.createElement("script");
    if (scriptTag.src) ns.src = scriptTag.src;
    else ns.textContent = scriptTag.textContent;
    document.body.append(ns);
}

async function loadSingle(name) {
    if (loaded.has(name)) return;
    const res = await fetch(`./src/components/${name}.html`);
    if (!res.ok) throw new Error(`Failed to fetch template ${name}: ${res.status}`);
    const html = await res.text();

    const { body, styles, scripts } = extractTags(html);

    const scoped = styles.filter((s) => !s.global);
    const globalStyles = styles.filter((s) => s.global);

    const scopeId = scoped.length > 0 ? generateScopeId() : null;
    const scopeAttr = scopeId ? `data-v-${scopeId}` : null;

    const templateHtml = scopeAttr ? addScopeToRoot(body, scopeAttr) : body;

    const el = document.createElement("template");
    el.id = `template-${name}`;
    el.innerHTML = templateHtml;
    document.head.append(el);

    for (const s of globalStyles) {
        injectStyle(s.css);
    }

    for (const s of scoped) {
        injectStyle(rewriteScopedCss(s.css, scopeAttr));
    }

    for (const raw of scripts) {
        executeScript(raw);
    }

    loaded.add(name);
}

function scanHtmlForComponentNames(html) {
    const names = new Set();
    const tagPattern = /<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)(?:\s|\/|>)/gi;
    let match;
    while ((match = tagPattern.exec(html)) !== null) {
        const name = getTemplateComponentNameFromTagName(match[1]);
        if (name) names.add(name);
    }
    return names;
}

export async function loadTemplates() {
    const names = scanHtmlForComponentNames(document.body.innerHTML);
    const toLoad = [...names].filter((n) => !loaded.has(n));
    if (toLoad.length === 0) return;
    const results = await Promise.allSettled(toLoad.map((name) => loadSingle(name)));
    for (const r of results) {
        if (r.status === "rejected") console.warn("[componentLoader]", r.reason);
    }
}
