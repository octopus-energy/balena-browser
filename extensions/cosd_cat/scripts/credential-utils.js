(function (root) {
    function isNonEmptyString(value) {
        return typeof value === "string" && value.trim() !== "";
    }

    function escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function buildExactHostRegex(hostname) {
        // Match exact host only across schemes and optional port.
        return `^\\w+://${escapeRegex(hostname)}(?::\\d+)?/`;
    }

    function resolveCredentialsForUrl(url, contentCredential, sharedCredentials) {
        const domain = new URL(url).hostname;

        if (contentCredential && typeof contentCredential === "object") {
            // Content credentials are URL-scoped; enforce exact host targeting.
            return {
                credentials: [{ ...contentCredential, domain }],
                warning: null,
            };
        }

        if (!sharedCredentials) {
            return { credentials: [], warning: null };
        }

        if (
            typeof sharedCredentials !== "object" ||
            Array.isArray(sharedCredentials)
        ) {
            return {
                credentials: [],
                warning: "sharedCredentials must be an object keyed by domain",
            };
        }

        const sharedCredential = sharedCredentials[domain];
        if (!sharedCredential || typeof sharedCredential !== "object") {
            return { credentials: [], warning: null };
        }

        return {
            credentials: [{ ...sharedCredential, domain }],
            warning: null,
        };
    }

    function getCredentialValidationError(cred) {
        if (
            cred.type !== "http_header" &&
            cred.type !== "azure_client_credentials"
        ) {
            return "unsupported_type";
        }

        if (!isNonEmptyString(cred.domain)) {
            return "missing_domain";
        }

        if (cred.type === "azure_client_credentials") {
            if (
                !isNonEmptyString(cred.tenant_id) ||
                !isNonEmptyString(cred.client_id) ||
                !isNonEmptyString(cred.client_secret)
            ) {
                return "invalid_azure_client_credentials";
            }

            return null;
        }

        if (!isNonEmptyString(cred.key) || !isNonEmptyString(cred.value)) {
            return "invalid_key_value";
        }

        return null;
    }

    function getCredentialRequestHeaders(cred) {
        if (cred.type === "azure_client_credentials") {
            return [
                {
                    header: "X-PowerBI-Tenant-Id",
                    operation: "set",
                    value: cred.tenant_id,
                },
                {
                    header: "X-PowerBI-Client-Id",
                    operation: "set",
                    value: cred.client_id,
                },
                {
                    header: "X-PowerBI-Client-Secret",
                    operation: "set",
                    value: cred.client_secret,
                },
            ];
        }

        return [
            {
                header: cred.key,
                operation: "set",
                value: cred.value,
            },
        ];
    }

    const api = {
        isNonEmptyString,
        escapeRegex,
        buildExactHostRegex,
        resolveCredentialsForUrl,
        getCredentialValidationError,
        getCredentialRequestHeaders,
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }

    root.CredentialUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
