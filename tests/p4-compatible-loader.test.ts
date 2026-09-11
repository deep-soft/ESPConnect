import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ESPLoader } from 'tasmota-webserial-esptool';
import { CHIP_FAMILY_ESP32P4, CHIP_FAMILY_ESP32S3 } from 'tasmota-webserial-esptool/dist/const.js';
import { getStubCode } from 'tasmota-webserial-esptool/dist/stubs/index.js';
import { P4CompatibleLoader } from '../src/services/p4CompatibleLoader';

function setup(revision = 302, vendor = 0x1a86) {
  const signals = vi.fn().mockResolvedValue(undefined);
  const port = {
    getInfo: () => ({ usbVendorId: vendor, usbProductId: 0x55d3 }),
    setSignals: signals, readable: {}, writable: {}, open: vi.fn(), close: vi.fn(),
  };
  const log = vi.fn();
  const loader = new P4CompatibleLoader(port as unknown as SerialPort, { log, debug: vi.fn(), error: vi.fn() });
  loader.chipFamily = CHIP_FAMILY_ESP32P4;
  loader.chipRevision = revision;
  loader.connected = true;
  vi.spyOn(loader, 'sleep').mockResolvedValue(undefined);
  const flush = vi.spyOn(loader, 'flushSerialBuffers').mockResolvedValue(undefined);
  const sync = vi.spyOn(loader, 'sync').mockResolvedValue(true);
  const power = vi.spyOn(loader, 'powerOnFlash').mockResolvedValue(undefined);
  return { loader, port, signals, log, flush, sync, power };
}

afterEach(() => vi.restoreAllMocks());

describe('P4 revision 3.2 UnixTight fallback', () => {
  it('does not reset if the updated stub succeeds on the first attempt', async () => {
    const { loader, signals } = setup();
    vi.spyOn(ESPLoader.prototype, 'runStub').mockResolvedValue(loader);
    const reset = vi.spyOn(ESPLoader.prototype, 'hardReset').mockResolvedValue(undefined);
    await loader.runStub();
    expect(signals).not.toHaveBeenCalled();
    await loader.hardReset(true);
    expect(reset).toHaveBeenCalledWith(true);
  });

  it('retries in order and remembers a successful reset for reconnects', async () => {
    const { loader, signals, flush, sync, power } = setup();
    const attempt = vi.spyOn(ESPLoader.prototype, 'runStub')
      .mockRejectedValueOnce(new Error('Invalid head of packet (0x47)'))
      .mockResolvedValue(loader);
    const reset = vi.spyOn(ESPLoader.prototype, 'hardReset').mockResolvedValue(undefined);
    await expect(loader.runStub()).resolves.toBe(loader);
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(signals.mock.calls.map(([value]) => value)).toEqual([
      { dataTerminalReady: true, requestToSend: true },
      { dataTerminalReady: false, requestToSend: false },
      { dataTerminalReady: false, requestToSend: true },
      { dataTerminalReady: true, requestToSend: false },
      { dataTerminalReady: false, requestToSend: false },
      { dataTerminalReady: false },
    ]);
    expect(signals.mock.invocationCallOrder.at(-1)).toBeLessThan(flush.mock.invocationCallOrder[0]!);
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(sync.mock.invocationCallOrder[0]!);
    expect(sync.mock.invocationCallOrder[0]).toBeLessThan(power.mock.invocationCallOrder[0]!);
    expect(power.mock.invocationCallOrder[0]).toBeLessThan(attempt.mock.invocationCallOrder[1]!);

    signals.mockClear();
    vi.spyOn(loader, 'readLoop').mockResolvedValue(undefined);
    await loader.reconnect();
    expect(signals).toHaveBeenCalledTimes(6);
    expect(attempt).toHaveBeenLastCalledWith(true);
    expect(power).toHaveBeenCalledTimes(2);
    expect(reset).not.toHaveBeenCalled();
    // Returning to firmware must retain the original reset behavior.
    await loader.hardReset(false);
    expect(reset).toHaveBeenCalledWith(false);
  });

  it.each([100, 300, 301, 303])('does not retry other P4 revisions (%i)', async revision => {
    const { loader, signals } = setup(revision);
    const error = new Error('stub failed');
    const attempt = vi.spyOn(ESPLoader.prototype, 'runStub').mockRejectedValue(error);
    await expect(loader.runStub()).rejects.toBe(error);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(signals).not.toHaveBeenCalled();
  });

  it.each(['other chip', 'native USB', 'disconnected'])('does not retry %s', async scenario => {
    const { loader, signals } = setup(302, scenario === 'native USB' ? 0x303a : 0x1a86);
    if (scenario === 'other chip') loader.chipFamily = CHIP_FAMILY_ESP32S3;
    if (scenario === 'disconnected') loader.connected = false;
    vi.spyOn(ESPLoader.prototype, 'runStub').mockRejectedValue(new Error('stub failed'));
    await expect(loader.runStub()).rejects.toThrow('stub failed');
    expect(signals).not.toHaveBeenCalled();
  });

  it('preserves both errors and limits recovery to one attempt per session', async () => {
    const { loader, signals } = setup();
    const attempt = vi.spyOn(ESPLoader.prototype, 'runStub')
      .mockRejectedValueOnce(new Error('original failure'))
      .mockRejectedValue(new Error('retry failure'));
    const reset = vi.spyOn(ESPLoader.prototype, 'hardReset').mockResolvedValue(undefined);
    await expect(loader.runStub()).rejects.toThrow('original failure. UnixTight retry failed: retry failure');
    expect(attempt).toHaveBeenCalledTimes(2);
    await expect(loader.runStub()).rejects.toThrow('retry failure');
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(signals).toHaveBeenCalledTimes(6);
    await loader.hardReset(true);
    expect(reset).toHaveBeenCalledWith(true);
  });

  it('stops recovery if resynchronization fails', async () => {
    const { loader, sync, power } = setup();
    sync.mockRejectedValue(new Error('sync failed'));
    const attempt = vi.spyOn(ESPLoader.prototype, 'runStub').mockRejectedValue(new Error('stub failed'));
    await expect(loader.runStub()).rejects.toThrow('UnixTight retry failed: sync failed');
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(power).not.toHaveBeenCalled();
  });
});

