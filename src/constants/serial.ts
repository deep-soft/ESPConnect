export const TIMEOUT_CONNECT = 2000;

export const SUPPORTED_VENDORS: SerialPortFilter[] = [
  { usbVendorId: 0x303a },
  { usbVendorId: 0x1a86 },
  { usbVendorId: 0x10c4 },
  { usbVendorId: 0x0403 },
];

export const DEFAULT_ROM_BAUD = 115200;
export const DEFAULT_FLASH_BAUD = 921600;
export const MONITOR_BAUD = 115200;
export const DEBUG_SERIAL = false;
