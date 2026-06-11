// L1.01 bring-up test — ESP32-S3 USB-C breakout (l1-01-wroom-breakout)
//
// Proves the board is alive end-to-end: the 3V3 rail, native-USB enumeration +
// USB-CDC serial (no USB-UART bridge), the toolchain, and the user-LED GPIO.
//
// Toolchain: Arduino-ESP32 core. Select an ESP32-S3 board (e.g. "ESP32S3 Dev
// Module"), and enable **USB CDC On Boot** so `Serial` runs over the native
// USB-C port. First flash: hold BOOT, tap EN (reset), release BOOT.
//
// NOTE: USER_LED is the GPIO the board wires LED2 (the user LED) to. On the
// L1.01 reference that's IO2 (GPIO2) — set to match if you re-pin it.

const int USER_LED = 2;  // IO2 — the reference design's LED2 net

void setup() {
  pinMode(USER_LED, OUTPUT);
  Serial.begin(115200);  // USB-CDC over the native USB-C port (no bridge)
  delay(300);
  Serial.println();
  Serial.println("OTD Academy - L1.01 WROOM breakout bring-up");
  Serial.printf("Chip:  %s  rev %d  (%d cores)\n",
                ESP.getChipModel(), ESP.getChipRevision(), ESP.getChipCores());
  Serial.printf("Flash: %u bytes\n", ESP.getFlashChipSize());
  Serial.println("If you can read this over USB-C and the LED blinks, the board is alive.");
}

void loop() {
  digitalWrite(USER_LED, HIGH);
  delay(500);
  digitalWrite(USER_LED, LOW);
  delay(500);
  Serial.println("blink");
}
