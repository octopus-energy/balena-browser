(function (root) {
    const credentialUtils =
        typeof module !== "undefined" && module.exports
            ? require("./credential-utils.js")
            : root.CredentialUtils;

    async function loadConfig(url, fetchImpl = fetch) {
        const response = await fetchImpl(url);
        if (!response.ok) {
            throw new Error(
                `Failed to fetch config.json: ${response.statusText}`
            );
        }
        return response.json();
    }

    function isValidConfig(content) {
        if (!Array.isArray(content)) {
            return false;
        }

        return content.every((item) => {
            if (
                !item ||
                typeof item !== "object" ||
                Array.isArray(item) ||
                !["website", "video"].includes(item.type) ||
                !credentialUtils.isNonEmptyString(item.url)
            ) {
                return false;
            }
            
            //Check urls are valid
            try {
                new URL(item.url);
            } catch (e) {
                return false;
            }

            const credential = item.credential;
            if (credential === undefined || credential === null) {
                return true;
            }
            if (typeof credential !== "object" || Array.isArray(credential)) {
                return false;
            }

            if (credential.type === "http_header") {
                return (
                    credentialUtils.isNonEmptyString(credential.key) &&
                    credentialUtils.isNonEmptyString(credential.value)
                );
            }
            if (credential.type === "azure_client_credentials") {
                return (
                    credentialUtils.isNonEmptyString(credential.tenant_id) &&
                    credentialUtils.isNonEmptyString(credential.client_id) &&
                    credentialUtils.isNonEmptyString(credential.client_secret)
                );
            }
            return false;
        });
    }

    function convertS3Url(url) {
        if (url.startsWith("s3://")) {
            const s3Path = url.substring(5);
            const [bucket, ...keyParts] = s3Path.split("/");
            const key = keyParts.join("/");
            return `https://${bucket}.s3.amazonaws.com/${key}`;
        }
        return url;
    }

    const api = { loadConfig, isValidConfig, convertS3Url };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }

    root.ConfigUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);