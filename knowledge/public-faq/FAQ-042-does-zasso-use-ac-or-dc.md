---
faq_id: FAQ-042
question: "Does Zasso use AC or DC?"
status: Done
audience: Customer-facing
evidence_level: High
last_processed: 2026-06-28
last_improved:
---

# Does Zasso use AC or DC?

## Short Answer

Zasso's current customer-facing technical positioning should describe the treatment output as controlled high-voltage DC in the relevant modern system architecture. The practical point is not simply whether the input source starts as AC or DC; it is that Zasso converts and controls electrical energy so it can be delivered through the plant-soil circuit in a predictable way. Some upstream power-conversion stages may involve AC generation, rectification, inversion, or filtering, but the sales message should focus on controlled energy delivery, safety architecture, and field performance rather than raw waveform labels.

## Detailed Answer

AC and DC describe how electrical current behaves. In direct current, the current flows mainly in one direction. In alternating current, current direction and voltage polarity reverse periodically. Electrical weed-control systems can use different architectures internally, including generators, rectifiers, inverters, transformers, DC buses, and high-voltage power modules.

For Zasso, the safest customer-facing answer is that the relevant modern treatment architecture is designed around controlled DC delivery to the high-voltage applicator side. This aligns with Zasso internal technical positioning that emphasizes modular power, impedance matching, avoiding unnecessary voltage peaks, and managing a changing biological load. In simple terms, Zasso is not trying to impress customers with AC or DC as a slogan; it is trying to deliver the right electrical dose through weeds, under safe and suitable operating conditions.

That distinction matters because the field load is never fixed. Plant species, plant water content, electrode contact, weed density, soil moisture, soil conductivity, residue, speed, and grounding/contact quality all affect the plant-soil circuit. A controlled DC approach can support lower unnecessary peak-voltage exposure for the same delivered power compared with some AC approaches, while still allowing the machine to adapt energy delivery to the target load. However, this should not be turned into a blanket claim that DC is always better in every possible machine or application.

Customers do not need to know internal converter details to understand the value. They need to know that Zasso uses a controlled electrical architecture to deliver high-voltage energy through target plants, with safety systems, applicator contact, operator training, and field setup all forming part of the result.

## What This Means for Customers

Customers should not evaluate Zasso only by asking whether the system is AC or DC. A better question is whether the machine can deliver controlled, repeatable, safe energy into the target vegetation under real field conditions. The waveform is one design choice inside a larger system that includes power control, electrode design, contact time, operating speed, field assessment, operator training, and safety procedures.

For sales conversations, DC can be explained as part of Zasso's controlled-power architecture. It helps frame why Zasso focuses on precise energy delivery through the weed and plant-soil pathway instead of relying on high peak voltages alone. The customer benefit is practical: better control of the treatment process, clearer safety logic, and a more disciplined way to handle changing field loads.

## Evidence and Context

Zasso's public technology page explains that high-voltage electricity is generated locally, transferred through applicators into plants and soil, and modulated by patented power modules. It describes current flow during application, energy delivery into the plant, and no chemical residues in soil: https://zasso.com/technology/

GitHub repository research reviewed for this answer included adjacent FAQ answers on voltage, current, power, impedance matching, plant-soil circuits, and the electrical/electrothermal mechanism. These materials consistently explain Zasso as a controlled power-delivery system rather than a simple raw-voltage machine.

GitHub power-electronics material reviewed included internal summaries of AC-DC rectifiers and DC-AC converters. These references support the general point that electrical equipment may include multiple conversion stages internally, so public explanations should distinguish upstream conversion from the treatment-side waveform and customer value.

SharePoint research reviewed included "Electrical Weeding Did Not Arrive All at Once" and "Safety in High-Voltage Electrical Weeding." These Zasso materials support the current positioning that modern systems should be evaluated by stable power delivery into a changing biological load. They also state that controlled DC architectures can reduce unnecessary voltage peaks and safety risk compared with architectures that rely on high alternating-voltage peaks for the same field effect.

Recent Read.AI meeting summaries reviewed for current operating context emphasized module enable logic, applicator integration, safety redundancy, operator training, certification, telemetry, and post-sales support. These sources support customer-safe wording around controlled architecture and training, while avoiding confidential engineering details.

Michigan State University Extension describes electrical weed control as high-voltage electricity transferred through an electrode into weeds, with current passing through plant tissue and returning through roots, soil, return electrode, and grounding equipment. This supports explaining the technology through current path and dose rather than waveform alone: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control

A 2022 Advances in Weed Science paper investigated AC and DC electric current as a weed-control method and supports the broader scientific context that both waveform type and application conditions can influence plant response. It should be used as general evidence, not as direct Zasso product validation: https://www.scielo.br/j/aws/a/njSjfTbw5FM8zDqXsVdKLyv/?lang=en

A Weed Science review describes electric weed control as current delivery through plants by electrode contact, with efficacy influenced by power, application speed, weed morphology, and environmental conditions. This reinforces that waveform is only one factor in the overall treatment system: https://www.cambridge.org/core/journals/weed-science/article/exploring-the-potential-of-electric-weed-control-a-review/231EE50C385EF8962CDC46055C264237

## Safe Sales Wording

"Zasso's modern treatment architecture is best described as controlled high-voltage DC delivery through the target plant and plant-soil circuit. The important point is controlled energy delivery, not just whether the upstream power source starts as AC or DC."

"We use power electronics to manage how energy reaches the weed. That lets us focus on dose, contact, safety, and field conditions rather than relying on high voltage peaks alone."

"For customers, the practical benefit is a controlled electrical treatment process designed for real field loads, with safety systems and trained operation built into the application."

## Caveats

Do not claim that every internal part of every Zasso product is pure DC. Power electronics can include AC generation, AC-DC conversion, DC links, DC-AC conversion, transformers, filtering, and control stages depending on the product architecture.

Do not claim that DC automatically guarantees better weed control, complete safety, or lower cost. Efficacy and safety depend on power delivery, current path, contact quality, soil and plant conditions, operating speed, product configuration, operator training, and local requirements.

Do not disclose confidential voltage levels, current levels, pulse logic, module settings, control algorithms, safety thresholds, certification details, unpublished test data, customer-specific results, or supplier information.

