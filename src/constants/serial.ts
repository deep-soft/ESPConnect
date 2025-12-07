export const TIMEOUT_CONNECT = 1500;

export const SUPPORTED_VENDORS: SerialPortFilter[] = [
  { usbVendorId: 0x303a },
  { usbVendorId: 0x1a86 },
  { usbVendorId: 0x10c4 },
  { usbVendorId: 0x0403 },
];

export const SUPPORTED_BAUDRATES = [
  115200,
  230400,
  460800,
  921600,
  1_500_000,
  2_000_000,
] as const;

export const MAX_SUPPORTED_BAUDRATE =
  SUPPORTED_BAUDRATES[SUPPORTED_BAUDRATES.length - 1];
export const DEFAULT_ROM_BAUD = 115200;
export const DEFAULT_FLASH_BAUD = 921600;
export const MONITOR_BAUD = 115200;
export const DEBUG_SERIAL = false;
