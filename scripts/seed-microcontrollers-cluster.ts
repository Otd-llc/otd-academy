// Seeds the Microcontrollers cluster of public /library mini-lessons (docs/plans/
// 2026-07-09-microcontrollers-library-cluster.md + the parallel-authoring handoff).
// Generic textbook education: the microcontroller field in general, with the ESP32
// as the worked example, not the only subject. Cited per claim, beginner bar.
// cluster = "microcontrollers"; clusterOrdinal = list order within the cluster.
//
// Content lives in the PROD DB; this committed seed is the reviewable source and
// re-runs idempotently (upsert on the unique slug). Diagram `image` blocks point
// at their PLANNED /guide-diagrams/mcu-*.svg registry key; they render caption-
// only until the diagram-export sandbox phase builds those components + rasters
// (same key, so no re-seed for figures).
//
// Voice: otd-content-writing house rules (no em-dashes; answer-first; no
// antithesis flourish; `code` chips for pin names, values, and units). Assessment:
// 3 options, real same-register distractors, answer key spread, no math in stems.
// Academy = generic only (no coined vocabulary, no paid-build values).
//
// Run:
//   npx tsx scripts/seed-microcontrollers-cluster.ts --check   (validate blocks, NO DB)
//   npx tsx scripts/seed-microcontrollers-cluster.ts           (seed PROD)
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import katex from "katex";
import { guideContentBlocksSchema, type ContentBlock } from "@/lib/schemas/guide";
import { LIBRARY_BLOCK_TYPES } from "@/lib/library/block-allowlist";
import { PDF_SAIRA_FALLBACK } from "@/lib/pdf/pdf-fallback-set";
import { pdfGlyphIssues } from "@/lib/pdf/pdf-glyph-coverage";
import { revalidate } from "./lib/revalidate";

const BYLINE = "One Thousand Drones engineering team · verified 2026-07";
const VERIFIED_AT = new Date("2026-07-09T00:00:00.000Z");

type Lesson = {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  clusterOrdinal: number;
  contentBlocks: ContentBlock[];
};

