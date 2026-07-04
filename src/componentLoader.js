export const COMPONENTS = ["xp-reward-panel", "xp-progress-bar"];

const loaded = new Set();

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

export async function loadTemplates(components = COMPONENTS) {
    const results = await Promise.allSettled(
        components.map(async (name) => {
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
                injectStyle(`@scope ([${scopeAttr}]) {\n${s.css}\n}`);
            }

            for (const raw of scripts) {
                executeScript(raw);
            }

            loaded.add(name);
        })
    );
    for (const r of results) {
        if (r.status === "rejected") console.warn("[componentLoader]", r.reason);
    }
}
