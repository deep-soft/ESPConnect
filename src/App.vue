<template>
  <v-app>
    <v-main>
      <v-container class="py-10" max-width="720">
        <v-card elevation="8" class="pa-6">
          <v-card-title class="d-flex flex-column align-start pa-0 mb-4">
            <div class="d-flex align-center w-100">
              <div class="text-h5 font-weight-semibold">ESP32 Web Flasher</div>
              <v-spacer />
              <v-btn
                :title="`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`"
                variant="text"
                icon
                color="primary"
                size="small"
                @click="toggleTheme"
              >
                <v-icon>{{ themeIcon }}</v-icon>
              </v-btn>
              <v-chip
                :color="connected ? 'success' : 'grey'"
                :prepend-icon="connected ? 'mdi-usb-port' : 'mdi-usb-off'"
                class="text-capitalize ms-2"
                variant="flat"
              >
                {{ connected ? 'Connected' : 'Disconnected' }}
              </v-chip>
            </div>
            <div class="text-body-2 text-medium-emphasis mt-2">
              {{ statusLabel }}
            </div>
          </v-card-title>

          <v-alert
            v-if="!serialSupported"
            type="error"
            class="mb-4"
            variant="tonal"
            icon="mdi-alert-circle-outline"
          >
            This browser does not support the Web Serial API. Use Chrome, Edge, or another Chromium-based browser.
          </v-alert>

          <v-row align="center" class="mb-4" dense>
            <v-col cols="12" md="4">
              <v-btn
                color="primary"
                block
                size="large"
                :disabled="!serialSupported || connected || busy"
                @click="connect"
              >
                <v-icon start>mdi-usb-flash-drive</v-icon>
                Connect
              </v-btn>
            </v-col>
            <v-col cols="12" md="4">
              <v-btn
                color="secondary"
                block
                size="large"
                variant="tonal"
                :disabled="!connected || busy"
                @click="disconnect"
              >
                <v-icon start>mdi-close-circle</v-icon>
                Disconnect
              </v-btn>
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="selectedBaud"
                :items="baudrateOptions"
                label="Target baud rate"
                density="comfortable"
                :disabled="busy"
              />
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <v-expand-transition>
            <v-card v-if="chipDetails" class="mb-4" variant="tonal">
              <v-card-text>
                <v-row dense>
                  <v-col cols="12" md="6">
                    <div class="text-subtitle-2 text-medium-emphasis">Chip</div>
                    <div class="text-body-1 font-weight-medium">
                      {{ chipDetails.description || chipDetails.name }}
                    </div>
                    <div class="text-caption text-medium-emphasis mt-1">
                      {{ chipDetails.name }}
                    </div>
                  </v-col>
                  <v-col cols="12" md="6">
                    <div class="text-subtitle-2 text-medium-emphasis">Flash</div>
                    <div class="text-body-1 font-weight-medium">
                      {{ chipDetails.flashSize || 'Unknown' }}
                    </div>
                    <div class="text-caption text-medium-emphasis mt-1">
                      Crystal: {{ chipDetails.crystal || 'Unknown' }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      MAC: {{ chipDetails.mac || 'Unknown' }}
                    </div>
                  </v-col>
                  <v-col cols="12">
                    <div class="text-subtitle-2 text-medium-emphasis mb-2">Features</div>
                    <v-chip-group column>
                      <v-chip
                        v-for="feature in chipDetails.features"
                        :key="feature"
                        class="me-2 mb-2"
                        size="small"
                        variant="elevated"
                        color="primary"
                      >
                        {{ feature }}
                      </v-chip>
                      <v-chip
                        v-if="!chipDetails.features?.length"
                        size="small"
                        variant="outlined"
                      >
                        Not reported
                      </v-chip>
                    </v-chip-group>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-expand-transition>

          <v-row class="mb-2" dense>
            <v-col cols="12" md="8">
              <v-file-input
                label="Firmware binary (.bin)"
                prepend-icon="mdi-file-upload"
                accept=".bin"
                density="comfortable"
                :disabled="busy"
                @update:model-value="handleFirmwareInput"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="flashOffset"
                label="Flash offset"
                placeholder="0x0"
                density="comfortable"
                :disabled="busy"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="selectedPreset"
                :items="offsetPresets"
                label="Recommended offsets"
                item-title="label"
                item-value="value"
                clearable
                density="comfortable"
                :disabled="busy"
                @update:model-value="applyOffsetPreset"
              />
            </v-col>
          </v-row>

          <v-checkbox
            v-model="eraseFlash"
            label="Erase entire flash before writing"
            density="comfortable"
            hide-details
            class="mb-4"
            :disabled="busy"
          />

          <v-btn
            color="primary"
            size="large"
            block
            :disabled="!canFlash || busy"
            @click="flashFirmware"
          >
            <v-icon start>mdi-lightning-bolt</v-icon>
            Flash Firmware
          </v-btn>

          <v-progress-linear
            v-if="flashInProgress"
            class="mt-4"
            :model-value="flashProgress"
            color="primary"
            height="12"
            rounded
            striped
          >
            <strong>{{ flashProgress }}%</strong>
          </v-progress-linear>

          <v-card class="mt-6" variant="tonal">
            <v-card-title class="text-subtitle-1 font-weight-medium d-flex align-center">
              <v-icon class="me-2" size="20">mdi-monitor</v-icon>
              Session Log
              <v-spacer />
              <v-btn
                variant="text"
                color="primary"
                size="small"
                prepend-icon="mdi-trash-can-outline"
                :disabled="!logText"
                @click="clearLog"
              >
                Clear
              </v-btn>
            </v-card-title>
            <v-card-text class="log-surface">
              <pre class="log-output">{{ logText || 'Logs will appear here once actions begin.' }}</pre>
            </v-card-text>
          </v-card>
        </v-card>

        <v-dialog v-model="showBootDialog" width="420">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="warning">mdi-alert-circle-outline</v-icon>
              Connection Tips
            </v-card-title>
            <v-card-text>
              <p class="text-body-2">
                We couldn’t communicate with the board. Try putting your ESP32 into bootloader mode:
              </p>
              <ol class="text-body-2 ps-4">
                <li>Hold the <strong>BOOT</strong> (GPIO0) button.</li>
                <li>Tap <strong>RESET</strong>, then release it.</li>
                <li>Release the BOOT button after one second.</li>
                <li>Click <strong>Connect</strong> again.</li>
              </ol>
              <p class="text-caption text-medium-emphasis" v-if="lastErrorMessage">
                Last error: {{ lastErrorMessage }}
              </p>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn color="primary" variant="text" @click="showBootDialog = false">
                Got it
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ESPLoader, Transport } from 'esptool-js';
import { useTheme } from 'vuetify';

