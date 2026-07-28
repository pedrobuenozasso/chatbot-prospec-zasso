---
faq_id: FAQ-168
question: "How does Zasso compare to AC systems from a safety standpoint?"
status: Done
audience: Customer-facing
evidence_level: Medium
last_processed: 2026-07-04
last_improved:
---

# How does Zasso compare to AC systems from a safety standpoint?

## Short Answer

Zasso should not claim that one waveform is automatically safe or unsafe. From a safety standpoint, Zasso's controlled electrical-weeding architecture is best compared with AC systems by looking at the complete design: current path, peak voltage, available energy, exposure time, grounding, insulation, fault detection, shutdown logic, safety distances, maintenance, and operator training. Controlled DC or pulsed-DC delivery can help reduce unnecessary alternating voltage peaks in suitable architectures, but safety still depends on the validated product configuration and correct operation.

## Detailed Answer

AC and DC are useful technical labels, but they are not enough to judge safety by themselves. Alternating current changes polarity repeatedly, while direct current has a defined polarity and flows mainly in one direction. In high-voltage electrical weeding, the practical safety question is whether unintended current can reach a person, animal, machine chassis, metal object, water path, or other conductive route, and whether the system detects and stops unsafe conditions quickly.

AC systems can create specific safety and design challenges. For comparable effective power, sinusoidal AC has peak values higher than its RMS value, which can increase insulation stress, arcing margins, corona behavior, and required clearances. AC at some frequencies is also associated with muscle tetany and cardiac-risk concerns in general electrical-safety literature. These points support treating AC safety carefully rather than accepting simple claims that AC or high frequency is inherently safer.

Zasso's safer customer-facing comparison is that its value is not merely "DC instead of AC." The value is controlled energy delivery through the weed and plant-soil circuit, supported by power electronics, electrode design, grounding or return-path management, insulation, safety zoning, monitoring, fault response, emergency shutdown, training, and product-specific documentation. In suitable Zasso architectures, controlled DC or pulsed-DC delivery can help avoid unnecessary voltage peaks and support a more defined treatment-side current path.

However, it would be misleading to say that DC makes the equipment safe by itself. High-voltage DC, pulsed DC, and AC can all be dangerous if a person becomes part of the circuit, if insulation is damaged, if grounding is poor, if the machine is modified, if dry biomass creates fire risk, if bystanders enter the hazard zone, or if operators ignore the manual. The right comparison is therefore system versus system, not waveform slogan versus waveform slogan.

## What This Means for Customers

Customers should ask suppliers how the full machine manages electrical risk. Useful questions include: What current paths are intended and unintended? How are peak voltages controlled? What happens during open-circuit, short-circuit, insulation-fault, chassis-fault, water-contact, metal-contact, or bystander-entry scenarios? What safety distance applies? What training, PPE, inspection, maintenance, grounding, emergency-stop, and shutdown procedures are required?

For Zasso customers, the commercial message is that Zasso designs professional high-voltage equipment around controlled application and layered safety, not just raw electrical output. Where Zasso uses controlled DC or pulsed-DC treatment-side delivery, that can be positioned as part of a disciplined architecture for managing voltage peaks and current paths.

Customers should still treat the equipment as high-voltage machinery. The machine must be used only in approved configurations, by trained operators, with the required safety distance, inspections, manuals, PPE where applicable, and local rules.

## Evidence and Context

Existing Zasso FAQ materials in GitHub reviewed for this answer include FAQ-044 on AC versus DC, FAQ-046 on higher voltage peaks, FAQ-052 on frequency and safety, FAQ-133 on high-voltage danger, and FAQ-167 on electrical safety compliance. These answers consistently explain that safety depends on the complete system: current path, peak voltage, exposure time, available energy, insulation, grounding, fault detection, shutdown behavior, safety zoning, training, and product-specific documentation.

