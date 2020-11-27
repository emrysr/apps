function Logger (APP_LEVEL) {
    const LEVELS = 'NONE,FATAL,ERROR,WARN,INFO,DEBUG,TRACE'.split(',');
    const DEFAULT = 4;
    let prefix = "";

    if (typeof APP_LEVEL === "undefined") APP_LEVEL = DEFAULT;

    function log (msg, level) {
        level = level || DEFAULT;
        if (APP_LEVEL > 0 && level <= APP_LEVEL) {
            if (level > 3) {
                console.log(`${LEVELS[level].toUpperCase()}:${" ".repeat(level)}${prefix}${msg}`);
            } else {
                console.error(`${LEVELS[level].toUpperCase()}:${" ".repeat(level)}${prefix}${msg}`);
            }
        }
    }
    function trace (msg) { log(msg, 6) }
    function debug (msg) { log(msg, 5) }
    function info (msg) { log(msg, 4) }
    function warn (msg) { log(msg, 3) }
    function error (msg) { log(msg, 2) }
    function fatal (msg) { log(msg, 1) }

    return { fatal, error, warn, info, debug, trace, LEVELS }
}

export default Logger;