const SUPPORTED_VENDORS = [
  { usbVendorId: 0x303a },
  { usbVendorId: 0x1a86 },
  { usbVendorId: 0x10c4 },
  { usbVendorId: 0x0403 },
];

const DEFAULT_ROM_BAUD = 115200;

const serialSupported = 'serial' in navigator;
const connected = ref(false);
const statusDetails = ref('No device connected.');
const busy = ref(false);
const flashInProgress = ref(false);
const flashProgress = ref(0);
const selectedBaud = ref('921600');
const baudrateOptions = ['115200', '230400', '460800', '921600'];
const flashOffset = ref('0x0');
const eraseFlash = ref(false);
const selectedPreset = ref(null);

const logBuffer = ref('');
const currentPort = ref(null);
const transport = ref(null);
const loader = ref(null);
const firmwareBuffer = ref(null);
const firmwareName = ref('');
const chipDetails = ref(null);

const showBootDialog = ref(false);
const lastErrorMessage = ref('');

const offsetPresets = [
  { label: 'Application (0x10000)', value: '0x10000' },
  { label: 'Bootloader (0x1000)', value: '0x1000' },
  { label: 'Partition Table (0x8000)', value: '0x8000' },
  { label: 'NVS Storage (0x9000)', value: '0x9000' },
];

