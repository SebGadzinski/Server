/**
 * @file IP functionality.
 * @author Sebastian Gadzinski
 */

import os from 'os';

function getInternalIPv4(): string | undefined {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
}

function getInternalIPv6(): string | undefined {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const alias of iface) {
      if (alias.family === 'IPv6' && !alias.internal) {
        return alias.address;
      }
    }
  }
}

const ipService = { getInternalIPv4, getInternalIPv6 };

export default ipService;
