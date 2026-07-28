---
faq_id: FAQ-048
question: "What is PWM?"
status: Done
audience: Customer-facing
evidence_level: High
last_processed: 2026-06-29
last_improved:
---

# What is PWM?

## Short Answer

PWM means pulse-width modulation. It is a power-electronics control method that switches an electrical signal on and off very quickly and changes the "on" time, or duty cycle, to control average voltage, current, power, or energy delivery. In Zasso's context, PWM should be explained as one possible control technique inside a broader electrical-weeding system, not as a standalone guarantee of weed-control performance.

## Detailed Answer

Pulse-width modulation controls a switched output by changing how long each pulse stays active during a repeating cycle. If the pulse is active for a larger share of the cycle, the average delivered value usually increases. If it is active for a smaller share of the cycle, the average delivered value usually decreases. This active share is called duty cycle.

In ordinary electronics, PWM is widely used in switching power supplies, motor drives, lighting controls, and power converters because it can regulate output efficiently. Instead of wasting energy through a continuously variable resistor or linear element, a switch is driven between on and off states, and the load or output stage responds to the resulting pulse train.

In electrical weeding, the same basic idea must be handled carefully. A plant, electrode, cable, soil return path, and power module are not a simple laboratory load. The real treatment effect depends on contact quality, plant size, soil moisture, conductivity, machine speed, current path, safety controls, and the validated product design. PWM may help a control system shape or regulate energy delivery, but the result still depends on the complete machine and field conditions.

For customer-facing discussions, PWM is best described as a control concept behind managed power delivery. It helps explain why headline voltage alone is not enough: timing, duty cycle, current, contact time, load response, and protection behavior also matter.

## What This Means for Customers

For customers, PWM matters because it shows that modern electrical weeding is controlled power delivery, not simply "more voltage equals better control." A system can use switching and duty-cycle control to manage how electrical energy is generated, shaped, limited, or delivered within the equipment's designed operating envelope.

This does not mean customers need to set or interpret PWM values in the field. Operators should follow the approved product setup, speed guidance, electrode-contact requirements, safety distances, maintenance rules, and training procedures for the specific Zasso machine. The practical outcome comes from correct application of the whole system.

## Evidence and Context

Zasso's public technology page describes high-voltage electricity generated locally, modulated by patented power modules, and transferred through applicators into plants and soil. This supports explaining PWM and related modulation terms as part of controlled energy delivery rather than as isolated performance labels: https://zasso.com/technology/

GitHub repository research reviewed for this answer included the adjacent FAQ on pulsed DC, the Pulse-width modulation concept note, the Pulsed Current concept note, and the Power Modulation Techniques white paper. These sources consistently frame PWM through duty cycle, pulse width, switching frequency, average output, converter behavior, load response, heating, EMI, sensing, and protection limits.

SharePoint research reviewed the internal electrical-weeding guide, including technology evolution, frequency influence, PWM and PDM examples, harmonic voltage peak limitation, power-stage control, plant resistive circuits, electrode arrangements, and safety context. This supports the answer's emphasis on system-level power control while avoiding confidential settings or control logic.

Recent Read.AI summaries reviewed for current context included module enable logic, applicator integration, telemetry, operator training, certification, and post-sales support. These support the need to explain PWM as one technical control concept within a trained, validated professional system, without disclosing private engineering details.

Microchip's PWM documentation explains that PWM switches between on and off states and that duty cycle controls the average output over a period. Texas Instruments PWM control materials similarly describe fixed-frequency PWM and the use of sawtooth or triangle comparisons to modulate output pulses. These sources support the general electronics definition of PWM: https://developerhelp.microchip.com/xwiki/bin/view/applications/motors/control-algorithms/zsm/pwm/ and https://www.ti.com/lit/gpn/TL594

Michigan State University Extension explains electrical weed control as high-voltage electricity transferred through an electrode into weeds, with current passing through plant tissue and returning through roots, soil, return electrode, and grounding equipment. GROW IWM similarly describes high-voltage current moving through plant and root tissues into the ground, where plant material acts as a resistor and heating contributes to injury. These sources support the plant-soil-circuit context for why PWM alone should not be treated as the full treatment explanation: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control and https://growiwm.org/wp-content/uploads/2025/10/Weed-Electrocution-Factsheet-PDF.pdf

## Safe Sales Wording

"PWM stands for pulse-width modulation. It is a way for power electronics to control average output by changing how long each pulse is active within a switching cycle."

"In Zasso equipment, terms like PWM, duty cycle, voltage, current, and power all sit inside a broader controlled energy-delivery system. The customer benefit comes from the validated machine, electrodes, controls, training, and field setup working together."

"PWM is not something we present as a standalone performance promise. It is part of the engineering language behind controlled electrical delivery."

## Caveats

Do not claim that PWM automatically improves weed control, reduces energy consumption, eliminates fire risk, makes high voltage safe, guarantees root kill, or ensures one-pass control. PWM is a control method, not an agronomic result by itself.

Do not disclose confidential PWM duty cycles, frequencies, pulse widths, converter topology, firmware logic, module-control strategy, fault thresholds, telemetry behavior, measured waveforms, unpublished trial data, customer-specific results, supplier information, certification details, or pricing.

Different Zasso products may use different internal electronics and control architectures. Customer-facing language should stay at the concept level and defer to product manuals, training, labels, and local regulatory requirements.