describe('P4 stub backport', () => {
  it('selects the pinned upstream stub only for revision 3.2', async () => {
    // SHA-256 of decoded upstream text at commit 16624ad (not the JSON formatting).
    const current = await getStubCode(CHIP_FAMILY_ESP32P4, 302);
    expect(createHash('sha256').update(Uint8Array.from(current!.text)).digest('hex'))
      .toBe('994233fd1966e1c3175445bebf5c6c6f2862d77b22ce7451466e0f5dc36b1f9b');
    for (const revision of [300, 301, 303]) {
      const previous = await getStubCode(CHIP_FAMILY_ESP32P4, revision);
      expect(createHash('sha256').update(Uint8Array.from(previous!.text)).digest('hex'))
        .toBe('dde6e950e0fabf297497b781331b204d3eb355b1b5e733b62587585b98f0248e');
    }
  });

  it.each([301, 302])('reads flash and acknowledges every packet (revision %i)', async revision => {
    const { loader } = setup(revision);
    loader.IS_STUB = true;
    const command = vi.spyOn(loader, 'checkCommand').mockResolvedValue([0, []]);
    const packet = Array.from({ length: 4096 }, (_, i) => i % 256);
    vi.spyOn(loader, 'readPacket').mockResolvedValue(packet);
    const ack = vi.spyOn(loader, 'writeToStream').mockResolvedValue(undefined);
    const data = await loader.readFlash(0, 8192);
    expect(data).toEqual(Uint8Array.from([...packet, ...packet]));
    const request = Uint8Array.from(command.mock.calls[0]![1]!);
    expect(new DataView(request.buffer).getUint32(12, true)).toBe(revision === 302 ? 64 : 1024);
    expect(ack.mock.calls).toEqual([
      [[0xc0, 0, 0x10, 0, 0, 0xc0]],
      [[0xc0, 0, 0x20, 0, 0, 0xc0]],
    ]);
  });
});
