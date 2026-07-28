---
faq_id: FAQ-147
question: "What is the recommended safety distance?"
status: Done
audience: Customer-facing
evidence_level: High
last_processed: 2026-07-03
last_improved:
---

# What is the recommended safety distance?

## Short Answer

The recommended safety distance is the distance stated in the approved Zasso product manual and operator training for the specific machine, applicator, country, and use case. Customers should not apply a universal distance across all Zasso products or field situations. If the approved distance is not known, the conservative answer is to stop operation and confirm the correct product-specific instruction before energizing the equipment.

## Detailed Answer

Zasso equipment uses high-voltage electrical energy in a field environment, so the safety distance is part of the operating envelope of the machine. It keeps people, animals, tools, vehicles, and conductive field objects outside the area where direct contact, indirect contact, step voltage, touch voltage, arcing, residual charge, moving equipment, or abnormal fault conditions could create risk.

The recommended distance is not a simple brand-wide number because it depends on the product architecture, applicator geometry, electrode layout, voltage and current limits, waveform, stored energy, grounding or return-path design, fault detection, discharge behavior, soil moisture, plant moisture, terrain, nearby metal, irrigation, fences, trellises, public access, and local regulation. A distance validated for one machine, test case, or hazard model should not automatically be transferred to another configuration.

For some Zasso contexts, internal technical analysis has evaluated step-voltage behavior and supported a specific technical safety distance for a defined XPS configuration. That kind of analysis is useful evidence for engineering and certification work, but customer-facing operating distances should still come from approved manuals, training, labels, and local safety procedures. In demonstrations, public-facing work, roadsides, orchards, vineyards, contractor sites, or areas with animals or pedestrians, the practical controlled zone may need to be larger than the minimum electrical distance to maintain safe site control.

The operator should treat the safety distance as a no-entry boundary while high voltage may be active. If a person, animal, vehicle, tool, or conductive object enters the protected zone, the operator should stop high-voltage output and follow the approved restart procedure before continuing.

## What This Means for Customers

Customers should ask for the product-specific safety distance during training and keep it available with the operating instructions. The distance should be understood by operators, spotters, farm staff, contractors, maintenance workers, and anyone managing access to the work area.

In practice, the safety distance should be planned before work starts. This may include field briefings, signage, cones, barriers, spotters, traffic or pedestrian control, animal control, and a clear stop-work rule. The required controls may be simple in a closed field, but more formal in demonstrations, public areas, roadside work, municipalities, orchards, vineyards, or sites with workers moving nearby.

The customer benefit is clarity. Instead of guessing how close is safe, the team uses the approved boundary for the machine and site, stops work when that boundary is breached, and restarts only when the area is controlled again.

## Evidence and Context

Zasso's public technology material states that Electroherb technology uses high-voltage electricity transferred through applicators into plants and soil, and describes built-in safety mechanisms such as visual and acoustic warnings, insulating materials, grounding elements, speed and height detections, and professional training: https://zasso.com/technology/

The adjacent Zasso FAQ files in GitHub, especially FAQ-141 and FAQ-146, explain that safety distance protects against more than direct electrode contact. It also helps manage bystander exposure, conductive objects, wet conditions, step voltage, touch voltage, arcing, faults, moving equipment, animals, and site-control failures.

An internal Zasso safety-distance report for an XPS configuration used simulation and initial field measurements to evaluate step voltage. It identified a worst-case simulated distance of 0.85 m to remain below a 60 VDC step-voltage criterion and applied a 1.1 safety factor, resulting in a recommended technical distance of 0.935 m for that defined analysis. The same source notes that the model used specific assumptions and simplifications, so it should not be treated as a universal distance for all products or operating situations.

Zasso internal concept notes on safe separation distance and electrical clearance to bystanders support the same principle: safe distance is a controlled boundary around possible direct-contact, indirect-contact, arc, step-voltage, touch-voltage, leakage-current, ground-potential-rise, residual-charge, and machine-motion exposure. They explicitly caution against inventing a universal Zasso distance without product-specific validation.

Michigan State University Extension describes electrical weed control as using charged electrodes and high-voltage electricity, with performance and operation influenced by voltage, current, speed, soil moisture, plant condition, and electrode contact: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control

GROW IWM's weed-electrocution guidance states that electrical weed-control equipment operates at high voltage and that improper handling can create severe shock risks for operators or nearby individuals. It identifies training, safe distances, inspections, maintenance, protective equipment where required, and caution around wet or rainy conditions as important controls: https://growiwm.org/wp-content/uploads/2025/10/Weed-Electrocution-Factsheet-PDF.pdf

General electrical-safety guidance from OSHA supports the broader safety logic: electrical hazards include shock, electrocution, burns, fire, and fault conditions, and exposure risk depends on current path, current amount, exposure duration, contact condition, and conductive surroundings: https://www.osha.gov/electrical

## Safe Sales Wording

"The recommended safety distance is product-specific. Customers should follow the approved Zasso manual and training for their exact machine, applicator, country, and application."

"Do not guess the distance or apply one number to every product. If the required distance is unclear, stop and confirm the approved instruction before operating."

"The safety distance is a no-entry zone while high voltage may be active; if anyone or anything enters that zone, the operator should stop output and follow the approved restart procedure."

## Caveats

Do not publish or promise a universal safety distance for all Zasso systems. Do not present an engineering value from one XPS analysis as the operating distance for every product, market, or field condition.

Do not state product-specific distances, discharge times, PPE rules, warning thresholds, emergency procedures, certification claims, or sensor details unless they are approved for external use in the relevant product documentation.

The required distance can vary by product, applicator, voltage and current limits, stored energy, electrode geometry, guarding, software controls, soil and plant moisture, weather, nearby metal or water, fences, trellises, irrigation, animals, terrain, public access, operator training, certification status, and local regulation.

