const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
    loadConfig,
    isValidConfig,
    convertS3Url,
} = require("../extensions/cosd_cat/scripts/config-utils.js");

const website = { type: "website", url: "https://example.com/page" };
const headerCredential = {
    type: "http_header",
    key: "Authorization",
    value: "dummy-token",
};
const azureCredential = {
    type: "azure_client_credentials",
    tenant_id: "dummy-tenant",
    client_id: "dummy-client",
    client_secret: "dummy-secret",
};

test("loadConfig: fetches once and returns parsed configuration unchanged", async () => {
    const config = { content: [website], sharedCredentials: {} };
    const requestedUrls = [];
    let parseCount = 0;
    const result = await loadConfig("extension://config.json", async (url) => {
        requestedUrls.push(url);
        return {
            ok: true,
            json: async () => {
                parseCount += 1;
                return config;
            },
        };
    });

    assert.strictEqual(result, config);
    assert.deepEqual(requestedUrls, ["extension://config.json"]);
    assert.equal(parseCount, 1);
});

test("loadConfig: rejects unsuccessful responses without parsing JSON", async () => {
    await assert.rejects(
        loadConfig("config.json", async () => ({
            ok: false,
            statusText: "Not Found",
            json: () => assert.fail("Must not parse an unsuccessful response"),
        })),
        { message: "Failed to fetch config.json: Not Found" }
    );
});

test("loadConfig: propagates fetch and JSON parsing errors", async () => {
    const networkError = new Error("Network unavailable");
    await assert.rejects(
        loadConfig("config.json", async () => { throw networkError; }),
        (error) => error === networkError
    );

    const parseError = new SyntaxError("Invalid JSON");
    await assert.rejects(
        loadConfig("config.json", async () => ({
            ok: true,
            json: async () => { throw parseError; },
        })),
        (error) => error === parseError
    );
});

test("isValidConfig: accepts supported content, empty lists, and optional credentials", () => {
    assert.equal(isValidConfig([]), true);
    assert.equal(isValidConfig([website]), true);
    assert.equal(isValidConfig([{ type: "video", url: "s3://bucket/video.mp4" }]), true);
    assert.equal(isValidConfig([website, { type: "video", url: "https://example.com/video" }]), true);
    assert.equal(isValidConfig([{ ...website, credential: null }]), true);
    assert.equal(isValidConfig([{ ...website, credential: undefined }]), true);
});

test("isValidConfig: rejects non-array content and malformed items without throwing", () => {
    for (const value of [undefined, null, false, 0, "content", {}]) {
        assert.equal(isValidConfig(value), false);
    }
    for (const item of [undefined, null, false, 0, "item", [], {},
        { url: website.url }, { ...website, type: "unknown" }]) {
        assert.equal(isValidConfig([item]), false);
        assert.equal(isValidConfig([website, item]), false);
    }
});

test("isValidConfig: requires nonblank string URLs without imposing a scheme policy", () => {
    for (const url of [undefined, null, "", " \t\n", 42, false, {}, []]) {
        assert.equal(isValidConfig([{ ...website, url }]), false);
    }
    assert.equal(isValidConfig([{ ...website, url: "custom://example/path" }]), true);
});

test("isValidConfig: accepts HTTP and Azure inline credentials without a domain", () => {
    for (const credential of [headerCredential, azureCredential]) {
        const item = Object.freeze({ ...website, credential: Object.freeze({ ...credential }) });
        const content = Object.freeze([item]);
        assert.equal(isValidConfig(content), true);
        assert.deepEqual(content, [{ ...website, credential }]);
    }
});

test("isValidConfig: rejects malformed or unsupported inline credentials", () => {
    for (const credential of [false, true, 0, "credential", [], {},
        { ...headerCredential, type: "cookie" }]) {
        assert.equal(isValidConfig([{ ...website, credential }]), false);
    }
});

test("isValidConfig: requires all HTTP-header and Azure fields to be nonblank strings", () => {
    for (const [credential, fields] of [
        [headerCredential, ["key", "value"]],
        [azureCredential, ["tenant_id", "client_id", "client_secret"]],
    ]) {
        for (const field of fields) {
            const missingField = { ...credential };
            delete missingField[field];
            assert.equal(isValidConfig([{ ...website, credential: missingField }]), false, field);
            for (const value of [undefined, null, "", " \t\n", 42, false, {}, []]) {
                assert.equal(isValidConfig([{
                    ...website,
                    credential: { ...credential, [field]: value },
                }]), false, field);
            }
        }
    }
});

test("convertS3Url: preserves existing bucket, path, and query conversion", () => {
    for (const [url, expected] of [
        ["s3://bucket", "https://bucket.s3.amazonaws.com/"],
        ["s3://bucket/", "https://bucket.s3.amazonaws.com/"],
        ["s3://bucket/path/to/video.mp4", "https://bucket.s3.amazonaws.com/path/to/video.mp4"],
        ["s3://bucket/video.mp4?versionId=123", "https://bucket.s3.amazonaws.com/video.mp4?versionId=123"],
    ]) {
        assert.equal(convertS3Url(url), expected);
    }
});

test("convertS3Url: leaves non-S3 strings unchanged", () => {
    for (const url of ["https://example.com", "http://example.com/path", "custom://example", "", "S3://bucket/key"]) {
        assert.equal(convertS3Url(url), url);
    }
});

test("ConfigUtils: exposes its API in a classic browser script context", async () => {
    const requestedUrls = [];
    const context = vm.createContext({
        fetch: async (url) => {
            requestedUrls.push(url);
            return { ok: true, json: async () => ({ content: [website] }) };
        },
    });
    for (const filename of ["credential-utils.js", "config-utils.js"]) {
        const source = fs.readFileSync(path.join(
            __dirname, "../extensions/cosd_cat/scripts", filename
        ), "utf8");
        vm.runInContext(source, context, { filename });
    }

    assert.deepEqual(Object.keys(context.ConfigUtils).sort(), ["convertS3Url", "isValidConfig", "loadConfig"]);
    assert.equal(context.ConfigUtils.isValidConfig([{ ...website, credential: azureCredential }]), true);
    assert.equal(context.ConfigUtils.convertS3Url("s3://bucket/key"), "https://bucket.s3.amazonaws.com/key");
    assert.deepEqual(await context.ConfigUtils.loadConfig("config.json"), { content: [website] });
    assert.deepEqual(requestedUrls, ["config.json"]);
});