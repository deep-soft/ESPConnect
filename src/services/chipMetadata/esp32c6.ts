// Minimal ESP32-C6 metadata helper (constants mirrored from legacy target for reference)
export const CHIP_NAME = 'ESP32-C6';
export const IMAGE_CHIP_ID = 13;
export const EFUSE_BASE = 0x60008800;
export const MAC_EFUSE_REG = EFUSE_BASE + 0x044;
export const FLASH_WRITE_SIZE = 0x400;
export const BOOTLOADER_FLASH_OFFSET = 0;

type Loader = {
  chipName?: string;
  chipRevision?: number;
  macAddr?: () => number[];
};

export async function readEsp32C6Metadata(loader: Loader) {
  const mac = typeof loader.macAddr === 'function' ?  safeMac(loader) : undefined;
  return {
    description: loader.chipName ?? CHIP_NAME,
    features: ['Wi-Fi', 'BLE', '802.15.4'],
    crystalFreq: 40,
    macAddress: mac,
    pkgVersion: undefined,
    chipRevision: loader.chipRevision ?? undefined,
    majorVersion: undefined,
    minorVersion: undefined,
    flashVendor: undefined,
    psramVendor: undefined,
    flashCap: undefined,
    psramCap: undefined,
    blockVersionMajor: undefined,
    blockVersionMinor: undefined,
  };
}

function safeMac(loader: Loader) {
  try {
    const mac = loader.macAddr?.();
    if (!Array.isArray(mac)) return undefined;
    return mac
      .slice(0, 6)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(':');
  } catch {
    return undefined;
  }
}
