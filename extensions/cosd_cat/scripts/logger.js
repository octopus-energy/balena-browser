function log(level, message, ...args) {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] [${level}]`;

    if (level === "ERROR") {
        console.error(prefix, message, ...args);
    } else if (level === "WARN") {
        console.warn(prefix, message, ...args);
    } else {
        console.log(prefix, message, ...args);
    }
}
