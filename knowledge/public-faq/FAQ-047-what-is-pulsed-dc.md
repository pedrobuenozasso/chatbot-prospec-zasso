---
faq_id: FAQ-047
question: "What is pulsed DC?"
status: Done
audience: Customer-facing
evidence_level: High
last_processed: 2026-06-29
last_improved:
---

# What is pulsed DC?

## Short Answer

Pulsed DC means direct-current electrical energy delivered in repeated pulses or bursts rather than as one uninterrupted steady output. The current or voltage may rise and fall over time, but the treatment-side polarity does not reverse in the way alternating current does. In electrical weeding, pulsed DC should be explained as one possible way to control timing, dose, peak levels, duty cycle, and power delivery through the plant-soil circuit.

## Detailed Answer

Direct current, or DC, means that electrical charge flows mainly in one direction through the selected path. Pulsed DC keeps that one-direction character, but the output is switched, modulated, or delivered in intervals. In simple terms, the system is on for a short time, off or lower for a short time, and then on again, while keeping the same polarity unless the machine intentionally changes it.

The important pulse parameters are peak voltage or current, pulse width, frequency or period, duty cycle, rise and fall time, pulse count, contact time, and the difference between peak, average, and effective values. A low average reading can still include high instantaneous peaks, and two treatments with the same average value can behave differently if their pulse width, duty cycle, contact quality, and plant-soil load are different.

For electrical weeding, pulsed DC is not a magic waveform by itself. The plant, electrode, soil, moisture, weed density, and machine speed form a changing electrical load. A pulsed output may help a control system manage energy delivery, switching losses, heating intervals, component stress, and diagnostics, but the field result still depends on the complete Zasso system: power electronics, electrodes, contact time, safety architecture, training, setup, and operating conditions.

Customer-facing wording should therefore avoid turning pulsed DC into a standalone performance claim. It is better described as a controlled electrical-delivery concept: high-voltage energy can be shaped over time while maintaining a direct-current treatment direction, so the system can manage dose and safety within its designed operating envelope.

## What This Means for Customers

For customers, pulsed DC matters because it helps explain why electrical weeding is controlled by more than headline voltage. Pulse timing and duty cycle influence how much useful energy is available during electrode contact, how the plant-soil circuit responds, and how the system manages changing field loads.

It also helps set realistic expectations. Pulsed DC does not automatically mean better weed control, lower energy use, or safer operation in every situation. Customers should focus on validated product configuration, operator training, correct application speed, good electrode contact, suitable plant and soil conditions, and Zasso's product-specific safety procedures.

## Evidence and Context

Zasso's public technology page describes high-voltage electricity generated locally, modulated by patented power modules, and transferred through applicators into plants and soil. This supports explaining the value as controlled energy delivery through the plant-soil pathway rather than as a waveform label alone: https://zasso.com/technology/

GitHub repository research reviewed for this answer included adjacent FAQ answers on AC/DC, voltage peaks, voltage, current, power, impedance matching, contact time, and the plant-soil circuit. These answers consistently frame waveform terms as part of a broader controlled electrical-weeding architecture.

GitHub concept notes reviewed for this answer included Direct Current, Pulsed Voltage, and Pulsed Current. They define DC as one-directional current, pulsed voltage/current as time-separated active intervals, and pulse interpretation through peak values, pulse width, frequency, duty cycle, average or RMS values, contact duration, source impedance, and discharge state.

SharePoint research reviewed the internal electrical-weeding guide, including sections on technology evolution, frequency influence, PWM and PDM control examples, harmonic voltage peak limitation, AC/DC comparison, plant resistive circuits, electrode arrangements, and high-voltage safety. This supports the answer's emphasis on controlled power delivery, pulse timing, safety, and field-condition dependency while avoiding confidential settings or control logic.

Recent Read.AI summaries reviewed for current context included discussions of module enable logic, applicator integration, platform control, telemetry, operator training, certification, post-sales support, and field performance. These sources support describing pulsed DC as part of a controlled professional system without disclosing private engineering details.

Michigan State University Extension explains electrical weed control as high-voltage electricity transferred through an electrode into weeds, with current passing through plant tissue and returning through roots, soil, return electrode, and grounding equipment. This supports explaining pulsed DC through current path, contact, and dose rather than waveform alone: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control

GROW's weed electrocution factsheet similarly describes high-voltage current moving through plant and root tissues into the ground, with plant material acting as a resistor and heating as a key injury mechanism. This supports the plant-soil-circuit explanation for customers: https://growiwm.org/wp-content/uploads/2025/10/Weed-Electrocution-Factsheet-PDF.pdf

General electronics references define duty cycle as the active fraction of a period and PWM as a method for controlling average delivered voltage, current, or power by switching a signal on and off. These are useful concepts for explaining pulsed DC, but they should not be treated as direct validation of any specific Zasso pulse strategy.

## Safe Sales Wording

"Pulsed DC means direct-current energy delivered in controlled pulses rather than as one continuous output. The polarity remains DC-like, while timing, duty cycle, and power delivery can be managed by the system."

"For customers, the key point is not the pulse label by itself. It is that Zasso uses controlled power electronics, electrodes, contact time, and safety systems to manage energy delivery through the plant-soil circuit."

"Pulse settings are part of the product design and validation. In the field, customers should follow the approved machine setup, operating speed, safety distance, and training guidance for the specific product."

## Caveats

Do not claim that pulsed DC is always superior to continuous DC or AC. Do not claim that pulsed DC automatically guarantees better weed control, lower energy consumption, lower fire risk, complete root kill, one-pass results, or inherent safety.

Do not disclose confidential pulse widths, duty cycles, frequencies, voltage or current limits, PWM or PDM strategies, module architecture, converter topology, control algorithms, fault thresholds, firmware behavior, certification details, telemetry, unpublished test data, customer-specific results, supplier information, or pricing.

Different Zasso products may use different internal power-conversion stages. Customer-facing language should distinguish internal electronics from the treatment-side concept and should always defer to product-specific manuals, training, labels, and local requirements.