const theme = useTheme();
const storedTheme =
  typeof window !== 'undefined' ? window.localStorage.getItem('esp32-theme') : null;
const currentTheme = ref(storedTheme === 'light' ? 'light' : 'dark');
const isDarkTheme = computed(() => currentTheme.value === 'dark');
const themeIcon = computed(() =>
  isDarkTheme.value ? 'mdi-weather-night' : 'mdi-white-balance-sunny'
);

function applyThemeClass(name) {
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('light-theme', name === 'light');
  }
}

watch(
  currentTheme,
  name => {
    theme.global.name.value = name;
    applyThemeClass(name);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('esp32-theme', name);
    }
  },
  { immediate: true }
);

function toggleTheme() {
  currentTheme.value = isDarkTheme.value ? 'light' : 'dark';
}

const statusLabel = computed(() =>
  connected.value ? statusDetails.value : 'No device connected. Choose a port to begin.'
);

const canFlash = computed(() => connected.value && firmwareBuffer.value && !flashInProgress.value);

function appendLog(message, prefix = '[ui]') {
  const line = prefix ? `${prefix} ${message}` : message;
  logBuffer.value += `${line}\n`;
}

const logText = computed(() => logBuffer.value);

const terminal = {
  clean() {
    logBuffer.value = '';
  },
  write(data) {
    logBuffer.value += data;
  },
  writeLine(data) {
    logBuffer.value += `${data}\n`;
  },
};

function clearLog() {
  terminal.clean();
}

async function disconnectTransport() {
  try {
    if (transport.value) {
      await transport.value.disconnect();
    } else if (currentPort.value) {
      await currentPort.value.close();
    }
  } catch (error) {
    console.warn('Error disconnecting transport', error);
  } finally {
    transport.value = null;
    currentPort.value = null;
    loader.value = null;
    connected.value = false;
    statusDetails.value = 'No device connected.';
    chipDetails.value = null;
  }
}

async function connect() {
  if (!serialSupported) {
    appendLog('Web Serial API not available in this browser.');
    return;
  }
  if (busy.value) return;
  busy.value = true;
  flashProgress.value = 0;

  appendLog('Requesting serial port access...');

  try {
    showBootDialog.value = false;
    currentPort.value = await navigator.serial.requestPort({ filters: SUPPORTED_VENDORS });
    const baudrate = Number.parseInt(selectedBaud.value, 10) || DEFAULT_ROM_BAUD;
    transport.value = new Transport(currentPort.value);
    loader.value = new ESPLoader({
      transport: transport.value,
      baudrate,
      romBaudrate: DEFAULT_ROM_BAUD,
      terminal,
    });

    const chipName = await loader.value.main('default_reset');
    const chip = loader.value.chip;

    const [description, features, crystalFreq, macAddress, flashSizeKb] = await Promise.all([
      chip?.getChipDescription(loader.value).catch(() => chipName),
      chip?.getChipFeatures(loader.value).catch(() => ''),
      chip?.getCrystalFreq(loader.value).catch(() => null),
      chip?.readMac(loader.value).catch(() => ''),
      loader.value.getFlashSize().catch(() => null),
    ]);

    const featureList = typeof features === 'string' ? features.split(/,\s*/) : [];
    const flashLabel =
      typeof flashSizeKb === 'number'
        ? flashSizeKb >= 1024
          ? `${(flashSizeKb / 1024).toFixed(flashSizeKb % 1024 === 0 ? 0 : 1)} MB`
          : `${flashSizeKb} KB`
        : null;
    const crystalLabel =
      typeof crystalFreq === 'number' ? `${Number(crystalFreq).toFixed(0)} MHz` : null;

    chipDetails.value = {
      name: chipName,
      description,
      features: featureList.filter(Boolean),
      mac: macAddress,
      flashSize: flashLabel,
      crystal: crystalLabel,
    };

    connected.value = true;
    statusDetails.value = `Connected to ${chipName} @ ${baudrate} baud.`;
    appendLog(`Connection established. Ready to flash.`);
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'NotFoundError') {
      appendLog('Port selection was cancelled.');
    } else {
      appendLog(`Connection failed: ${error?.message || error}`, '[error]');
      lastErrorMessage.value = error?.message || String(error);
      showBootDialog.value = true;
    }
    await disconnectTransport();
  } finally {
    busy.value = false;
  }
}