const LESSONS: Lesson[] = [
  // ── 0. what-is-a-microcontroller ─────────────────────────────────────────
  {
    slug: "what-is-a-microcontroller",
    title: "What is a microcontroller?",
    seoTitle: "What is a microcontroller? CPU, memory, and peripherals on one chip",
    seoDescription:
      "A microcontroller is a whole small computer on one chip: a CPU, memory, and built-in peripherals that run one program to sense and control the world.",
    clusterOrdinal: 0,
    contentBlocks: [
      { type: "prose", md: "A microcontroller is a whole small computer on a single chip: a processor, its memory, and a set of built-in peripherals, all on one piece of silicon. It runs one program, on its own, to sense and control the physical world. The ESP32 on a One Thousand Drones board is a microcontroller, and this whole library is about getting the most out of one." },
      { type: "heading", text: "What is on the chip?" },
      { type: "prose", md: "Four things share the die. The CPU executes your program. RAM is fast working memory that holds variables while the chip runs, and forgets everything at power-off. Flash is non-volatile memory that stores the firmware, so the program survives a power cycle. And the peripherals are dedicated hardware blocks for talking to the world: GPIO pins, an ADC, timers, and serial buses. A desktop computer spreads those across many parts; a microcontroller puts them on one chip." },
      { type: "heading", text: "How is it different from a PC processor?" },
      { type: "prose", md: "A PC processor is one part of a large system, with separate RAM sticks, a separate drive, and an operating system sitting between your program and the hardware. A microcontroller integrates its memory and peripherals on-die, runs a single program directly on the metal, starts in milliseconds, and sips power measured in milliamps. It trades raw speed for integration, real-time control, and low power, which is exactly what a small connected device needs." },
      { type: "heading", text: "Bare-metal or an RTOS" },
      { type: "prose", md: "Firmware runs one of two ways. Bare-metal means your code is the only thing running, usually one endless loop. Or it runs on a small real-time operating system (an RTOS) that schedules several tasks and juggles them. The ESP32's default framework ships `FreeRTOS`, so even a simple program runs as a task under it, which is worth knowing the first time you meet a task or a delay call." },
      { type: "deepDive", summary: "Why the ESP32-S3 specifically", body: "The ESP32-S3 packs a lot onto one part: two Xtensa CPU cores, a Wi-Fi and Bluetooth Low Energy radio, native USB, and the usual GPIO, ADC, timers, and serial peripherals. That is why one chip can be the entire computer, radio, and input-output of a small connected device, with almost nothing else on the board but power and connectors. The concepts in this library are generic to microcontrollers; the ESP32-S3 is just the specific part we work them on. (Espressif ESP32-S3 datasheet)" },
      { type: "sourceRef", label: "Espressif. ESP32-S3 Series Datasheet (system overview, on-chip CPU, memory, and peripherals).", href: "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf" },
      { type: "image", src: "/guide-diagrams/mcu-block-diagram.svg", alt: "A microcontroller block diagram: CPU, RAM, and flash inside the chip, wired to peripheral blocks (GPIO, ADC, timers, serial) that reach the outside world.", caption: "One chip: a CPU, its memory, and the peripherals that connect it to the world." },
      { type: "prose", md: "On a One Thousand Drones L1.01 board the ESP32-S3 module is the whole computer. Everything else on the board just feeds it power and breaks its pins out to headers you can wire to." },
      { type: "quiz", questions: [
        { q: "What makes a microcontroller different from a typical PC processor?", options: ["It always runs faster than a desktop CPU", "Its memory and peripherals are built onto the same chip", "It needs a separate operating-system disk to start"], answer: 1, explain: "A microcontroller integrates RAM, flash, and peripherals on one die; a PC CPU relies on separate parts and an OS." },
        { q: "Which of these is NOT normally built into a microcontroller?", options: ["Flash memory that holds its program", "Timers and GPIO pins", "A removable hard drive"], answer: 2, explain: "Storage and peripherals are on-chip; there is no removable drive on a microcontroller." },
        { q: "A microcontroller is best described as what?", options: ["A whole small computer on one chip", "A processor that needs external RAM and storage chips to run", "A memory chip that stores data but cannot run a program"], answer: 0, explain: "A microcontroller integrates the processor, memory, and peripherals on one chip; a bare microprocessor needs external RAM and storage, and a memory chip has no processor." },
      ] },
      { type: "sourceRef", label: "Next: GPIO, reading and driving pins", href: "/library/esp32-gpio" },
    ],
  },

  // ── 1. esp32-gpio ────────────────────────────────────────────────────────
  {
    slug: "esp32-gpio",
    title: "GPIO: reading and driving pins",
    seoTitle: "ESP32 GPIO explained: inputs, outputs, and pull-up resistors",
    seoDescription:
      "How a GPIO pin drives a line high or low or reads a button or sensor, why a floating input misbehaves, and what a pull-up resistor does. With ESP32 3.3 V examples.",
    clusterOrdinal: 1,
    contentBlocks: [
      { type: "prose", md: "A GPIO pin, for general-purpose input/output, is a microcontroller's connection to the outside world. Set it as an output to drive a wire high or low and light an LED or switch something on. Set it as an input to read a button or a sensor line. You pick the direction, then you read or write." },
      { type: "heading", text: "Output: driving a pin high or low" },
      { type: "prose", md: "As an output, the pin connects internally either to the chip's supply, `3.3 V`, for a high, or to ground, `0 V`, for a low. That is enough to light an LED, switch a transistor, or send a signal to another chip. But each pin can only source or sink a limited current, on the order of tens of milliamps, so drive small loads directly and put a transistor between the pin and anything larger. Over-draw a pin and you damage it." },
      { type: "heading", text: "Input: reading a level" },
      { type: "prose", md: "As an input, the pin reports whether the voltage on it sits above or below a threshold, returning a high or a low. The catch is a pin connected to nothing: it floats, picking up stray noise, and reads high and low at random. So any input that is not always driven by something needs a resistor to hold it at a known level when idle." },
      { type: "heading", text: "Pull-ups and pull-downs" },
      { type: "prose", md: "A pull resistor ties an undriven input to a default level. A pull-up connects the pin to `3.3 V`, so it reads high until something actively pulls it low. A pull-down connects it to ground, so it reads low until something pulls it high. A button wired to ground with a pull-up is the classic input: high when released, low when pressed. The ESP32 has internal pull-ups and pull-downs you switch on in firmware, so you often need no external resistor at all." },
      { type: "math", tex: "I = \\frac{V_{pull}}{R}", plain: "I = Vpull / R", display: true },
      { type: "prose", md: "That current matters: a `10 kΩ` pull-up on a `3.3 V` rail passes about `0.33 mA` while the line is held low, which is why a weak (larger) pull-up saves power and a strong (smaller) one resists noise better. It is Ohm's law on the pull resistor." },
      { type: "deepDive", summary: "3.3 V logic, and why 5 V can kill a pin", body: "The ESP32's pins are `3.3 V` logic and are not 5 V tolerant. Feed a `5 V` signal straight into an input and you can damage the pin, because it drives current into the chip's internal protection. If you need to read a `5 V` line, level-shift it, or divide it down with a voltage divider first, so the pin never sees more than about `3.3 V`. Outputs, in turn, only ever swing between `0 V` and `3.3 V`, which is worth remembering when driving a part that expects a taller `5 V` logic high." },
      { type: "calculator", slug: "led-series-resistor", caption: "Size the series resistor when a 3.3 V GPIO drives an LED." },
      { type: "image", src: "/guide-diagrams/mcu-gpio-in-out.svg", alt: "A GPIO pin as an output driving an LED through a resistor, and the same kind of pin as an input reading a button with a pull-up resistor.", caption: "One pin, two directions: driving an LED as an output, reading a button as an input." },
      { type: "sourceRef", label: "Espressif. ESP-IDF Programming Guide: GPIO (input/output, internal pull-ups and pull-downs).", href: "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/gpio.html" },
      { type: "sourceRef", label: "SparkFun. Pull-up Resistors tutorial (why a floating input needs a pull).", href: "https://learn.sparkfun.com/tutorials/pull-up-resistors" },
      { type: "prose", md: "On a One Thousand Drones L1.01 board a GPIO drives the on-board LED through a resistor, and the BOOT button pulls a pin to ground, exactly the output and input patterns above." },
      { type: "quiz", questions: [
        { q: "Before you read or drive a GPIO pin, what must you set?", options: ["Its fixed output voltage", "Its resistance in ohms", "Its direction: input or output"], answer: 2, explain: "A GPIO is general-purpose; you configure it as an input or an output first, then read or write it. You do not dial in a voltage or a resistance." },
        { q: "Why does a floating input pin (connected to nothing) misbehave?", options: ["It picks up stray noise and reads an unpredictable level", "It always draws too much current", "It can never be reconfigured as an output"], answer: 0, explain: "With nothing driving it, the pin floats and reads high or low at random; a pull resistor fixes it." },
        { q: "What does an internal pull-up resistor do to an input pin?", options: ["Increases the pin's output current", "Holds it at a known high level until something pulls it low", "Converts the pin to an analog input"], answer: 1, explain: "A pull-up ties the idle pin to 3.3 V so it reads high until a button or line pulls it low." },
      ] },
      { type: "sourceRef", label: "Prerequisite: diodes and LEDs", href: "/library/diodes-and-leds" },
      { type: "sourceRef", label: "Calculate it: the LED series resistor calculator", href: "/tools/led-series-resistor" },
      { type: "sourceRef", label: "Next: the ADC, reading an analog voltage", href: "/library/esp32-adc" },
    ],
  },

  // ── 2. esp32-adc ─────────────────────────────────────────────────────────
  {
    slug: "esp32-adc",
    title: "The ADC: reading an analog voltage",
    seoTitle: "ESP32 ADC explained: resolution, reference, and attenuation",
    seoDescription:
      "How an ADC turns a voltage into a number, what resolution and reference voltage set, and how the ESP32's attenuation stretches its range toward 3.3 V. With a divider calculator.",
    clusterOrdinal: 2,
    contentBlocks: [
      { type: "prose", md: "An ADC, for analog-to-digital converter, turns a voltage into a number the program can read. Its resolution sets how finely it splits the range, its reference sets the top of that range, and on the ESP32 an attenuation setting stretches the range toward the `3.3 V` rail. A plain GPIO reads only high or low; the ADC reads everything in between." },
      { type: "heading", text: "Resolution: bits become steps" },
      { type: "prose", md: "An ADC with `N` bits splits its input range into two-to-the-`N` steps. The ESP32's is 12-bit, so it splits the range into `4096` steps. Each step is the smallest voltage change the converter can tell apart, its least-significant bit, or LSB. More bits mean finer steps and a more precise reading." },
      { type: "math", tex: "V_{LSB} = \\frac{V_{ref}}{2^N}", plain: "Vlsb = Vref / 2^N", display: true },
      { type: "heading", text: "Reference and range" },
      { type: "prose", md: "The reference voltage is the input that reads full scale, the very top step. The ESP32's raw ADC range is small (its internal reference is about `1.1 V`), so it offers attenuation settings that scale the incoming voltage down first, which extends the usable input range to roughly `0` to `3.1 V` at the highest attenuation, close to the rail (ESP32-S3 datasheet, ADC characteristics). Pick the attenuation for the voltage you expect to measure, and the reading uses the whole range instead of a sliver of it." },
      { type: "sourceRef", label: "Espressif. ESP32-S3 Series Datasheet (ADC characteristics: attenuation and measurable input range).", href: "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf" },
      { type: "heading", text: "Scaling a bigger voltage in" },
      { type: "prose", md: "To read a voltage above the ADC's range, a battery above the rail for instance, put a voltage divider in front of the input to bring it down into range. The ADC pin draws almost no current, which is exactly the light, high-impedance load a divider needs to hold its ratio. Scale the voltage down by a known fraction, read it, and multiply back in firmware." },
      { type: "calculator", slug: "voltage-divider", caption: "Scale a higher voltage down into the ESP32's ADC range." },
      { type: "deepDive", summary: "Cleaning up the reading in firmware", body: "The raw number an ADC hands back jitters a little, from electrical noise and the converter's own offset. Two cheap habits fix it. First, average: read the pin several times in a row and take the mean, and the random jitter shrinks. Second, calibrate: measure the known error once against a trusted meter, store it, and correct every future reading. Espressif's ESP-IDF ships an ADC calibration API for exactly this, so the hardware sets the ballpark and a few lines of firmware make it accurate. This is the same averaging idea the voltage-dividers guide uses." },
      { type: "sourceRef", label: "Espressif. ESP-IDF Programming Guide: ADC Oneshot Mode (attenuation config, ADC calibration API).", href: "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/adc/adc_oneshot.html" },
      { type: "image", src: "/guide-diagrams/mcu-adc-quantize.svg", alt: "A smooth input voltage being converted into discrete numbered steps by an ADC, with the reference voltage marking the top full-scale step.", caption: "A voltage becomes a number: the reference marks full scale, the bits set the step size." },
      { type: "sourceRef", label: "SparkFun. Analog to Digital Conversion tutorial (resolution and reference voltage).", href: "https://learn.sparkfun.com/tutorials/analog-to-digital-conversion" },
      { type: "quiz", questions: [
        { q: "What sets the top of an ADC's input range?", options: ["The number of bits it has", "Its reference voltage, and on the ESP32 the attenuation setting", "The length of the wire to the sensor"], answer: 1, explain: "The reference (scaled by the ESP32's attenuation) sets full scale; the bit count sets how fine each step is, while the reference sets the top." },
        { q: "A 12-bit ADC splits its input range into how many steps?", options: ["4096", "12", "144"], answer: 0, explain: "Two to the twelfth is 4096 steps." },
        { q: "To read a voltage higher than the ADC's range, what do you add in front of it?", options: ["A larger battery", "A second ADC", "A voltage divider to scale it down"], answer: 2, explain: "A divider brings the voltage into range, and the high-impedance ADC input is the light load a divider needs." },
      ] },
      { type: "sourceRef", label: "Prerequisite: voltage dividers", href: "/library/voltage-dividers" },
      { type: "sourceRef", label: "Calculate it: the voltage divider calculator", href: "/tools/voltage-divider" },
      { type: "sourceRef", label: "Next: PWM, a fake analog output", href: "/library/esp32-pwm" },
    ],
  },

  // ── 3. esp32-pwm ─────────────────────────────────────────────────────────
  {
    slug: "esp32-pwm",
    title: "PWM: a fake analog output",
    seoTitle: "PWM explained: duty cycle, frequency, and the ESP32 LEDC",
    seoDescription:
      "How switching a digital pin on and off fast, with a controllable duty cycle, averages to an in-between level. The way one pin dims an LED or sets a motor's speed.",
    clusterOrdinal: 3,
    contentBlocks: [
      { type: "prose", md: "A microcontroller pin is digital: it can only be fully on or fully off. But switch it on and off fast, with a controllable on-fraction, and it averages to a level in between. That is PWM, for pulse-width modulation, and it is how one digital pin dims an LED or sets a motor's speed without any analog output hardware." },
      { type: "heading", text: "Duty cycle: the on-fraction" },
      { type: "prose", md: "The duty cycle is the fraction of each cycle the pin spends high. At 25 percent duty the output averages a quarter of the supply; at 75 percent, three-quarters. Sweep the duty cycle and the average voltage follows it smoothly, which is the whole trick." },
      { type: "math", tex: "V_{avg} = D \\cdot V_{supply}", plain: "Vavg = D x Vsupply", display: true },
      { type: "heading", text: "Frequency: fast enough to blur" },
      { type: "prose", md: "The switching frequency has to be fast enough that whatever you are driving cannot follow the individual pulses. Your eye blurs a fast-blinking LED into a steady brightness; a motor's inertia smooths the pulses into a steady pull. Too slow, and the LED visibly flickers or the motor whines at the switching rate. Fast enough, and only the average shows." },
      { type: "heading", text: "What PWM drives" },
      { type: "prose", md: "PWM sets LED brightness, motor speed, a servo's position (through a specific pulse width), a buzzer's tone, and, once you smooth it with an RC filter, a rough analog voltage. On the ESP32 the `LEDC` peripheral generates PWM in hardware on any output pin, so your code just sets a duty cycle and the hardware toggles the pin at the frequency you chose, with no CPU effort per pulse." },
      { type: "sourceRef", label: "Espressif. ESP-IDF Programming Guide: LED Control (LEDC) PWM peripheral.", href: "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/ledc.html" },
      { type: "sourceRef", label: "SparkFun. Pulse Width Modulation tutorial (duty cycle and average level).", href: "https://learn.sparkfun.com/tutorials/pulse-width-modulation" },
      { type: "deepDive", summary: "Duty-cycle resolution, and its trade with frequency", body: "The duty cycle is not truly continuous: it is set as a count out of two-to-the-bits, an ADC in reverse. A higher PWM resolution gives finer brightness or speed steps, but on the ESP32 the resolution and the frequency both come from dividing one source clock, so they trade against each other. Push the frequency very high and you are left with fewer usable duty-cycle bits; drop it and you get more. For LED dimming a few kilohertz with 10 or more bits is plenty; a fast switching converter would flip the balance the other way." },
      { type: "image", src: "/guide-diagrams/mcu-pwm-duty.svg", alt: "Three PWM waveforms at 25, 50, and 75 percent duty cycle, each with a dashed line showing the averaged output level rising with the duty.", caption: "Three duty cycles and the average each one produces: the on-fraction sets the level." },
      { type: "prose", md: "The fundamentals guide on reactive parts and filtering shows the RC low-pass that averages a PWM signal into a real, steady voltage, if you want the analog output rather than just the blinking." },
      { type: "quiz", questions: [
        { q: "What sets a PWM output's average level?", options: ["Its duty cycle, the on-fraction of each period", "The height of each pulse above the supply", "The switching frequency alone"], answer: 0, explain: "The average tracks the duty cycle. The pulses only ever reach the supply voltage, and the frequency just has to be fast enough that the load sees the average." },
        { q: "Why must the PWM frequency be fast enough?", options: ["To save battery", "To use fewer pins", "So the load cannot follow the individual pulses and instead sees the average"], answer: 2, explain: "If the load can follow the pulses, you get flicker or whine instead of a smooth in-between level." },
        { q: "A hobby servo's position is set by what kind of PWM signal?", options: ["A specific frequency", "A specific pulse width", "A specific voltage"], answer: 1, explain: "Servos read the width of the high pulse, roughly 1 to 2 ms. The frequency and voltage stay fixed; the pulse width is what carries the position." },
      ] },
      { type: "sourceRef", label: "Prerequisite: reactive parts and filtering", href: "/library/reactive-and-filtering" },
      { type: "sourceRef", label: "Next: boot and strapping pins", href: "/library/esp32-boot-strapping-pins" },
    ],
  },

  // ── 4. esp32-boot-strapping-pins ─────────────────────────────────────────
  {
    slug: "esp32-boot-strapping-pins",
    title: "Boot and strapping pins",
    seoTitle: "ESP32 boot mode and strapping pins explained",
    seoDescription:
      "At reset the ESP32 reads a few strapping pins to decide how to boot. Why a stray pull on one can stop a board booting, and which pins to keep free.",
    clusterOrdinal: 4,
    contentBlocks: [
      { type: "prose", md: "When the ESP32 comes out of reset, before it runs a line of your code, it reads a handful of strapping pins to decide how to boot: run the firmware in flash, or wait in the bootloader to be flashed. If your circuit holds one of those pins the wrong way at that instant, the board will not boot. A few pins are effectively sacred, and it pays to know which." },
      { type: "heading", text: "What a strapping pin is" },
      { type: "prose", md: "A strapping pin is an ordinary GPIO that the chip samples once, at the moment of reset, to read a configuration choice. After that instant it goes back to being a normal pin you can use however you like. But the level it happens to sit at during that sample is latched, so whatever your circuit does to it at power-up is what the chip acts on." },
      { type: "heading", text: "Run mode versus download mode" },
      { type: "prose", md: "The key strapping choice is the boot mode. Left at its default level, the chip loads and runs the firmware already in flash. Held the other way, on the ESP32 the boot pin pulled low at reset, it enters the download bootloader and waits for a flashing tool to send a new program. That is exactly what pressing the `BOOT` button does while you reset the board." },
      { type: "sourceRef", label: "Espressif. esptool documentation: Boot Mode Selection (strapping pins, download vs run).", href: "https://docs.espressif.com/projects/esptool/en/latest/esp32s3/advanced-topics/boot-mode-selection.html" },
      { type: "heading", text: "Why a stray pull bricks boot" },
      { type: "prose", md: "Hang a hard pull-up or pull-down, an LED, or a sensor that drives the line onto a strapping pin, and you can override its boot-mode level at reset. The chip then boots the wrong way, or hangs, and the board looks dead even though it is fine. The fix is discipline: keep strapping pins free of hard pulls, or use them only for signals that are safely idle at reset. Check the datasheet's strapping-pin table before you assign one." },
      { type: "sourceRef", label: "Espressif. ESP32-S3 Series Datasheet (strapping pins and their reset-time levels).", href: "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf" },
      { type: "deepDive", summary: "The auto-reset circuit: why you don't press buttons to flash", body: "On most ESP32 boards you never touch a button to upload, thanks to a small circuit. The USB-to-serial bridge's `DTR` and `RTS` handshake lines are cross-wired, through two transistors, to the chip's reset (`EN`) pin and its boot strapping pin. The flashing tool wiggles those two lines in the right order to drop the chip into the bootloader and reset it, then lets it run again afterward. That is why esptool seems to flash on its own, and why a broken or missing auto-reset circuit means flashing by hand with the BOOT button." },
      { type: "image", src: "/guide-diagrams/mcu-strapping-boot.svg", alt: "The ESP32 sampling its strapping pins at reset, branching to two outcomes: run the firmware in flash, or enter the download bootloader.", caption: "At reset the chip reads the strapping pins and picks one of two boot paths." },
      { type: "quiz", questions: [
        { q: "When does the ESP32 read its strapping pins?", options: ["Continuously while it runs", "Only when you press a key on your keyboard", "Once, at reset, before your code runs"], answer: 2, explain: "The level is sampled and latched at reset; after that the pins are ordinary GPIO again." },
        { q: "Why can a resistor on the wrong pin stop an ESP32 from booting?", options: ["It draws too much power for the regulator", "It can override a strapping pin's boot-mode level at reset", "It slows the system clock down"], answer: 1, explain: "A hard pull on a strapping pin changes the level the chip latches at reset, so it boots the wrong way." },
        { q: "What does holding the BOOT pin low during reset do?", options: ["Puts the chip into its download bootloader to be flashed", "Permanently erases the firmware", "Overclocks the CPU"], answer: 0, explain: "That strapping level selects download mode, where the bootloader waits for a flashing tool." },
      ] },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build (its boot and reset circuit)", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: flashing firmware", href: "/library/esp32-flashing-firmware" },
    ],
  },

  // ── 5. esp32-flashing-firmware ───────────────────────────────────────────
  {
    slug: "esp32-flashing-firmware",
    title: "Flashing firmware",
    seoTitle: "Flashing ESP32 firmware: the bootloader and esptool",
    seoDescription:
      "How your compiled program gets into a microcontroller: the ESP32 enters its bootloader, esptool sends the binary over USB, and the next reset runs it.",
    clusterOrdinal: 5,
    contentBlocks: [
      { type: "prose", md: "Flashing is how your compiled program gets into the microcontroller. The ESP32 enters its bootloader over USB, a tool sends the binary across, the tool writes it into flash, and the next reset runs it. That load-and-go loop is the same every time you hit upload, and understanding it turns most flashing problems from mysteries into checklists." },
      { type: "heading", text: "From source to binary" },
      { type: "prose", md: "Your code compiles to a binary image: the exact bytes the chip will execute. Flashing writes that image to a fixed address in the ESP32's flash memory, where it survives power-off. On the next reset, the tiny bootloader baked into the chip's ROM finds the image, loads it, and jumps into it. Change your code, recompile, reflash, and the loop repeats." },
      { type: "heading", text: "The bootloader and esptool" },
      { type: "prose", md: "To accept a new image the chip must be in download mode, set by the boot strapping pin from the last lesson. Then `esptool`, Espressif's flashing tool, talks to the ROM bootloader over USB or a serial UART and streams the binary in. The ESP32-S3 has native USB built into the chip, so it can be flashed straight over a USB-C cable with no separate USB-to-serial part in the path at all." },
      { type: "sourceRef", label: "Espressif. esptool documentation (flashing over USB/UART, the ROM bootloader).", href: "https://docs.espressif.com/projects/esptool/en/latest/esp32s3/" },
      { type: "heading", text: "Addresses, partitions, and erasing" },
      { type: "prose", md: "Flash is divided into partitions: the second-stage bootloader, a partition table that maps the rest, your application, and often a data area for stored settings. Each lives at its own address, which is why a flash command usually lists several files with offsets. Erasing flash wipes all of it back to blank, which clears a bad image or stale stored data so you can start from a known-clean chip." },
      { type: "deepDive", summary: "Why even a blank chip still needs the bootloader flashed", body: "The second-stage bootloader and the partition table live in flash right alongside your app, so a truly blank chip has all three written at once (that is what the multi-file flash command is doing). The very first stage, the one that receives the flash in the first place, is a small bootloader fixed in the chip's ROM at the factory and cannot be changed or erased. That ROM bootloader is your safety net: even if you erase everything and flash a broken image, you can always drop back into it and try again. (Espressif ESP-IDF)" },
      { type: "sourceRef", label: "Espressif. ESP-IDF Programming Guide: Get Started (build, flash, and monitor).", href: "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/get-started/index.html" },
      { type: "image", src: "/guide-diagrams/mcu-flash-loop.svg", alt: "The flashing loop: source code compiled to a binary, esptool sending it over USB into the bootloader, written to flash, then run on reset.", caption: "Compile, send over USB to the bootloader, write to flash, run on reset." },
      { type: "callout", severity: "info", label: "You usually don't need to press buttons", body: "On most ESP32 boards the flashing tool drives the reset and boot pins for you through the auto-reset circuit, so you just run the upload and it works. If a flash refuses to start, force download mode by hand: hold `BOOT`, tap and release reset, then release `BOOT`, and try the flash again." },
      { type: "quiz", questions: [
        { q: "What must the ESP32 be in to accept a firmware flash?", options: ["Deep sleep", "Its bootloader (download mode)", "Full-speed run mode"], answer: 1, explain: "The strapping pin selects download mode, where the ROM bootloader listens for the flashing tool." },
        { q: "What does 'erase flash' do?", options: ["Wipes the flash back to blank, clearing the image and stored data", "Deletes the chip's ROM bootloader permanently", "Turns off the CPU"], answer: 0, explain: "It clears flash to a known-blank state; the ROM bootloader is fixed and untouched." },
        { q: "How can an ESP32-S3 be flashed without a separate USB-to-serial chip?", options: ["Only over Wi-Fi", "It cannot be, one is always required", "It has native USB, so a USB cable reaches the bootloader directly"], answer: 2, explain: "The S3's built-in USB lets a plain USB cable talk to the ROM bootloader with no bridge chip." },
      ] },
      { type: "sourceRef", label: "Prerequisite: boot and strapping pins", href: "/library/esp32-boot-strapping-pins" },
      { type: "sourceRef", label: "Next: clocks and timers", href: "/library/mcu-clocks-and-timers" },
    ],
  },

  // ── 6. mcu-clocks-and-timers ─────────────────────────────────────────────
  {
    slug: "mcu-clocks-and-timers",
    title: "Clocks and timers",
    seoTitle: "Microcontroller clocks and timers explained",
    seoDescription:
      "A clock paces everything a microcontroller does, and timers count that clock to measure time or fire on a schedule. How a board blinks at 1 Hz or samples at exactly 250 Hz.",
    clusterOrdinal: 6,
    contentBlocks: [
      { type: "prose", md: "Everything a microcontroller does is paced by a clock: a steady stream of pulses that steps the processor forward one tick at a time. Timers are hardware counters that count those pulses, so the chip can measure elapsed time and trigger events on an exact schedule. Together they are how a board blinks at `1 Hz` or samples a sensor at exactly `250 Hz`." },
      { type: "heading", text: "The clock sets the pace" },
      { type: "prose", md: "The system clock is an oscillator running at a fixed frequency, from a few megahertz to hundreds of megahertz. Every instruction the CPU runs and every peripheral it drives is timed off that clock. A faster clock does more work per second but burns more power, which is one of the first knobs a low-power design turns down when it does not need the speed." },
      { type: "heading", text: "A timer counts ticks" },
      { type: "prose", md: "A timer is a counter wired to the clock, or to a divided-down version of it. It increments on every tick. Read it to measure how much time has passed, or set it to fire an event when it reaches a target count. Because it is counting a known frequency, a count converts straight into a span of time, and a target count converts into a delay." },
      { type: "math", tex: "t = \\frac{N}{f_{clk}}", plain: "t = N / fclk", display: true },
      { type: "prose", md: "A timer that counts `N` ticks of a clock running at `f_clk` has measured `t` seconds. Turn it around, and to get a `1 ms` tick from a `1 MHz` timer clock you count to `1000`." },
      { type: "heading", text: "Periodic events instead of busy-waiting" },
      { type: "prose", md: "To do something at an exact rate, set a timer to fire periodically and let it call you (an interrupt, the next lesson), rather than counting in a loop. A software delay loop blocks the CPU the whole time and drifts, because anything else the code does throws the timing off. A hardware timer keeps time in the background while your code gets on with other work, and its rate is as steady as the clock. The ESP32's general-purpose timers do exactly this." },
      { type: "sourceRef", label: "Espressif. ESP-IDF Programming Guide: General Purpose Timer (GPTimer).", href: "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/gptimer.html" },
      { type: "deepDive", summary: "Why exact timing matters when you sample", body: "A data logger or a sensor front-end needs its samples spaced evenly in time, or the uneven spacing shows up as noise and error in the data later. If you sample inside a plain loop, the spacing wobbles with whatever else the loop is doing that pass. A hardware timer set to the sample rate fixes it: it fires an interrupt every period, and the handler takes exactly one reading, so the spacing is as steady as the clock crystal rather than as steady as your code. That is how a board holds a true `250 Hz` or `1 kHz` sample rate. (Espressif GPTimer)" },
      { type: "image", src: "/guide-diagrams/mcu-timer-count.svg", alt: "A steady clock signal driving a timer counter, which rolls over and fires an event every N ticks on a fixed schedule.", caption: "A timer counts clock ticks and fires every N of them, keeping an exact rate." },
      { type: "quiz", questions: [
        { q: "How does a board sample a sensor at an exact rate?", options: ["A timer counts the clock and fires periodically", "It reads as fast as the main loop happens to come around", "It uses more memory"], answer: 0, explain: "A hardware timer paces the samples off the clock, so the spacing stays exact." },
        { q: "What paces everything a microcontroller does?", options: ["The supply voltage", "Its system clock", "The number of GPIO pins"], answer: 1, explain: "The clock steps the CPU and peripherals; its frequency sets the speed." },
        { q: "Why is a hardware timer better than a software delay loop for timing?", options: ["It uses less flash memory", "It reads more cleanly in the code", "It keeps time in the background without blocking the CPU, and does not drift"], answer: 2, explain: "A delay loop ties up the CPU and drifts; a timer counts the clock independently and stays exact." },
      ] },
      { type: "sourceRef", label: "Next: interrupts", href: "/library/mcu-interrupts" },
    ],
  },

  // ── 7. mcu-interrupts ────────────────────────────────────────────────────
  {
    slug: "mcu-interrupts",
    title: "Interrupts",
    seoTitle: "Microcontroller interrupts explained: ISRs vs polling",
    seoDescription:
      "Instead of polling a pin over and over, an interrupt lets the hardware call your code the instant something happens. Why the handler must be short, and what can trigger one.",
    clusterOrdinal: 7,
    contentBlocks: [
      { type: "prose", md: "Instead of constantly asking has it happened yet, an interrupt lets the hardware call your code the instant something happens. It is how a board reacts to a button press or a sensor's data-ready line right away, without wasting cycles endlessly checking a pin that has not changed." },
      { type: "heading", text: "Polling versus interrupts" },
      { type: "prose", md: "Polling means looping and reading a pin over and over, waiting for it to change. You catch the event only as often as the loop comes back around, and between checks you burn the CPU on nothing useful. An interrupt flips that around: the hardware watches for the event, and the moment it fires, it jumps the CPU straight into a handler. No wasted checking, and a near-instant response." },
      { type: "heading", text: "The ISR: short and fast" },
      { type: "prose", md: "The handler is an interrupt service routine, an ISR. It runs immediately, cutting in on whatever the CPU was doing, so it has to be short. Set a flag, grab one reading, nudge a counter, then return and let the main code do the slow work when it gets to it. A long ISR blocks everything else while it runs, including other interrupts, which is how a board starts dropping events or stuttering." },
      { type: "heading", text: "What can interrupt" },
      { type: "prose", md: "The common sources are a GPIO edge (a button, or a sensor's data-ready line), a timer reaching its target count (the last lesson), or a peripheral finishing a transfer. On the ESP32 you attach an interrupt to a GPIO and name the function to run when that pin sees a rising or a falling edge, and the chip handles the rest." },
      { type: "sourceRef", label: "Espressif. ESP-IDF Programming Guide: GPIO (interrupt service, edge triggers).", href: "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/gpio.html" },
      { type: "sourceRef", label: "SparkFun. Processor Interrupts tutorial (interrupts versus polling).", href: "https://learn.sparkfun.com/tutorials/processor-interrupts-with-arduino" },
      { type: "deepDive", summary: "Debouncing: keep the messy decision out of the ISR", body: "A mechanical button does not make one clean edge when you press it; its contacts bounce, throwing several fast edges from a single press. A raw GPIO interrupt will fire on each one, so one press looks like five. The standard fix is to have the ISR do almost nothing: just record a flag or a timestamp and return. The main loop then debounces it, ignoring repeat triggers that land within a few milliseconds of the first. The button still interrupts instantly, but the timing judgement lives in slow, ordinary code where it belongs, and the ISR stays short." },
      { type: "image", src: "/guide-diagrams/mcu-poll-vs-interrupt.svg", alt: "Two paths compared: a polling loop repeatedly checking a pin, versus an event directly triggering an interrupt service routine.", caption: "Polling checks over and over; an interrupt calls the handler the moment the event fires." },
      { type: "quiz", questions: [
        { q: "What is the advantage of an interrupt over polling?", options: ["It uses less flash memory", "It makes the system clock faster", "It reacts instantly without wasting cycles checking"], answer: 2, explain: "The hardware calls your code on the event, so there is no wasted polling and the response is immediate." },
        { q: "Why must an interrupt service routine (ISR) be short?", options: ["It cuts in on everything else, so a long ISR blocks the rest of the system", "Long functions will not compile inside an ISR", "It runs on a separate chip with little memory"], answer: 0, explain: "An ISR pre-empts the running code and other interrupts, so it must finish fast and defer slow work." },
        { q: "A bouncing mechanical button is usually handled how?", options: ["By making the ISR longer so it waits out the bounce", "By having the ISR set a flag and letting the main loop debounce it", "By removing the pull-up resistor"], answer: 1, explain: "The ISR stays short (flag or timestamp); the main loop ignores repeats within a few milliseconds." },
      ] },
      { type: "sourceRef", label: "Prerequisite: GPIO, reading and driving pins", href: "/library/esp32-gpio" },
      { type: "sourceRef", label: "Related: clocks and timers", href: "/library/mcu-clocks-and-timers" },
      { type: "sourceRef", label: "Next: the on-chip comms peripherals", href: "/library/mcu-comms-peripherals" },
    ],
  },

  // ── 8. mcu-comms-peripherals ─────────────────────────────────────────────
  {
    slug: "mcu-comms-peripherals",
    title: "The on-chip comms peripherals",
    seoTitle: "On-chip UART, SPI, and I2C peripherals explained",
    seoDescription:
      "The UART, SPI, and I2C buses live inside a microcontroller as hardware peripherals that clock the bits out for you. Why that beats bit-banging, and how pin muxing works.",
    clusterOrdinal: 8,
    contentBlocks: [
      { type: "prose", md: "The serial buses a board uses to talk to sensors and other chips, `UART`, `SPI`, and `I2C`, live inside the microcontroller as hardware peripherals. You configure a block, hand it your data, and it clocks the bits out with exact timing. The chip does the hard, fast part so your code does not have to." },
      { type: "heading", text: "Hardware peripheral versus bit-banging" },
      { type: "prose", md: "You could toggle a plain GPIO up and down in software to imitate a bus, which is called bit-banging. It works, but it ties up the CPU for every bit and the timing is only ever as steady as your code. A hardware peripheral is a dedicated block that generates the clock and shifts the bits itself, so it frees the CPU and gets the timing exactly right, and far faster than software could." },
      { type: "heading", text: "The three common buses" },
      { type: "prose", md: "`UART` is a simple two-wire link (transmit and receive) with no shared clock, used for consoles and many modules. `SPI` is a fast bus with a shared clock, data in and out, and a chip-select line per device, used for displays and precision ADCs. `I2C` is a two-wire bus (a clock and a data line) that addresses many chips on the same pair, used for small sensors. The ESP32 has hardware blocks for all three." },
      { type: "sourceRef", label: "Espressif. ESP-IDF Programming Guide: Peripherals API (UART, SPI, I2C blocks).", href: "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/index.html" },
      { type: "heading", text: "Pin muxing: route a block to your pins" },
      { type: "prose", md: "The ESP32 does not hard-wire each peripheral to fixed pins. A pin mux, short for multiplexer, lets you route a peripheral's signals out to almost any GPIO you choose, so you pick pins that suit your board layout and then assign the bus to them in firmware. Watch the usual caveats when you choose: keep a bus off the strapping pins and off the pins reserved for USB or the on-module flash." },
      { type: "deepDive", summary: "Why hardware timing wins for a fast bus", body: "At a few megahertz, an `SPI` clock edge comes every few hundred nanoseconds, faster than a software loop can reliably toggle a pin while doing anything else at all. The hardware peripheral clocks it out of a buffer with no jitter, and on the ESP32 it can hand off to DMA so a whole block of data moves between memory and the bus with the CPU barely involved. Bit-banging simply cannot keep that pace, which is why the hardware blocks exist. (Espressif ESP-IDF peripherals)" },
      { type: "image", src: "/guide-diagrams/mcu-peripheral-mux.svg", alt: "An SPI hardware peripheral block inside the chip, its clock, data, and chip-select signals routed through a pin mux out to chosen GPIO pins.", caption: "A hardware bus block, routed through the pin mux to whichever GPIO you pick." },
      { type: "prose", md: "Choosing which pins carry a bus ties straight into reading the pinout, which is the next lesson: some pins can take a peripheral cleanly, and some carry reset-time or USB duties you must not disturb." },
      { type: "quiz", questions: [
        { q: "Why use a hardware SPI peripheral instead of bit-banging the bus in code?", options: ["It needs fewer wires than software", "The hardware handles the exact timing and frees the CPU", "It works without using any pins at all"], answer: 1, explain: "A dedicated block clocks the bits out precisely and fast, leaving the CPU free for other work." },
        { q: "What does the ESP32's pin mux let you do?", options: ["Raise the supply voltage to the peripheral", "Add more flash memory", "Route a peripheral's signals out to pins of your choosing"], answer: 2, explain: "The mux maps a peripheral onto most any GPIO, so you pick pins that fit your layout." },
        { q: "Bit-banging a bus in software has what drawback?", options: ["It ties up the CPU and the timing is only as steady as the code", "It cannot use GPIO pins", "It always requires an external ADC"], answer: 0, explain: "Software toggling costs CPU time per bit and jitters, which a hardware peripheral avoids." },
      ] },
      { type: "sourceRef", label: "Related: reading the ESP32 pinout", href: "/library/esp32-pinout" },
      { type: "sourceRef", label: "Next: power modes and sleep", href: "/library/esp32-sleep-modes" },
    ],
  },

  // ── 9. esp32-sleep-modes ─────────────────────────────────────────────────
  {
    slug: "esp32-sleep-modes",
    title: "Power modes and sleep",
    seoTitle: "ESP32 sleep modes explained: light sleep, deep sleep, battery life",
    seoDescription:
      "Sleep modes shut down parts of a microcontroller to cut current from milliamps to microamps. Why sleep current dominates battery life, with a runtime calculator.",
    clusterOrdinal: 9,
    contentBlocks: [
      { type: "prose", md: "A microcontroller does not have to run flat out. Sleep modes shut down parts of the chip to cut its current from milliamps down to microamps, and on a battery that is the difference between hours and months. A board that spends almost all of its time asleep can run for a very long time on a small cell." },
      { type: "heading", text: "Active, light sleep, deep sleep" },
      { type: "prose", md: "In active mode the CPU and radio run and the chip draws the most current. Light sleep pauses the CPU but keeps its state and memory alive, so it wakes quickly and picks up where it left off. Deep sleep powers down almost everything, keeping only a tiny always-on domain, which drops the current to microamps but loses most of the chip's state, so it effectively restarts on wake. Each step trades responsiveness for lower current." },
      { type: "sourceRef", label: "Espressif. ESP-IDF Programming Guide: Sleep Modes (light sleep, deep sleep, wake sources).", href: "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/system/sleep_modes.html" },
      { type: "heading", text: "What wakes it" },
      { type: "prose", md: "A sleeping chip wakes on a source you configure ahead of time: a timer after a set interval, a pin changing level, or a peripheral event. A typical sensor node deep-sleeps on a timer, wakes, takes a reading, sends it over the radio, and goes back to sleep, spending a few milliseconds awake for every several seconds asleep." },
      { type: "heading", text: "Why sleep dominates battery life" },
      { type: "prose", md: "When a board is awake for a few milliseconds and asleep for seconds at a stretch, the sleep current sets the average almost by itself, and the brief active current barely counts. Halving the deep-sleep current can nearly double the runtime, while shaving the active current barely moves the needle. That is why low-power design chases deeper, more frequent sleep; slowing the CPU down barely helps." },
      { type: "math", tex: "I_{avg} = \\frac{I_{active}\\, t_{active} + I_{sleep}\\, t_{sleep}}{t_{active} + t_{sleep}}", plain: "Iavg = (Iactive x tactive + Isleep x tsleep) / (tactive + tsleep)", display: true },
      { type: "calculator", slug: "lipo-battery-runtime", caption: "Estimate runtime from battery capacity and average current." },
      { type: "deepDive", summary: "What stays powered in deep sleep", body: "On the ESP32 a small low-power domain stays alive through deep sleep: an RTC timer to keep time and wake the chip, a little RTC memory, and a few RTC-capable GPIOs that can serve as wake pins. Everything else, the main cores and most peripherals, is powered off, which is where the microamp current comes from. Because normal RAM is lost, you stash the handful of bytes you need to survive the restart (a counter, a state flag) in that RTC memory, and read them back on wake. (Espressif ESP-IDF sleep modes)" },
      { type: "image", src: "/guide-diagrams/mcu-sleep-current.svg", alt: "A current-versus-time trace of a wake-measure-sleep cycle: a brief tall active spike, then a long flat microamp sleep floor, repeating.", caption: "A wake-measure-sleep cycle: the long, low sleep floor is what sets the battery life." },
      { type: "quiz", questions: [
        { q: "What mostly determines a battery board's life if it sleeps most of the time?", options: ["Its sleep (idle) current", "Its peak active current alone", "Its CPU clock speed while awake"], answer: 0, explain: "With the board asleep most of the time, the average current, and so the runtime, is set by the sleep current the board sits at almost all the time. The brief awake current and the clock speed barely add to it." },
        { q: "What is the main trade-off of deep sleep versus light sleep?", options: ["Deep sleep is always faster to wake from", "Deep sleep uses far less current but loses most state and restarts on wake", "Deep sleep keeps the radio fully powered"], answer: 1, explain: "Deep sleep saves the most current by powering down almost everything, at the cost of losing state." },
        { q: "What can wake a sleeping ESP32?", options: ["Only physically unplugging and replugging it", "Nothing, once it is asleep it stays asleep", "A timer, a pin change, or a peripheral event"], answer: 2, explain: "You configure a wake source before sleeping: a timer, a wake pin, or a peripheral event." },
      ] },
      { type: "sourceRef", label: "Calculate it: the LiPo battery runtime calculator", href: "/tools/lipo-battery-runtime" },
      { type: "sourceRef", label: "Next: reading the ESP32 pinout", href: "/library/esp32-pinout" },
    ],
  },

  // ── 10. esp32-pinout ─────────────────────────────────────────────────────
  {
    slug: "esp32-pinout",
    title: "Reading the ESP32 pinout",
    seoTitle: "Reading the ESP32 pinout: strapping, ADC, USB, and input-only pins",
    seoDescription:
      "Not every pin can do every job: some are input-only, some are strapping, some are tied to USB or the ADC. How to read the pinout before you wire, and pick the right pin.",
    clusterOrdinal: 10,
    contentBlocks: [
      { type: "prose", md: "Not every pin on a microcontroller can do every job. Some can only read, some are sampled at reset as strapping pins, some are tied to USB or to the chip's flash, and some reach only one of the ADC blocks. Reading the pinout before you wire a board saves you from a design that cannot work, or a re-spin to fix it. The rule is simple: match each function to a pin that can actually do it." },
      { type: "heading", text: "The pinout is the map" },
      { type: "prose", md: "The datasheet's pinout, and a board's printed pin diagram, list every pin with what it is allowed to be: a plain GPIO, an ADC channel, a strapping pin, a USB line, a power or ground pin, and so on. Before assigning a signal to a pin, check the map that the pin actually supports that job. It is two minutes that saves a bad board." },
      { type: "sourceRef", label: "Espressif. ESP32-S3 Series Datasheet (pin definitions and per-pin functions).", href: "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf" },
      { type: "heading", text: "Pins with restrictions" },
      { type: "prose", md: "Several kinds need care. On many microcontrollers some pins are input-only: they can read a signal but never drive an output. The original ESP32's `GPIO34` to `GPIO39` are the classic example; the ESP32-S3 happens to have none, so the caution moves to its other reserved pins. Strapping pins must be free at reset, or the board will not boot (an earlier lesson in this cluster). The native USB pins are spoken for if you use USB. On a module with built-in flash or PSRAM, the pins wired to that memory are reserved and off-limits. And only some pins reach the ADC. Everything else is a general-purpose pin you can assign freely." },
      { type: "heading", text: "A which-pin-for-which-job checklist" },
      { type: "prose", md: "Put an output on a full GPIO, never on an input-only pin on a chip that has them. Keep hard pulls and always-driven signals off the strapping pins. Land an analog input on an ADC-capable pin, and prefer the `ADC1` pins so a running Wi-Fi radio does not clash with your reading. Leave the USB pins and the on-module flash pins alone. Then confirm each choice against the pinout one more time before you route the board." },
      { type: "sourceRef", label: "Espressif. ESP32-S3-DevKitC-1 User Guide (a real board's pin Name/Function tables, flash-reserved pins).", href: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html" },
      { type: "deepDive", summary: "Why ADC2 fights the Wi-Fi radio", body: "The ESP32 has two ADC blocks, and one of them, `ADC2`, is also used by the Wi-Fi driver. When Wi-Fi is running, an `ADC2` reading can fail or be made to wait, so a sensor sampled on an ADC2 pin returns garbage or stalls exactly when the board is connected. The fix is a pin choice: put any analog input that has to work while connected on an `ADC1` pin, and the clash never happens. It is a classic 'why is my sensor fine on the bench but broken over Wi-Fi' trap, and reading the pinout up front avoids it." },
      { type: "sourceRef", label: "Espressif. ESP-IDF Programming Guide: ADC Oneshot Mode (ADC2 is also used by Wi-Fi).", href: "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/adc/adc_oneshot.html" },
      { type: "image", src: "/guide-diagrams/mcu-pinout-map.svg", alt: "An annotated ESP32-S3 pin map with the strapping pins, ADC-capable pins, USB pair, and flash-reserved pins each flagged with their own marker.", caption: "The pinout as a map: strapping, ADC, USB, and flash-reserved pins each flagged before you wire." },
      { type: "callout", severity: "info", label: "Read the pinout before you route the board", body: "Two minutes with the pin map before you assign signals saves a board re-spin. On your schematic, flag the strapping pins, the USB pair, the on-module flash pins, and the `ADC1` pins first, then wire your signals to what is left. It turns pin selection from a source of subtle bugs into a checklist." },
      { type: "quiz", questions: [
        { q: "Why check the pinout before assigning a function to a pin?", options: ["To make the board layout look neater", "Because pins are all identical, so it never matters", "Because some pins are input-only, strapping, or reserved for USB or the ADC"], answer: 2, explain: "Pins differ: a strapping, input-only, or USB pin cannot take an arbitrary function." },
        { q: "An input-only pin can do what?", options: ["Read a signal but never drive an output", "Drive high-current loads directly", "Only carry power, never signals"], answer: 0, explain: "Input-only pins read a level but have no output driver, so never assign an output to one." },
        { q: "Why prefer an ADC1 pin for an analog input on a Wi-Fi board?", options: ["ADC1 samples much faster than ADC2", "The other ADC block is shared with Wi-Fi and can fail while connected", "ADC1 always has more bits of resolution"], answer: 1, explain: "ADC2 is shared with the Wi-Fi driver, so readings on it can fail while connected; ADC1 avoids the clash. The two blocks match in speed and resolution." },
      ] },
      { type: "sourceRef", label: "Prerequisite: reading a datasheet", href: "/library/reading-a-datasheet" },
      { type: "sourceRef", label: "Related: the ADC, reading an analog voltage", href: "/library/esp32-adc" },
      { type: "sourceRef", label: "Related: boot and strapping pins", href: "/library/esp32-boot-strapping-pins" },
    ],
  },
];

