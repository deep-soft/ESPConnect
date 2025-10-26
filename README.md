# ESP32 Web USB Flasher

A browser-based flasher built with Vite and [esptool-js](https://github.com/espressif/esptool-js). It uses the Web Serial API in Chromium browsers to connect directly to an ESP32 board over USB, inspect the chip, and upload firmware binaries—no Python tooling required once it’s running.

## Features

- Vue 3 + Vuetify interface for connecting, configuring, and flashing ESP targets.
- Automatic chip summary (flash size, MAC, features) once connected.
- Recommended flash-offset presets for common ESP-IDF/Arduino layouts.
- Detects ESP32-class chips via Web Serial and runs the esptool handshake in the browser.
- Displays chip metadata (type, flash info) and streaming logs from the bootloader.
- Uploads `.bin` firmware images with optional full-chip erase and on-the-fly compression.
- Shows flashing progress and automatically resets the device on completion.
- Boot-mode helper dialog for boards that need manual BOOT/RESET steps.
- Built-in light/dark theme toggle (persisted per browser).

## Requirements

- Node.js 18+ (tested with Node 20).
- A Chromium-based browser (Chrome, Edge, or Arc) 89 or newer. `localhost` counts as a secure origin for Web Serial.
- ESP32 (or ESP8266/C3/S2/S3 variants) attached over USB. Auto-reset requires the board’s DTR/RTS lines; otherwise, press and hold **BOOT** while tapping **RESET** when prompted.

## Getting Started

```bash
git clone https://github.com/thelastoutpostworkshop/esp32usb.git
cd esp32usb
npm install
npm run dev
```

Open the printed URL in Chrome/Edge. Click **Connect**, grant serial access, then select your firmware `.bin`, set the desired flash offset, and press **Flash Firmware**.

### Bootloader Tips

- If connection fails, hold **BOOT** and tap **RESET**, then release **BOOT** after clicking **Connect**.
- Close other serial monitors (Arduino IDE, `esptool.py`, etc.) before using the web flasher—only one app can own the port.
- If you need a higher download speed, choose a higher baud rate after connecting. Some USB bridges struggle above 921600 baud.

## Building for Production

```bash
npm run build
npm run preview
```

Deploy the contents of `dist/` to any static HTTPS host. Browsers block Web Serial on non-secure origins.

## Repository Structure

```
├─ index.html        # Vite entry point
├─ package.json      # Project metadata and scripts
├─ src/
│  ├─ App.vue        # Vuetify UI + Web Serial logic
│  ├─ main.js        # Vue / Vuetify bootstrapping
│  └─ style.css      # Global background styles
```

## License

This project is provided under the MIT License. See [LICENSE](LICENSE) for details.
