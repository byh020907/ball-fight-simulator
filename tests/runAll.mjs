import { performance } from "node:perf_hooks";

const TEST_DOMAINS = {
    regression: {
        modulePath: "./regression.mjs",
        footerMessages: new Set(["regression tests ok"])
    },
    uiContracts: {
        modulePath: "./uiContracts.mjs",
        footerMessages: new Set(["ui contract tests ok"])
    },
    profileVersionReset: {
        modulePath: "./profileVersionReset.mjs",
        footerMessages: new Set(["[profile-version-reset] ok"])
    }
};

function parseRequestedDomains(argv) {
    const requested = [];
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "--domain") {
            const domainName = argv[index + 1];
            if (!domainName) {
                throw new Error("--domain requires a domain name");
            }
            requested.push(domainName);
            index += 1;
            continue;
        }
        requested.push(token);
    }

    if (requested.length === 0) {
        return Object.keys(TEST_DOMAINS);
    }

    for (const domainName of requested) {
        if (!TEST_DOMAINS[domainName]) {
            throw new Error(
                `Unknown test domain "${domainName}". Available domains: ${Object.keys(TEST_DOMAINS).join(", ")}`
            );
        }
    }

    return requested;
}

function isCapturedSuccessMessage(message, footerMessages) {
    return /^\[[^\]]+\] ok$/.test(message) || footerMessages.has(message);
}

async function runDomain(domainName) {
    const domain = TEST_DOMAINS[domainName];
    const originalLog = console.log;
    const successMessages = [];
    const startedAt = performance.now();

    console.log = (...args) => {
        if (args.length === 1 && typeof args[0] === "string") {
            const message = args[0];
            if (isCapturedSuccessMessage(message, domain.footerMessages)) {
                successMessages.push(message);
                return;
            }
        }
        originalLog(...args);
    };

    try {
        await import(new URL(domain.modulePath, import.meta.url).href);
        const elapsedMs = performance.now() - startedAt;
        originalLog(`[tests:${domainName}] ok (${successMessages.length} checks, ${elapsedMs.toFixed(1)}ms)`);
        return {
            domainName,
            elapsedMs,
            successCount: successMessages.length
        };
    } catch (error) {
        const elapsedMs = performance.now() - startedAt;
        originalLog(`[tests:${domainName}] FAIL after ${elapsedMs.toFixed(1)}ms`);
        throw error;
    } finally {
        console.log = originalLog;
    }
}

const requestedDomains = parseRequestedDomains(process.argv.slice(2));
const results = [];
const suiteStartedAt = performance.now();

for (const domainName of requestedDomains) {
    results.push(await runDomain(domainName));
}

const totalElapsedMs = performance.now() - suiteStartedAt;
const totalChecks = results.reduce((sum, result) => sum + result.successCount, 0);
console.log(`[tests] ok (${results.length} domains, ${totalChecks} checks, ${totalElapsedMs.toFixed(1)}ms total)`);
