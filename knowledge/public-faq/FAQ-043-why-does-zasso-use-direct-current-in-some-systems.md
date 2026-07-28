---
faq_id: FAQ-043
question: "Why does Zasso use direct current in some systems?"
status: Done
audience: Customer-facing
evidence_level: High
last_processed: 2026-06-28
last_improved:
---

# Why does Zasso use direct current in some systems?

## Short Answer

Zasso uses direct current in some systems because a controlled DC treatment architecture can help deliver electrical energy through the plant-soil circuit in a predictable, controllable way. In practical customer terms, DC supports controlled polarity, current-path management, power modulation, and avoidance of unnecessary alternating-voltage peaks. It should not be presented as a universal claim that DC is always better; the result still depends on the whole system, including power electronics, electrodes, contact time, plant and soil conditions, operator training, and safety controls.

## Detailed Answer

Electrical weeding is not simply about applying a large voltage to weeds. The applicator must establish contact with target vegetation, the electrical path must close through the plant-soil system, and enough useful energy must reach plant tissues and recovery structures to suppress regrowth. That load changes constantly with plant species, growth stage, water content, weed density, soil moisture, soil conductivity, contact quality, residue, and machine speed.

In that setting, a controlled DC architecture can be useful because current direction and treatment-side polarity are easier to define and manage. This supports a more disciplined treatment process: the system can focus on delivering controlled energy into a changing biological load rather than relying on high alternating peaks as the main performance signal. It also fits Zasso's broader technology positioning around power electronics, impedance management, electrode design, and operator guidance.

Another reason DC can matter is peak-voltage management. Some AC architectures require higher voltage peaks to achieve a given effective voltage or power level, because the waveform alternates over time. A controlled DC treatment-side architecture can help avoid unnecessary peak-voltage exposure while still delivering useful energy when the applicator is in contact with the plant-soil circuit. This is a safety and engineering rationale, not a promise that DC alone guarantees safer or better weed control.

Customers do not need internal converter details to understand the value. Upstream stages inside a machine may include generators, rectifiers, inverters, transformers, DC buses, filtering, and control electronics depending on the product. The customer-safe explanation is that Zasso uses power electronics to control how high-voltage energy reaches the target plant, and direct-current delivery is one design choice used in some systems to support controlled treatment, safety logic, and adaptation to real field loads.

## What This Means for Customers

For customers, the practical benefit is not the label "DC" by itself. The benefit is a controlled electrical treatment process designed to direct energy into target vegetation under suitable operating conditions. DC can help explain why Zasso emphasizes controlled power delivery, applicator contact, safety architecture, and field setup rather than headline voltage alone.

This also helps set realistic expectations. DC does not remove the need for trained operators, field assessment, correct speed, good electrode contact, suitable soil and plant conditions, and follow-up scouting. It is one part of the full system that helps Zasso manage the plant-soil electrical load responsibly.

## Evidence and Context

Zasso's public technology page describes high-voltage electricity being generated locally, transferred by applicators into plants and soil, and modulated by patented power modules. That supports explaining Zasso as a controlled power-delivery technology rather than a simple raw-voltage device: https://zasso.com/technology/

GitHub repository research reviewed for this answer included FAQ-042 on whether Zasso uses AC or DC, plus adjacent answers on voltage, current, power, impedance matching, electrodes, plant-soil circuits, and the electrical/electrothermal mechanism. These materials consistently support the customer-safe message that waveform choice is only one part of a controlled energy-delivery system.

SharePoint research reviewed electrical-weeding guide and bibliography materials, including sources on electrical-weeding evolution and high-voltage safety. These materials support the internal rationale that controlled DC architectures can reduce unnecessary voltage peaks and improve controllability compared with approaches that rely more heavily on alternating high-voltage peaks. The answer deliberately avoids confidential converter settings, module design, thresholds, and unpublished test data.

Recent Read.AI meeting summaries reviewed for current operating context emphasized module enable logic, applicator integration, safety redundancy, certification, telemetry, post-sales support, and operator training. This supports describing DC as part of a controlled professional system, while keeping private engineering and commercial details out of the customer-facing answer.

Michigan State University Extension describes electrical weed control as high-voltage electricity transferred through an electrode into weeds, with current passing through plant tissue and returning through roots, soil, return electrode, and grounding equipment. This supports explaining the technology through current path, contact, and dose rather than waveform alone: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control

A 2022 Advances in Weed Science study investigated AC and DC electric current as weed-control methods. It supports the broader point that current type and application conditions can influence plant response, but it should be treated as general scientific context rather than direct product validation for Zasso: https://awsjournal.org/article/investigation-of-the-effectiveness-of-ac-dc-electric-current-as-a-weed-control-method-using-ndvi-technique/

A Weed Science review explains that electric weed control transfers current through target plants after electrode contact and that efficacy is affected by electrical power, application speed, weed morphology, and environmental conditions. This reinforces that DC is one design factor within a broader treatment system: https://library.dpird.wa.gov.au/j_article/95/

## Safe Sales Wording

"Zasso uses controlled direct-current delivery in some systems because it helps manage how electrical energy is delivered through the plant-soil circuit. The customer benefit is controlled treatment, not simply the DC label."

"Direct current can help define the treatment-side current path and avoid unnecessary alternating voltage peaks, but performance still depends on the complete system: power electronics, electrodes, contact time, field conditions, and trained operation."

"We do not sell DC as a magic feature. We use the electrical architecture that best supports controlled power delivery, safety logic, and practical field performance for the specific product and application."

## Caveats

Do not claim that DC is always superior to AC, that DC is inherently safe, or that DC guarantees better weed control, lower cost, no fire risk, or one-pass results. System design, safety architecture, electrode contact, field conditions, application speed, crop and weed context, maintenance, and operator training remain essential.

Do not imply that every internal stage of every Zasso product is pure DC. Power-electronic systems may include AC and DC stages internally. Customer-facing wording should distinguish internal conversion architecture from controlled treatment-side delivery.

Do not disclose confidential voltage levels, current limits, pulse logic, PWM or PDM settings, converter topology, module architecture, control algorithms, fault thresholds, certification details, unpublished test data, customer-specific results, supplier information, or pricing.

