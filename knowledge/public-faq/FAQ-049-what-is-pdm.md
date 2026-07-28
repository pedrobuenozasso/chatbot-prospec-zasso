---
faq_id: FAQ-049
question: "What is PDM?"
status: Done
audience: Customer-facing
evidence_level: High
last_processed: 2026-06-29
last_improved:
---

# What is PDM?

## Short Answer

PDM means pulse-density modulation. It is a power-electronics control method that changes how many active pulses are delivered within a given time window, instead of mainly changing the width of each pulse. In Zasso's context, PDM should be explained as a way to think about controlled average energy or power delivery, not as a standalone guarantee of weed-control efficacy, safety, or one-pass results.

## Detailed Answer

Pulse-density modulation controls output by changing the density of pulses. A higher pulse density means more active pulses occur over a period of time, which generally increases average delivered power or energy. A lower pulse density means fewer active pulses occur over the same period, which generally reduces average delivered power or energy.

This differs from pulse-width modulation, or PWM, where the pulse repetition pattern is often more regular and the main control variable is how long each pulse stays on within a switching cycle. In simple terms, PWM changes the width or duty cycle of pulses; PDM changes how many pulses are delivered. In real power electronics, the two concepts can overlap or be combined, but they are useful customer-safe terms for explaining that modern systems manage electrical delivery over time rather than simply applying a fixed output.

For electrical weeding, PDM is best understood as a control concept within the complete machine. The useful field result depends on the power module, electrodes, contact quality, plant size, weed density, soil moisture, soil conductivity, application speed, safety systems, and operator training. Pulse density may help a power-control architecture regulate average delivery while preserving other electrical characteristics, but the agronomic outcome still depends on validated product design and operating conditions.

Customers do not need to set or interpret PDM values in normal operation. The practical message is that Zasso's technology is designed around controlled energy delivery through a changing plant-soil circuit, rather than around headline voltage alone.

## What This Means for Customers

For customers, PDM helps explain why electrical weeding should not be judged only by peak voltage, peak current, or a single power number. Pulse timing, pulse density, contact time, the changing electrical load, and system protections all influence how energy is delivered during treatment.

The customer benefit is clearer expectation-setting. A controlled system can be designed to adapt delivery within its operating envelope, but performance still depends on using the right product configuration, correct speed, good electrode contact, trained operators, suitable field conditions, and follow-up scouting. PDM is part of the engineering vocabulary behind this control; it is not an instruction for customers to tune the machine themselves.

## Evidence and Context

Zasso's public technology material says the high voltage is modulated in patented power modules and transferred through applicators into plants and soil. That supports describing PDM as part of controlled electrical delivery through the plant-soil pathway rather than as a leaf-only or voltage-only effect: https://zasso.com/technology/

GitHub repository research reviewed for this answer included adjacent FAQ answers on pulsed DC, PWM, impedance matching, voltage, current, power, electrodes, contact time, and the plant-soil circuit. Those answers consistently frame waveform and modulation terms as part of a broader controlled-power architecture.

GitHub repository research also reviewed a Zasso power-electronics note on an IEEE conference paper about a high-frequency voltage-source converter for ozone generation. That note describes PDM as regulating average output power by changing the density of full-voltage pulse groups while preserving peak voltage in a high-voltage discharge load. The note is useful power-electronics context, but it is not weed-control efficacy evidence because the source load is an ozone cell, not a plant-soil system.

SharePoint research found Zasso electrical-weeding guide material and R&D-bibliography items discussing electrical-weeding principles, power-stage control, pulse control, plant resistive circuits, electrode arrangements, and safety context. This supports using PDM as system-level control language while avoiding confidential settings, control logic, thresholds, and unpublished machine data.

Recent Read.AI summaries reviewed for current context included discussions of module enable logic, applicator integration, telemetry, operator training, certification, post-sales support, and product commercialization. These support a customer-facing explanation that keeps pulse-control details inside the validated system and emphasizes trained operation.

Michigan State University Extension describes electrical weed control as high-voltage electricity transferred through an electrode into weeds, with current passing through plant tissue and returning through roots, soil, return electrode, and grounding equipment. GROW IWM similarly describes high-voltage current moving through plant and root tissues into the ground, with plant material acting as a resistor and heating contributing to injury. These sources support explaining PDM in the context of the plant-soil circuit, not as the whole mechanism of control: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control and https://growiwm.org/wp-content/uploads/2025/10/Weed-Electrocution-Factsheet-PDF.pdf

General electronics and power-electronics references describe pulse-density modulation as controlling output by varying pulse density, while PWM controls average output by changing pulse width or duty cycle. These references support the basic distinction, but they do not validate any specific Zasso implementation or field-performance claim.

## Safe Sales Wording

"PDM stands for pulse-density modulation. It is a way of controlling average electrical delivery by changing how many active pulses are delivered over time."

"For customers, the key point is that Zasso uses controlled power electronics as part of a complete electrical-weeding system. Pulse concepts such as PDM, PWM, duty cycle, voltage, current, and power all have to work with electrodes, contact time, soil conditions, safety systems, and operator training."

"PDM is not a standalone weed-control promise. It is part of the engineering language behind controlled energy delivery."

## Caveats

Do not claim that PDM automatically improves weed control, lowers energy use, eliminates fire risk, makes high voltage safe, guarantees root kill, or ensures one-pass results. PDM is a control method, not an agronomic result by itself.

Do not disclose confidential pulse densities, pulse timing, pulse widths, frequencies, voltage or current limits, converter topology, firmware logic, module-control strategy, fault thresholds, telemetry behavior, measured waveforms, unpublished trial data, customer-specific results, supplier information, certification details, or pricing.

Different Zasso products may use different internal electronics and control architectures. Customer-facing language should stay at the concept level and defer to product manuals, training, labels, safety procedures, and local regulatory requirements.

