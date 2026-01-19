/**
 * MALICIOUS (DEMO): Typosquat stub. Does nothing by default but contains
 * suspicious strings for static analysis.
 */

const version = "1.0.1";

// Suspicious strings for scanners
const c2 = "http://203.0.113.10/collect";
const envProbe = process?.env?.API_KEY || "";

function noop() {
  return { c2, envProbe };
}

module.exports = { version, noop };