async function disconnect() {
  if (busy.value) return;
  busy.value = true;
  await disconnectTransport();
  appendLog('Serial port disconnected.');
  busy.value = false;
}

function parseOffset(value) {
  if (!value) {
    throw new Error('Flash offset is required.');
  }
  const trimmed = value.trim().toLowerCase();
  const parsed = trimmed.startsWith('0x')
    ? Number.parseInt(trimmed, 16)
    : Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) {
    throw new Error('Invalid flash offset value.');
  }
  return parsed;
}

async function flashFirmware() {
  if (!loader.value || !firmwareBuffer.value) {
    appendLog('Select a firmware binary and connect to a device first.', '[warn]');
    return;
  }
  if (flashInProgress.value || busy.value) return;

  let offsetNumber;
  try {
    offsetNumber = parseOffset(flashOffset.value);
  } catch (error) {
    appendLog(error.message, '[error]');
    return;
  }

  flashInProgress.value = true;
  busy.value = true;
  flashProgress.value = 0;

  appendLog(`Flashing ${firmwareName.value} at 0x${offsetNumber.toString(16)}...`);

  try {
    const bytes = new Uint8Array(firmwareBuffer.value);
    const dataString = loader.value.ui8ToBstr(bytes);
    const startTime = performance.now();

    await loader.value.writeFlash({
      fileArray: [{ data: dataString, address: offsetNumber }],
      flashSize: 'keep',
      flashMode: 'keep',
      flashFreq: 'keep',
      eraseAll: eraseFlash.value,
      compress: true,
      reportProgress: (_fileIndex, written, total) => {
        const pct = total ? Math.floor((written / total) * 100) : 0;
        flashProgress.value = Math.min(100, Math.max(0, pct));
      },
    });

    await loader.value.after('hard_reset');
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  appendLog(`Flashing complete in ${elapsed}s. Device rebooted.`);
  } catch (error) {
    appendLog(`Flashing failed: ${error?.message || error}`, '[error]');
  } finally {
    flashProgress.value = 0;
    flashInProgress.value = false;
    busy.value = false;
  }
}

async function handleFirmwareInput(files) {
  if (!files || files.length === 0) {
    firmwareBuffer.value = null;
    firmwareName.value = '';
    return;
  }
  const file = Array.isArray(files) ? files[0] : files;
  if (!file) return;
  firmwareBuffer.value = await file.arrayBuffer();
  firmwareName.value = file.name;
  appendLog(`Firmware loaded: ${file.name} (${file.size} bytes).`);
}

function applyOffsetPreset(value) {
  if (value) {
    flashOffset.value = value;
    appendLog(`Applied preset offset ${value}.`);
  }
}

function handleBeforeUnload() {
  if (connected.value && transport.value) {
    transport.value.disconnect();
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  theme.global.name.value = currentTheme.value;
  applyThemeClass(currentTheme.value);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  disconnectTransport();
});
</script>

<style scoped>
.log-surface {
  background: rgba(15, 23, 42, 0.72);
  border-radius: 12px;
  padding: 12px;
  max-height: 320px;
  overflow-y: auto;
}

.log-output {
  margin: 0;
  font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.45;
  white-space: pre-wrap;
  color: rgba(226, 232, 240, 0.9);
}
</style>
