const test = require("node:test");
const assert = require("node:assert/strict");

const {
    buildExactHostRegex,
    resolveCredentialsForUrl,
    getCredentialValidationError,
    getCredentialRequestHeaders,
} = require("../extensions/cosd_cat/scripts/credential-utils.js");

test("resolveCredentialsForUrl: content credential takes precedence and is host-scoped", () => {
    const result = resolveCredentialsForUrl(
        "https://example.com/page",
        { type: "http_header", key: "Authorization", value: "token" },
        {
            "example.com": {
                type: "http_header",
                key: "Authorization",
                value: "shared",
            },
        }
    );

    assert.equal(result.warning, null);
    assert.deepEqual(result.credentials, [
        {
            type: "http_header",
            key: "Authorization",
            value: "token",
            domain: "example.com",
        },
    ]);
});

test("resolveCredentialsForUrl: resolves shared credential by exact hostname key", () => {
    const result = resolveCredentialsForUrl(
        "https://kraken.octopus.energy/view",
        null,
        {
            "kraken.octopus.energy": {
                type: "http_header",
                key: "SessionlessAuthorization",
                value: "abc",
            },
        }
    );

    assert.equal(result.warning, null);
    assert.deepEqual(result.credentials, [
        {
            type: "http_header",
            key: "SessionlessAuthorization",
            value: "abc",
            domain: "kraken.octopus.energy",
        },
    ]);
});

test("resolveCredentialsForUrl: does not match subdomains implicitly", () => {
    const result = resolveCredentialsForUrl(
        "https://api.example.com/path",
        null,
        {
            "example.com": {
                type: "http_header",
                key: "Authorization",
                value: "abc",
            },
        }
    );

    assert.equal(result.warning, null);
    assert.deepEqual(result.credentials, []);
});

test("resolveCredentialsForUrl: emits warning for legacy array format", () => {
    const result = resolveCredentialsForUrl("https://example.com", null, []);

    assert.equal(
        result.warning,
        "sharedCredentials must be an object keyed by domain"
    );
    assert.deepEqual(result.credentials, []);
});

test("buildExactHostRegex: creates exact host regex", () => {
    const regex = new RegExp(buildExactHostRegex("example.com"));

    assert.equal(regex.test("https://example.com/page"), true);
    assert.equal(regex.test("http://example.com:8080/path"), true);
    assert.equal(regex.test("https://api.example.com/page"), false);
});

test("getCredentialValidationError: validates supported shape", () => {
    assert.equal(
        getCredentialValidationError({
            type: "http_header",
            domain: "example.com",
            key: "Authorization",
            value: "token",
        }),
        null
    );

    assert.equal(
        getCredentialValidationError({
            type: "cookie",
            domain: "example.com",
            key: "x",
            value: "y",
        }),
        "unsupported_type"
    );

    assert.equal(
        getCredentialValidationError({
            type: "http_header",
            key: "x",
            value: "y",
        }),
        "missing_domain"
    );

    assert.equal(
        getCredentialValidationError({
            type: "http_header",
            domain: "example.com",
            key: "",
            value: "y",
        }),
        "invalid_key_value"
    );
});

test("azure client credentials map to Power BI request headers", () => {
    const credential = {
        type: "azure_client_credentials",
        domain: "app.powerbi.com",
        tenant_id: "tenant-id",
        client_id: "client-id",
        client_secret: "client-secret",
    };

    assert.equal(getCredentialValidationError(credential), null);
    assert.deepEqual(getCredentialRequestHeaders(credential), [
        {
            header: "X-PowerBI-Tenant-Id",
            operation: "set",
            value: "tenant-id",
        },
        {
            header: "X-PowerBI-Client-Id",
            operation: "set",
            value: "client-id",
        },
        {
            header: "X-PowerBI-Client-Secret",
            operation: "set",
            value: "client-secret",
        },
    ]);
});

test("azure client credentials require all values", () => {
    assert.equal(
        getCredentialValidationError({
            type: "azure_client_credentials",
            domain: "app.powerbi.com",
            tenant_id: "tenant-id",
            client_id: "client-id",
        }),
        "invalid_azure_client_credentials"
    );
});
