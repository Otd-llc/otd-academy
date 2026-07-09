# Library cluster blueprint: Microcontrollers & the ESP32

**Status: DRAFT for review / authoring brief (2026-07-09).** Nothing seeded. Fundamentals
pattern + parallel handoff. Generic textbook education only (the general MCU field + the ESP32 as
the worked example; no proprietary/paid-build detail). Per-lesson: **thesis · beats · cite
(verify) · diagram · quiz · links.**

**key:** `microcontrollers` · **label:** "Microcontrollers & ESP32" ·
**blurb:** "What a microcontroller is, and how the ESP32 reads pins, sensors, and time."

**Why:** the core MCU reference behind every ESP32 course; strong SEO ("ESP32 GPIO", "ESP32 ADC",
"ESP32 boot mode", "esptool flashing", "ESP32 deep sleep").

**Slug prefix:** `mcu-` / `esp32-` / topic slugs; grep first (the ADC/pins overlap Fundamentals).

---

## Lessons (11)

### 01 · What is a microcontroller?
- **thesis:** A microcontroller is a whole small computer on one chip: a CPU, memory (RAM + flash), and a set of built-in peripherals (GPIO, ADC, timers, serial). It runs one program, forever, to sense and control the physical world.
- **beats:** CPU + RAM + flash + peripherals on one die; MCU vs a PC CPU (integrated, real-time, low power); firmware runs bare or on an RTOS; the ESP32-S3 as the example (dual-core + Wi-Fi/BT + USB).
- **cite:** an MCU-basics reference + the ESP32-S3 datasheet overview (Espressif).
- **diagram:** an MCU block (CPU, RAM, flash, peripherals) with the outside world on GPIO.
- **quiz:** what makes a microcontroller different from a PC CPU? (memory + peripherals are on-chip; it runs one real-time program)
- **links:** SUPPORTING → every ESP32 course.

