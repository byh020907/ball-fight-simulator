export const ALPINE_TEMPLATE_COMPONENT_DIRECTIVE = "component";
export const ALPINE_TEMPLATE_COMPONENT_PREFIX = "template-";
export const ALPINE_TEMPLATE_COMPONENT_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const ALPINE_TEMPLATE_COMPONENT_TAG_MIN_PARTS = 2;

function stripWrappingQuotes(value) {
    const text = String(value ?? "").trim();
    const first = text[0];
    const last = text[text.length - 1];
    if ((first === "'" || first === '"' || first === "`") && first === last) {
        return text.slice(1, -1).trim();
    }
    return text;
}

function getElementChildren(el) {
    if (!el?.children) return [];
    return Array.from(el.children).filter((child) => child && (child.nodeType === 1 || child.nodeType === undefined));
}

export function normalizeTemplateComponentName(expression) {
    return stripWrappingQuotes(expression);
}

export function isValidTemplateComponentName(name) {
    return ALPINE_TEMPLATE_COMPONENT_NAME_PATTERN.test(String(name ?? ""));
}

export function getTemplateComponentId(name, prefix = ALPINE_TEMPLATE_COMPONENT_PREFIX) {
    return `${prefix}${name}`;
}

export function getTemplateComponentNameFromTagName(tagName) {
    const name = String(tagName ?? "").toLowerCase();
    if (!isValidTemplateComponentName(name)) return null;
    if (name.split("-").length < ALPINE_TEMPLATE_COMPONENT_TAG_MIN_PARTS) return null;
    return name;
}

export function resolveTemplateComponent(
    name,
    { root = globalThis.document, prefix = ALPINE_TEMPLATE_COMPONENT_PREFIX } = {}
) {
    if (!root || !isValidTemplateComponentName(name)) return null;
    const id = getTemplateComponentId(name, prefix);
    return typeof root.getElementById === "function" ? root.getElementById(id) : null;
}

function markTemplateComponentHost(el, name) {
    el.__bfsTemplateComponentName = name;
    if (el.dataset) {
        el.dataset.component = name;
    }
}

function clearTemplateComponentHost(el) {
    delete el.__bfsTemplateComponentName;
    if (el.dataset) {
        delete el.dataset.component;
    }
}

export function mountTemplateComponent(el, template, { Alpine = globalThis.Alpine, initialize = true } = {}) {
    if (!el || !template) return false;

    if (
        template.content &&
        typeof template.content.cloneNode === "function" &&
        typeof el.replaceChildren === "function"
    ) {
        el.replaceChildren(template.content.cloneNode(true));
    } else if ("innerHTML" in el && "innerHTML" in template) {
        el.innerHTML = template.innerHTML;
    } else {
        return false;
    }

    if (initialize && typeof Alpine?.initTree === "function") {
        for (const child of getElementChildren(el)) {
            Alpine.initTree(child);
        }
    }

    return true;
}

export function mountTemplateComponentByName(
    el,
    name,
    {
        root = globalThis.document,
        prefix = ALPINE_TEMPLATE_COMPONENT_PREFIX,
        Alpine = globalThis.Alpine,
        initialize = true
    } = {}
) {
    if (!el || !isValidTemplateComponentName(name)) return false;
    if (el.__bfsTemplateComponentName === name) return true;

    const template = resolveTemplateComponent(name, { root, prefix });
    if (!template) return false;

    markTemplateComponentHost(el, name);
    const mounted = mountTemplateComponent(el, template, { Alpine, initialize });
    if (!mounted) {
        clearTemplateComponentHost(el);
        return false;
    }

    return true;
}

export function findTemplateComponentTagHosts(
    root = globalThis.document,
    { prefix = ALPINE_TEMPLATE_COMPONENT_PREFIX } = {}
) {
    if (!root || typeof root.querySelectorAll !== "function") return [];

    return Array.from(root.querySelectorAll("*")).filter((el) => {
        if (el.__bfsTemplateComponentName) return false;
        const name = getTemplateComponentNameFromTagName(el.tagName);
        if (!name) return false;
        return !!resolveTemplateComponent(name, { root, prefix });
    });
}

export function mountTemplateComponentTags({
    root = globalThis.document,
    prefix = ALPINE_TEMPLATE_COMPONENT_PREFIX,
    Alpine = globalThis.Alpine,
    initialize = false,
    maxPasses = 10
} = {}) {
    let mountedCount = 0;

    for (let pass = 0; pass < maxPasses; pass += 1) {
        const hosts = findTemplateComponentTagHosts(root, { prefix });
        if (hosts.length === 0) break;

        for (const host of hosts) {
            const name = getTemplateComponentNameFromTagName(host.tagName);
            if (mountTemplateComponentByName(host, name, { root, prefix, Alpine, initialize })) {
                mountedCount += 1;
            }
        }
    }

    return mountedCount;
}

export function createTemplateComponentDirective({
    root = globalThis.document,
    prefix = ALPINE_TEMPLATE_COMPONENT_PREFIX,
    initialize = true,
    warn = console.warn
} = {}) {
    return (el, { expression } = {}, { Alpine, cleanup } = {}) => {
        const name = normalizeTemplateComponentName(expression);
        if (!isValidTemplateComponentName(name)) {
            warn?.(`[x-component] invalid component name: ${expression}`);
            return;
        }

        if (el.__bfsTemplateComponentName === name) {
            return;
        }

        if (!resolveTemplateComponent(name, { root, prefix })) {
            warn?.(`[x-component] missing template: ${getTemplateComponentId(name, prefix)}`);
            return;
        }

        const mounted = mountTemplateComponentByName(el, name, { root, prefix, Alpine, initialize });
        if (!mounted) {
            warn?.(`[x-component] failed to mount template: ${getTemplateComponentId(name, prefix)}`);
            return;
        }

        cleanup?.(() => {
            delete el.__bfsTemplateComponentName;
        });
    };
}

export function registerAlpineComponentSystem(Alpine, options = {}) {
    if (!Alpine || typeof Alpine.directive !== "function") {
        throw new Error("registerAlpineComponentSystem requires an Alpine instance");
    }

    const directiveName = options.directiveName ?? ALPINE_TEMPLATE_COMPONENT_DIRECTIVE;
    const directive = Alpine.directive(directiveName, createTemplateComponentDirective(options));
    if (options.mountTags !== false) {
        mountTemplateComponentTags({
            root: options.root,
            prefix: options.prefix,
            Alpine,
            initialize: options.initializeTags ?? false,
            maxPasses: options.maxTagPasses
        });
    }
    return directive;
}
