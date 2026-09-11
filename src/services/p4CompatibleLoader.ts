import { ESPLoader } from 'tasmota-webserial-esptool';
import { CHIP_FAMILY_ESP32P4, USB_JTAG_SERIAL_PID } from 'tasmota-webserial-esptool/dist/const.js';

// Keep the initial reset unchanged: the chip is identified only after ROM sync.
export class P4CompatibleLoader extends ESPLoader {
  private unixTightAttempted = false;
  private preferUnixTight = false;

  private canUseUnixTight(): boolean {
    const info = this.port.getInfo();
    return this.chipFamily === CHIP_FAMILY_ESP32P4 && this.chipRevision === 302 &&
      info.usbVendorId !== 0x303a && info.usbProductId !== USB_JTAG_SERIAL_PID;
  }

  // Signal sequence from WebSerial_ESPTool commit 16624ad, hardResetUnixTight().
  private async resetUnixTight(): Promise<void> {
    await this.setDTRandRTS(true, true);
    await this.setDTRandRTS(false, false);
    await this.setDTRandRTS(false, true);
    await this.sleep(100);
    await this.setDTRandRTS(true, false);
    await this.sleep(50);
    await this.setDTRandRTS(false, false);
    await this.setDTR(false);
    await this.sleep(200);
  }

  override async runStub(skipFlashDetection = false) {
    try {
      return await super.runStub(skipFlashDetection);
    } catch (initialError) {
      if (!this.canUseUnixTight() || this.unixTightAttempted ||
          !this.connected || !this.port.readable || !this.port.writable) {
        throw initialError;
      }
      this.unixTightAttempted = true;
      const initialMessage = initialError instanceof Error ? initialError.message : String(initialError);
      this.logger.log(`ESP32-P4 rev 3.2 stub initialization failed (${initialMessage}); retrying once with UnixTight reset.`);
      try {
        await this.resetUnixTight();
        await this.flushSerialBuffers();
        await this.sync();
        await this.powerOnFlash();
        // Call the base implementation directly so a second failure cannot recurse.
        const stub = await super.runStub(skipFlashDetection);
        this.preferUnixTight = true;
        this.logger.log('ESP32-P4 rev 3.2 stub initialized after UnixTight reset.');
        return stub;
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
        throw new Error(`ESP32-P4 rev 3.2 stub initialization failed: ${initialMessage}. UnixTight retry failed: ${retryMessage}`, { cause: retryError });
      }
    }
  }

  override async hardReset(bootloader = false): Promise<void> {
    if (bootloader && this.preferUnixTight && this.canUseUnixTight()) {
      this.logger.log('Using UnixTight reset for ESP32-P4 rev 3.2 reconnect.');
      await this.resetUnixTight();
      // reconnect() handles ROM sync and flash power initialization after reset.
      return;
    }
    await super.hardReset(bootloader);
  }
}
