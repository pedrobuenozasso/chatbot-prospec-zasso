---
faq_id: FAQ-051
question: "Does frequency affect efficacy?"
status: Done
audience: Customer-facing
evidence_level: Medium
last_processed: 2026-06-29
last_improved:
---

# Does frequency affect efficacy?

## Short Answer

Frequency can affect efficacy, but it should not be treated as a simple "higher is better" setting. In electrical weeding, the biological result depends on useful energy being delivered through the plant-soil circuit, and frequency is only one part of that delivery together with voltage, current, power, waveform, contact time, electrode contact, plant condition, soil moisture, and application speed. Zasso should describe frequency as an engineering variable that can influence system behavior, not as a standalone guarantee of weed control.

## Detailed Answer

Electrical weeding works by creating an electrical path through contacted plant tissue and the surrounding plant-soil system. The plant and soil behave as a changing biological and electrical load: contact quality, plant size, plant water content, root system, weed density, soil moisture, soil conductivity, residue, and travel speed can all change how much useful energy reaches the target.

Frequency matters because it can influence how electrical energy is shaped and transferred over time. In AC or pulsed systems, frequency is related to waveform timing, duty cycle, pulse spacing, voltage peaks, transformer behavior, power-electronics design, insulation stress, and the way a variable load is controlled. In that sense, frequency can affect practical efficacy indirectly, because it can affect power delivery, stability, contact response, and the machine's ability to manage changing field conditions.

However, frequency alone does not determine weed-control performance. A system with a technically interesting frequency can still underperform if electrode contact is poor, the plant is too large or too dry, the soil path is unfavorable, travel speed is too high, the dose is insufficient, or the target plant is partly shielded by other biomass. Conversely, a well-designed system can use frequency, pulse control, and power regulation as part of a complete electrical architecture without customers needing to evaluate or adjust frequency directly.

For customer-facing language, the safest position is that frequency is one engineering parameter inside the validated Zasso system. It may matter to design, safety, reliability, power conversion, and energy delivery, but expected field results should be discussed in terms of the complete product, application protocol, crop or market, target weeds, soil conditions, speed, training, and follow-up scouting.

## What This Means for Customers

Customers should not buy or compare electrical weeding systems only by quoted frequency. The more useful question is whether the complete system is designed, tested, supported, and operated to deliver controlled energy into the target vegetation under the customer's conditions.

In practice, efficacy depends on matching the right Zasso product and applicator to the job, maintaining good electrode contact, using suitable operating speed, treating weeds at the right stage where possible, respecting soil and weather limits, and following product-specific training and safety procedures. Frequency may be important inside the machine, but it is not normally an operator setting or a sales promise by itself.

This framing also helps avoid unrealistic expectations. Frequency-related design can support controlled energy delivery, but it does not remove the need for good agronomy, trained operation, equipment maintenance, or repeat applications where regrowth, later germination, dense biomass, perennial roots, or difficult field conditions require follow-up.

## Evidence and Context

Zasso's public technology material explains that high-voltage electricity is generated locally, transferred through applicators into plants and soil, and modulated in patented power modules. This supports explaining frequency and waveform as part of controlled energy delivery through the plant-soil circuit rather than as a standalone outcome claim: https://zasso.com/technology/

GitHub repository research reviewed adjacent FAQ answers on AC/DC, pulsed DC, PWM, PDM, voltage, current, power, impedance, impedance matching, pulse control, contact time, electrodes, soil moisture, soil conductivity, and application speed. Those materials consistently support the conclusion that efficacy depends on the full electrical and agronomic system, not on any single parameter.

SharePoint research reviewed Zasso's internal Electrical Weeding guide. Relevant sections include frequency influence in efficacy, electronic weeding circuits, PWM and PDM examples, harmonic voltage-peak limitation, high-frequency transformers, AC/DC comparisons, plant resistive circuits, electrode arrangements, and safety. The guide supports treating frequency as a real engineering factor while keeping customer-facing claims at the concept level and avoiding confidential settings, thresholds, converter topology, or control logic.

Recent Read.AI meeting summaries reviewed for current context emphasized module enable logic, applicator integration, telemetry, training, certification, post-sales support, and commercialization. These summaries reinforce that customer-facing explanations should put frequency inside validated product design, operator training, and support processes, not present it as an adjustable customer benefit on its own.

External integrated weed-management sources also support a multi-factor efficacy explanation. GROW IWM describes electrical weed control as electricity passing through plant and root tissue into the ground, with effectiveness influenced by weed density, species, plant moisture, soil moisture, travel speed, and other field factors: https://growiwm.org/weed-electrocution/. Michigan State University Extension similarly describes high-voltage electricity moving through the plant, roots, soil, return electrode, and grounding equipment, emphasizing the plant-soil pathway and operating context: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control.

A public electrical-weed-management guide notes that frequency is specifically relevant in AC systems, that electronic control can create more complex waveforms such as pulsed DC, and that voltage, current, and power must be interpreted together. This supports conservative wording that frequency may affect system behavior but should not be isolated from delivered energy, waveform, current path, and safety design: https://w.merfield.com/research/2024/a-comprehensive-guide-to-electrical-weed-management-2024-merfield-ffc.pdf

Field-efficacy research in the Zasso repository, including the organic soybean electrical-discharge paper summarized in the vault, also shows that operating parameters and treatment intensity can materially affect weed-control outcomes. That evidence supports the broader point that electrical settings matter, but it does not prove that frequency alone predicts efficacy across products, weeds, soils, or crops.

## Safe Sales Wording

"Frequency can influence how electrical energy is delivered, but Zasso does not sell frequency as a stand-alone efficacy claim. We focus on controlled energy delivery through the complete plant-soil circuit."

"In the field, weed-control results depend on the full system: applicator design, electrode contact, power delivery, plant stage, soil condition, speed, training, and follow-up management."

"Frequency is one engineering variable inside the validated product architecture, not a simple setting where higher automatically means better weed control."

## Caveats

Do not claim that higher frequency always improves efficacy, that one frequency is universally optimal, that frequency alone determines root kill, or that frequency eliminates the need for correct speed, contact, soil conditions, training, or follow-up treatment.

Do not disclose confidential Zasso frequencies, pulse widths, duty cycles, pulse densities, voltage or current limits, converter topology, firmware logic, module-control strategy, sensor thresholds, safety thresholds, telemetry behavior, measured waveforms, unpublished trial results, certification details, supplier details, customer-specific outcomes, or pricing.

Frequency may have different implications in AC, DC, pulsed DC, PWM, PDM, and other controlled-waveform systems. External language should stay product-neutral unless approved product specifications and safety documentation explicitly support a more specific statement.

