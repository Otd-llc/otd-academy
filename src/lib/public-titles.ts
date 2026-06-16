// Public, learner-facing lesson titles (keyword-rich, the names people actually
// Google) vs. the internal slugs / curriculum names. From the GTM narrative plan
// §5. Used on the certificate (and a natural home for future public surfaces).
// A code map for now — the open question of whether these live in a Project
// column or a content layer is deferred; this is the pragmatic interim.
const PUBLIC_TITLES: Record<string, string> = {
  "l1-01-wroom-breakout": "ESP32-S3 USB-C Breakout Board",
  "l1-02-espnow-link": "ESP-NOW Wireless Link (ESP32)",
  "l1-03-ws2812-node": "WS2812 Addressable-LED Driver (ESP32)",
  "l1-04-single-servo": "ESP32 Servo Driver Board",
  "l1-05-internal-adc": "ESP32 Analog Sensing (Internal ADC)",
  "l2-01-battery-power-module": "ESP32 Li-ion Battery & Power Module",
  "l2-02-ads1220-sense": "ADS1220 24-bit Precision ADC (ESP32)",
  "l2-03-motor-driver": "DRV8833 DC Motor Driver (ESP32)",
  "l2-04-power-led-driver": "Constant-Current Power-LED Driver (ESP32)",
  "l2-05-isolated-spi-bridge": "Isolated SPI Bridge (ESP32)",
  "l3-de-ads1292r": "ADS1292R Biopotential Front-End (ESP32)",
  "l3-01-eeg-front-end": "8-Channel EEG Front-End on ESP32",
  "l3-02-brushless-motor": "Brushless (BLDC) Motor Driver (ESP32)",
  "l3-03-lighting-array": "Multi-Channel Power-LED Lighting Array (ESP32)",
  "l3-04-bms": "Multi-Cell Battery Management System (BMS)",
  "l3-05-wireless-hub": "ESP-NOW Wireless Fleet Hub (ESP32)",
  "bn-01-usb-c-power-meter": "ESP32 USB-C Power Meter",
  "bn-02-dc-electronic-load": "ESP32 DC Electronic Load",
  "bn-03-dds-function-generator": "ESP32 DDS Function Generator",
  "bn-04-curve-tracer": "ESP32 Curve Tracer",
  "bn-05-spot-welder-controller": "ESP32 Spot-Welder Controller",
  "bn-06-tec-thermal-chamber": "ESP32 TEC Thermal Chamber",
};

/** The public title for a lesson slug, or `fallback` (the internal name) if none. */
export function publicTitle(slug: string, fallback?: string): string {
  return PUBLIC_TITLES[slug] ?? fallback ?? slug;
}