### 02 · GPIO — reading & driving pins
- **thesis:** A GPIO pin is the MCU's hands: set it an output to drive a line high or low (light an LED), or an input to read a button or sensor line. Configure the direction, then read or write.
- **beats:** input vs output; drive high/low; reading a level; internal pull-ups/downs; drive strength/current limits (don't over-draw a pin); a pin is 3.3 V logic on the ESP32.
- **cite:** the ESP32 GPIO reference (ESP-IDF) + a GPIO basics primer.
- **diagram:** a pin as output (driving an LED) vs input (reading a button + pull-up).
- **quiz:** what do you set before reading or driving a GPIO? (its direction: input or output)
- **links:** prereq Fundamentals "diodes and LEDs" (driving an LED); Comms cluster 09 (pull-ups).

### 03 · The ADC — reading an analog voltage
- **thesis:** An ADC turns a voltage into a number the MCU can read. Its resolution sets the fineness, its reference sets the top of the range, and on the ESP32 an attenuation setting stretches that range toward the rail. (Ties to Fundamentals voltage-dividers.)
- **beats:** analog → digital; resolution (bits → steps); reference voltage = full scale; ESP32 attenuation + the ~0-3.1 V range; noise + averaging (light, ties to the divider lesson's firmware deepDive); scaling a bigger voltage in with a divider.
- **cite:** the ESP-IDF ADC reference (already cited in Fundamentals) + an ADC-basics primer.
- **diagram:** a voltage → ADC → number, with the reference marking full scale.
- **quiz:** what sets the top of an ADC's input range? (its reference voltage / attenuation setting)
- **links:** prereq Fundamentals "voltage dividers"; the ADS1220/ADS1299 precision-ADC courses.

### 04 · PWM — a fake analog output
- **thesis:** An MCU pin is digital, but switching it on and off fast, with a controllable on-fraction (duty cycle), averages to an in-between level. That is PWM: how you dim an LED or set a motor's speed.
- **beats:** duty cycle → average level; frequency (fast enough to not flicker/whine); resolution; uses (LED dimming, motor speed, servo, tone); the ESP32 LEDC peripheral (generically).
- **cite:** an ESP32 PWM/LEDC reference + a PWM basics primer.
- **diagram:** three duty cycles (25/50/75%) and their averaged levels.
- **quiz:** what sets a PWM output's average level? (the duty cycle: the on-fraction of each period)
- **links:** Fundamentals "reactive and filtering" (the RC that averages PWM); the motion track.

### 05 · Boot & strapping pins
- **thesis:** At reset, the ESP32 reads a few "strapping" pins to decide how to boot (run your firmware vs enter the flashing bootloader). If one of those pins is held the wrong way by your circuit, the board won't boot. Know which pins are sacred.
- **beats:** what strapping pins are; the ESP32-S3 boot-mode pins; run vs download(bootloader) mode; why a pull the wrong way bricks boot; keep strapping pins free of hard pulls; the auto-reset/boot circuit (DTR/RTS).
- **cite:** the ESP32-S3 datasheet strapping-pin section (Espressif).
- **diagram:** the strapping pins + the two boot outcomes (run vs download).
- **quiz:** why can a resistor on the wrong pin stop an ESP32 booting? (it overrides a strapping pin's boot-mode level at reset)
- **links:** SUPPORTING → L1.01 (the board's boot/reset circuit); lesson 06.

### 06 · Flashing firmware
- **thesis:** Flashing writes your compiled program into the MCU's flash. The ESP32 enters a bootloader (over USB/UART), a tool like esptool sends the binary, and on the next reset it runs. That is the whole load-and-go loop.
- **beats:** compile → binary → flash; the bootloader (entered via boot pins / auto-reset); esptool over USB/UART; the ESP32-S3 native USB; flash addresses/partitions (light); what "erase flash" does.
- **cite:** the esptool docs (Espressif) + the ESP-IDF flashing guide.
- **diagram:** the flash loop (compile → esptool over USB → bootloader → run).
- **quiz:** what does the ESP32 enter to accept a firmware flash? (its bootloader / download mode)
- **links:** lesson 05 (boot); Comms cluster 06 (USB).

### 07 · Clocks & timers
- **thesis:** Everything an MCU does is paced by a clock, and timers count that clock to measure time or trigger events on a schedule. They are how a board blinks at 1 Hz or samples at exactly 250 Hz.
- **beats:** the system clock (Hz → speed); a timer counts ticks; periodic interrupts (sample at a rate); delays vs timers (don't busy-wait); the ESP32 timers (generically).
- **cite:** an ESP32 timers reference + a timers/clocks primer.
- **diagram:** a clock tick driving a timer that fires every N ticks.
- **quiz:** how does a board sample at an exact rate? (a timer counts the clock and fires periodically)
- **links:** lesson 08 (interrupts).

### 08 · Interrupts
- **thesis:** Instead of constantly checking ("polling") a pin, an interrupt lets the hardware call your code the instant something happens. It is how a board reacts to a button or a data-ready line without wasting cycles.
- **beats:** poll vs interrupt; the ISR (short, fast); interrupt sources (GPIO edge, timer, peripheral data-ready); why an ISR must be quick; debouncing/flags (light); the ESP32 attach-interrupt idea.
- **cite:** an interrupts primer + the ESP32 GPIO-interrupt reference.
- **diagram:** poll-loop vs interrupt (the event calling the ISR directly).
- **quiz:** what's the advantage of an interrupt over polling? (it reacts instantly without wasting cycles checking)
- **links:** lesson 02 (GPIO), lesson 07 (timers).

### 09 · The on-chip comms peripherals
- **thesis:** The UART, SPI, and I2C buses from the Comms cluster live inside the MCU as hardware peripherals: you configure a block, and it clocks the bits out for you. The chip does the timing so your code doesn't have to.
- **beats:** hardware peripheral vs bit-banging; the ESP32 UART/SPI/I2C blocks; pin muxing (route a peripheral to chosen pins); why hardware peripherals beat software timing; picking pins (strapping/ADC caveats).
- **cite:** the ESP-IDF peripherals overview.
- **diagram:** a peripheral block (e.g. SPI) muxed out to chosen GPIO.
- **quiz:** why use the hardware SPI peripheral over bit-banging in code? (the hardware handles the exact timing, freeing the CPU)
- **links:** the whole Comms cluster (02-04); lesson 11 (pinout).

### 10 · Power modes & sleep
- **thesis:** A microcontroller does not have to run flat-out. Sleep modes shut down parts of the chip to cut current from milliamps to microamps, which is the difference between hours and months on a battery.
- **beats:** active vs light-sleep vs deep-sleep; what stays on in each; wake sources (timer, pin); the current-draw difference (mA → uA); why sleep dominates battery life; a wake-measure-sleep loop.
- **cite:** the ESP32 sleep-modes reference (ESP-IDF) + a low-power design note.
- **diagram:** a current-vs-time trace of a wake-measure-sleep cycle (Saira uA/mA readouts).
- **quiz:** what mostly determines a battery board's life? (its sleep/idle current, since it sleeps most of the time)
- **links:** Power cluster 11 (runtime); `/tools` LiPo runtime calc.

### 11 · Reading the ESP32 pinout
- **thesis:** Not every pin is equal: some are input-only, some are strapping pins, some are tied to USB or the ADC. Reading the pinout before you wire saves a board. Match each function to a pin that can actually do it.
- **beats:** the pinout/datasheet as the map; input-only pins; strapping pins to avoid hard-pulling; ADC-capable pins; USB pins; the practical "which pin for which job" checklist.
- **cite:** the ESP32-S3 datasheet pinout + an ESP32 pinout guide.
- **diagram:** an annotated ESP32-S3 pin map (strapping / ADC / USB / input-only flagged).
- **quiz:** why check the pinout before assigning a function to a pin? (some pins are input-only, strapping, or reserved for USB/ADC)
- **links:** prereq Fundamentals "reading a datasheet"; lessons 03, 05.

---

## Open decisions
1. 11 or trim (fold 07 clocks into 08 interrupts).
2. Slugs (grep; ADC/pins overlap Fundamentals — prefix `esp32-`/`mcu-`).
3. Keep the ESP32 as the worked example but the *concepts* generic (rank for both "microcontroller ADC" and "ESP32 ADC").
4. Citations unfetched (no-research); pull on go.