Zasso's public technology page describes high-voltage electricity being generated locally, modulated through power modules, and transferred through applicators into plants and soil. This supports explaining Zasso as controlled energy delivery through the plant-soil pathway rather than as a simple AC-versus-DC claim: https://zasso.com/technology/

SharePoint safety-guide material reviewed for this run supports several high-level themes: electrical weeding has inherent high-voltage risks; AC and DC safety comparisons should consider voltage peaks, current path, step voltage, insulation failures, chassis energization, grounding, safety zones, monitoring, and emergency shutdown; and simplified "skin effect" claims should not be used to imply that high-frequency AC is automatically safe for people.

SharePoint conformity documentation reviewed for this run supports keeping the answer product-specific. Zasso documentation for specific equipment configurations emphasizes approved machine combinations, approved application areas, operating instructions, PPE, residual electrical risk, and applicable machinery and electrical safety standards. This FAQ does not disclose confidential thresholds, unpublished test data, detailed circuit architecture, customer-specific documents, or non-public certification strategy.

Recent Read.AI meeting summaries reviewed for current context reinforced that Zasso treats training, operation according to the manual, service readiness, maintenance responsibility, and approved configuration as important parts of risk reduction. The answer uses that context only at a high level and does not quote private meeting content.

Michigan State University Extension describes electrical weed control as high-voltage electricity transferred through an electrode into weeds, with current moving through plant tissue and returning through roots, soil, and grounding equipment. It also highlights application variables such as voltage, current, speed, plant condition, soil moisture, and electrode contact: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control

GROW IWM describes weed electrocution as high-voltage current passing through plant and root tissue and notes shock, burns, and fire risks that must be managed through training, safe distances, inspection, and maintenance: https://growiwm.org/weed-electrocution/

General electrical-safety sources support the conservative framing. OSHA electrical-safety training explains that shock severity depends on voltage and the time current passes through the body, and that low currents can cause muscle contraction. IEC 60479-1 provides basic guidance on the effects of shock current on people and livestock. NCBI StatPearls describes electrical injury severity as depending on current type, voltage, resistance, exposure duration, and affected tissues: https://www.osha.gov/sites/default/files/2019-04/Basic_Electricity_Materials.pdf, https://webstore.iec.ch/en/publication/62980, and https://www.ncbi.nlm.nih.gov/books/NBK448087/

IEC 60204-11 is also relevant safety context because it addresses electrical equipment of machines operating above 1,000 V AC or 1,500 V DC and up to 36 kV. This supports treating both AC and DC high-voltage machinery as requiring formal electrical-equipment safety design rather than informal waveform comparisons: https://webstore.iec.ch/en/iec-search/result?q=60204

## Safe Sales Wording

"Zasso should be compared with AC systems as a complete safety architecture, not just as a waveform label. The important questions are current path, peak voltage, grounding, insulation, fault detection, shutdown, safety distance, training, and approved operation."

"Controlled DC or pulsed-DC delivery can help reduce unnecessary alternating voltage peaks in suitable architectures, but it does not remove the need for high-voltage safety procedures."

"We do not position AC as automatically unsafe or DC as automatically safe. Zasso's message is controlled professional equipment, validated configuration, trained operation, and layered safety."

## Caveats

Do not claim that AC systems are always unsafe, that DC systems are always safe, or that Zasso equipment is safe to touch. Do not claim that frequency, skin effect, waveform, voltage level, or a specific pulse strategy eliminates electric-shock, step-voltage, arcing, fire, or bystander risk.

Do not compare against a named competitor unless the comparison is supported by approved product-specific evidence. Different AC systems may have different frequencies, voltages, current limits, grounding concepts, insulation design, electrode geometry, shutdown behavior, manuals, certifications, and field restrictions.

Do not disclose confidential Zasso voltage or current settings, pulse logic, module architecture, control algorithms, sensor thresholds, shutdown thresholds, fault-detection methods beyond approved high-level descriptions, certification files, unpublished test results, customer-specific incidents, supplier information, or pricing.