// ── validation (no DB) ──────────────────────────────────────────────────────
function validate(): void {
  const EM_DASH = "—";
  let ok = true;
  const answerPositions: number[] = [];
  for (const l of LESSONS) {
    const parsed = guideContentBlocksSchema.safeParse(l.contentBlocks);
    if (!parsed.success) {
      ok = false;
      console.error(`[${l.slug}] INVALID blocks:`, JSON.stringify(parsed.error.issues, null, 2));
      continue;
    }
    for (const b of l.contentBlocks) {
      if (!LIBRARY_BLOCK_TYPES.has(b.type)) {
        ok = false;
        console.error(`[${l.slug}] non-library block type: ${b.type}`);
      }
      if (b.type === "quiz") for (const q of b.questions) answerPositions.push(q.answer);
      if (b.type === "math") {
        try {
          katex.renderToString(b.tex, { throwOnError: true });
        } catch (e) {
          ok = false;
          console.error(`[${l.slug}] BAD LaTeX \`${b.tex}\`: ${(e as Error).message}`);
        }
      }
    }
    if (JSON.stringify(l).includes(EM_DASH)) {
      ok = false;
      console.error(`[${l.slug}] CONTAINS EM-DASH`);
    }
    // Every glyph in the content must render in the field-guide PDF (a body face
    // has it, or the render fallback set + Saira do). Catches a symbol that would
    // .notdef-box in print before it ships. See pdf-glyphs.test.ts for the twin
    // guard over the tool registry.
    for (const g of pdfGlyphIssues(JSON.stringify(l.contentBlocks), PDF_SAIRA_FALLBACK)) {
      ok = false;
      console.error(`[${l.slug}] PDF-unrenderable glyph "${g.char}" (${g.codepoint}) — ${g.kind}`);
    }
  }
  const spread = answerPositions.reduce<Record<number, number>>((m, a) => ((m[a] = (m[a] ?? 0) + 1), m), {});
  console.log(`answer-key spread across ${answerPositions.length} questions:`, JSON.stringify(spread));
  if (!ok) process.exit(1);
  console.log(`validated ${LESSONS.length} lessons OK`);
}

