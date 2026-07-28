---
faq_id: FAQ-199
question: "What happens if insulation is damaged?"
status: Done
audience: Customer-facing
evidence_level: High
last_processed: 2026-07-05
last_improved:
---

# What happens if insulation is damaged?

## Short Answer

If insulation is damaged, the equipment should be stopped and treated as unsafe until the affected part and related high-voltage system have been inspected according to the approved Zasso manual and service procedure. Damaged insulation can allow current to leak into unintended paths, including wet residue, metal parts, the machine frame, soil, tools, animals, or people. Operators should not continue working, bypass protections, tape over significant damage, or restart the machine unless trained or authorized personnel confirm that it is safe to return to service.

## Detailed Answer

Insulation is one of the main barriers that keeps high-voltage energy in the intended treatment path. In a Zasso application, the intended path is controlled energy delivery through the applicator, target vegetation, soil or return route, and the machine's designed electrical circuit. When insulation is cut, crushed, cracked, contaminated, wet, carbon-tracked, overheated, aged, or mechanically damaged, that separation can be weakened.

The result may be an unintended current path. Depending on the location and severity of the damage, current may leak to the chassis, an electrode support, a connector shell, a cable shield, a metal object, irrigation equipment, trellis wire, wet crop residue, mud, soil, a service tool, an animal, or a person. It can also lead to alarms, high-voltage inhibit, ground-fault or insulation-monitoring events, arcing, localized heating, poor treatment performance, equipment damage, or fire risk in unfavorable conditions.

The correct operating response is conservative. If damaged insulation is suspected, stop high-voltage operation, maintain the required safety distance, keep people and animals away, follow the product-specific shutdown and discharge procedure, and escalate the issue through the approved inspection and service route. The machine should remain out of service until the affected component has been repaired or replaced with approved parts and required checks are complete.

Some Zasso systems may include protective layers such as insulation monitoring, ground-fault detection, fault latching, alarms, emergency stop, high-voltage disable logic, protective bonding, safe shutdown, and event logging. These layers are important, but they are not permission to operate with compromised insulation. A protective system reduces risk when used correctly; it does not make visible or suspected insulation damage acceptable.

## What This Means for Customers

For customers, damaged insulation is a stop-work condition. It should be handled like a safety-critical fault, not like a cosmetic issue. The safest practical rule is: inspect before use, stop when abnormal damage is found, control access to the machine, avoid improvised repairs, and restart only after the approved checks are complete.

This protects operators, bystanders, animals, equipment, and treatment quality. A hidden insulation problem can create shock risk, nuisance shutdowns, poor performance, downtime, difficult diagnostics, or additional equipment damage. Continuing to operate may turn a repairable issue into a safety incident or a larger service event.

Farms, contractors, distributors, and municipalities should make insulation and cable condition part of routine pre-use inspection and maintenance. Teams should know what abnormal signs look like, who is allowed to inspect or replace parts, which alarms require escalation, and when the machine must stay out of service.

## Evidence and Context

Zasso's public technology material describes Electroherb as controlled high-voltage electricity transferred through applicators into plants and soil, with operational safety supported by warnings, insulating materials, grounding elements, detections, and professional training: https://zasso.com/technology/

Existing Zasso GitHub FAQ material supports this answer, especially FAQ-133 on high-voltage danger, FAQ-158 on insulation-failure detection, FAQ-161 on fault detection, FAQ-164 on key safety rules, FAQ-165 on maintenance safety procedures, and FAQ-197 on damaged cables. These files consistently treat damaged insulation, abnormal high-voltage behavior, faults, alarms, and damaged cables as reasons to stop, control access, follow the manual, and involve trained support where required.

Internal Zasso concept notes reviewed for this FAQ include insulation resistance, ground fault, fault path, and fault current. They support the technical explanation that low or damaged insulation can create leakage paths, ground faults, touch-voltage hazards, step-voltage hazards, arcing, heating, poor power delivery, and fault-detection events, especially under wet, dirty, or mechanically stressed field conditions.

SharePoint safety concept material reviewed for this FAQ supports the high-level safety architecture: insulation, grounding or bonding, fault detection, high-voltage disable logic, safe shutdown, exclusion zones, and trained operation. This answer uses that material only at a customer-safe level and does not disclose confidential product thresholds, architecture, or test criteria.

Recent Read.AI meeting context reviewed for this run reinforces that Zasso treats training, manuals, traceability, approved parts, service responsibility, local first-level maintenance, and operation according to documented procedures as important parts of customer deployment. This supports the stop-work and approved-service wording used here without quoting private meeting content.

Public electrical-safety guidance supports the same conservative approach. OSHA states that worn or frayed electric cords or cables shall not be used and explains that taped repairs generally do not restore the original characteristics of significantly damaged cord jackets: https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.416 and https://www.osha.gov/laws-regs/standardinterpretations/1998-12-16. OSHA also emphasizes visual inspection and avoiding handling or using equipment in ways that damage insulation: https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.334.

Electrical weed-control references also support caution. Michigan State University Extension describes electrical weed control as using charged electrodes and high-voltage electricity, where voltage, current, contact, plant condition, soil moisture, and operating setup influence results: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control. GROW IWM notes that weed electrocution equipment operates at high voltage and that improper handling can create severe shock risks, requiring training, inspections, maintenance, and safe operating distances: https://growiwm.org/weed-electrocution/ and https://growiwm.org/wp-content/uploads/2025/10/Weed-Electrocution-Factsheet-PDF.pdf.

## Safe Sales Wording

"If insulation is damaged or suspected to be damaged, the machine should be stopped and kept out of service until the approved Zasso inspection and service procedure confirms it can be restarted."

"Damaged insulation can create unintended current paths, so it should never be treated as a cosmetic issue or handled with improvised field repairs."

"Zasso systems use layered safety protections where applicable, but those protections do not replace trained inspection, approved parts, and the product-specific manual."

## Caveats

This FAQ is not a product manual or repair instruction. Exact shutdown steps, discharge checks, lockout requirements, PPE, inspection methods, insulation-resistance tests, alarm meanings, replacement criteria, and restart rules may vary by product, configuration, country, and site.

Do not claim that every insulation fault is automatically detected, that damaged insulation is safe if no alarm appears, that electrical tape is an approved repair for significant damage, that operators can bypass safety systems to finish a job, or that emergency stop alone proves the machine is safe to touch.

Do not disclose confidential insulation ratings, cable specifications, grounding architecture, sensor thresholds, response times, diagnostic logic, service procedures, certification files, incident history, supplier details, or internal test results unless Zasso has approved them for external use.

