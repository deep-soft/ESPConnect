import { afterEach, describe, expect, it, vi } from "vitest";
import { ESPLoader } from "tasmota-webserial-esptool";
import { CHIP_FAMILY_ESP32P4, CHIP_FAMILY_ESP32S3 } from "tasmota-webserial-esptool/dist/const.js";

// Backport: https://github.com/Jason2866/WebSerial_ESPTool/pull/376
// PMU bit preservation follows Espressif power_on_flash():
// https://github.com/espressif/esptool/blob/master/esptool/targets/esp32p4.py
// Hardware addresses from ESP32-P4's flash power initialization sequence.
const EFUSE = 0x5012d034;
const XPD_ON = 1 << 16;
const PMU_DATE = 0x501153fc;
const PAD_POWER = 0x5011010c;

function setup(revision = 302, efuse = 0, date = 0) {
  const port = { getInfo: () => ({}), open: vi.fn(), close: vi.fn(), readable: {}, writable: {} };
  const loader = new ESPLoader(port as unknown as SerialPort, {
    log: vi.fn(), debug: vi.fn(), error: vi.fn(),
  });
  loader.chipFamily = CHIP_FAMILY_ESP32P4;
  loader.chipRevision = revision;
  const registers = new Map([[EFUSE, efuse], [PMU_DATE, date]]);
  const read = vi.spyOn(loader, "readRegister").mockImplementation(async address => registers.get(address) ?? 0);
  const write = vi.spyOn(loader, "writeRegister").mockResolvedValue(undefined);
  return { loader, read, write };
}

afterEach(() => vi.restoreAllMocks());

describe("ESP32-P4 revision 3.2 power backport", () => {
  it.each([301, 302])("powers flash when ROM has not done so (revision %i)", async revision => {
    const { loader, read, write } = setup(revision);
    await loader.powerOnFlash();
    expect(write).toHaveBeenCalledWith(PAD_POWER, 1);
    expect(write).toHaveBeenCalledWith(PMU_DATE, 3);
    if (revision === 301) expect(read).not.toHaveBeenCalledWith(EFUSE);
  });

  it("releases ROM force-on bits without overwriting other PMU bits", async () => {
    const { loader, write } = setup(302, XPD_ON, 0x12340003);
    await loader.powerOnFlash();
    expect(write.mock.calls).toEqual([[PMU_DATE, 0x12340000]]);
  });

  it.each([0, 1, 2])("skips the power sequence when ROM powers flash and force-on is %i", async bits => {
    const { loader, write } = setup(302, XPD_ON, 0x12340000 | bits);
    await loader.powerOnFlash();
    expect(write).not.toHaveBeenCalled();
  });

  it.each([100, 300, 303])("leaves other P4 revisions untouched (%i)", async revision => {
    const { loader, read, write } = setup(revision);
    await loader.powerOnFlash();
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("leaves other chip families untouched", async () => {
    const { loader, read, write } = setup();
    loader.chipFamily = CHIP_FAMILY_ESP32S3;
    await loader.powerOnFlash();
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("initializes revision 3.2 flash after chip detection", async () => {
    const { loader, write } = setup(302, XPD_ON, 3);
    loader.chipRevision = null;
    vi.spyOn(loader, "readLoop").mockResolvedValue(undefined);
    vi.spyOn(loader, "connectWithResetStrategies").mockResolvedValue(undefined);
    vi.spyOn(loader, "detectChip").mockImplementation(async () => { loader.chipRevision = 302; });
    await loader.initialize();
    expect(write).toHaveBeenCalledWith(PMU_DATE, 0);
  });

  it("releases ROM force-on state before reloading the stub on reconnect", async () => {
    const { loader, write } = setup(302, XPD_ON, 3);
    vi.spyOn(loader, "hardReset").mockResolvedValue(undefined);
    vi.spyOn(loader, "readLoop").mockResolvedValue(undefined);
    vi.spyOn(loader, "flushSerialBuffers").mockResolvedValue(undefined);
    vi.spyOn(loader, "sync").mockResolvedValue(true);
    const stub = vi.spyOn(loader, "runStub").mockImplementation(async () => {
      expect(write).toHaveBeenCalledWith(PMU_DATE, 0);
      return loader;
    });
    await loader.reconnect();
    expect(stub).toHaveBeenCalledWith(true);
  });
});