// ── seed (PROD) ─────────────────────────────────────────────────────────────
async function seed(): Promise<void> {
  const { db } = await import("@/lib/db");
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No ADMIN user found to own the lessons");
  for (const l of LESSONS) {
    const row = await db.miniLesson.upsert({
      where: { slug: l.slug },
      update: {
        title: l.title,
        summary: l.seoDescription,
        contentBlocks: l.contentBlocks,
        seoTitle: l.seoTitle,
        seoDescription: l.seoDescription,
        byline: BYLINE,
        lastVerifiedAt: VERIFIED_AT,
        cluster: "microcontrollers",
        clusterOrdinal: l.clusterOrdinal,
        published: true,
        accessTier: "PUBLIC",
      },
      create: {
        slug: l.slug,
        title: l.title,
        summary: l.seoDescription,
        contentBlocks: l.contentBlocks,
        seoTitle: l.seoTitle,
        seoDescription: l.seoDescription,
        byline: BYLINE,
        lastVerifiedAt: VERIFIED_AT,
        cluster: "microcontrollers",
        clusterOrdinal: l.clusterOrdinal,
        published: true,
        accessTier: "PUBLIC",
        createdById: admin.id,
      },
      select: { slug: true, clusterOrdinal: true },
    });
    console.log(`seeded ${row.slug} (clusterOrdinal ${row.clusterOrdinal})`);
  }
}

if (process.argv.includes("--check")) {
  validate();
  process.exit(0);
}
validate();
seed()
  .then(async () => {
    // A whole-cluster seed rewrites every lesson in the cluster, so the broad tag
    // is the honest scope -- listing the slugs would be a longer way of saying
    // the same thing. No-ops on a local write.
    //
    // AWAITED before process.exit: an unawaited fetch would be killed by the exit
    // before the request left, and the call would silently never happen.
    await revalidate({ tags: ["mini-lessons"] });
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
