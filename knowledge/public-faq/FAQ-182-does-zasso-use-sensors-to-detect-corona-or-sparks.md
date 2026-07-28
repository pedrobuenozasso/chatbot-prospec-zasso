---
faq_id: FAQ-182
question: "Does Zasso use sensors to detect corona or sparks?"
status: Done
audience: Customer-facing
evidence_level: Medium
last_processed: 2026-07-05
last_improved:
---

# Does Zasso use sensors to detect corona or sparks?

## Short Answer

Based on current Zasso materials, it is safest not to make a blanket customer-facing claim that every Zasso product uses dedicated corona or spark sensors. Zasso manages corona, spark, and arc risk through controlled energy delivery, electrode design, insulation, fault monitoring, alarms or shutdown behavior where configured, maintenance, operator training, and approved stop-work procedures. If a customer asks about a specific machine, the answer should be confirmed against that product's manual, configuration, and approved safety documentation.

## Detailed Answer

Corona, sparks, and arcs are different forms of unintended electrical discharge. Corona is usually a localized ionization or leakage condition around a high-field region, while a spark is a brief gap-bridging discharge and an arc is a sustained discharge that can continue if the source keeps supplying current. In electrical weeding, these events can be promoted by sharp edges, air gaps, poor or bouncing contact, dry residue, damaged insulation, conductive debris, contamination, or unsuitable field conditions.

Zasso's safety logic should be explained as system-level risk management rather than as a single sensor feature. The system is designed to transfer electrical energy through the intended plant and return path, with power electronics, electrode architecture, insulation, current control, fault detection, maintenance, and operator procedures all contributing to risk reduction. Sensors and monitoring can support this by observing electrical behavior, machine state, faults, interlocks, or abnormal conditions, but customer-facing claims should not imply a universal, dedicated corona/spark sensor unless that feature is explicitly listed for the specific product.

For sales use, the practical distinction is important. It is reasonable to say that Zasso equipment is designed to monitor and control treatment conditions and respond to defined faults according to the product configuration. It is not safe to promise that sensors will always detect corona, every spark, every arc precursor, or every fire-risk condition in real time. Operators must still inspect the machine and field, avoid high-fire-risk conditions, follow the manual, maintain safety distances, and stop if they see repeated sparking, sustained discharge, smoke, flame, unusual odor, abnormal noise, alarms, damaged electrodes, damaged insulation, or uncertain conditions.

## What This Means for Customers

Customers should treat discharge detection as one layer of safety, not the primary fire-prevention measure. Even when a machine monitors voltage, current, insulation, load behavior, interlocks, or other signals, field judgment and approved procedures remain essential. Dry biomass, straw, mulch, dust, drought, wind, damaged equipment, poor contact, and conductive objects can still create risk.

When evaluating a specific Zasso product, customers should ask which alarms, interlocks, monitoring channels, shutdown behaviors, and inspection procedures apply to that machine. Zasso or the authorized partner should answer from the relevant product manual and training materials, not from a generic claim about all machines.

The customer benefit is controlled electrical application: Zasso aims to deliver energy through the intended treatment path while reducing avoidable sparks and abnormal discharge through design, control, maintenance, and training. That is stronger and safer than saying the machine simply has a spark sensor.

## Evidence and Context

Zasso's completed FAQ files on spark formation, electrode design, and pulse control explain that spark and fire risk are managed through the complete system: contact quality, electrode geometry, spacing, insulation, power regulation, current limiting, fault detection, maintenance, operator training, and stop-work procedures.

Zasso GitHub concept notes on corona discharge, spark discharge, and arc formation support the mechanism: corona can appear as local ionization, leakage current, glow, hiss, ozone odor, or electrical noise; spark discharge can appear as a brief flash, snap, current spike, or voltage collapse; arc formation is more sustained and can create heat, pitting, erosion, and fire risk. Those notes also warn that sensor signals and current feedback must be interpreted carefully because unintended discharge is not the same as useful plant-treatment current.

SharePoint research reviewed during this run pointed to Zasso electrical-weeding reference material and body-of-knowledge material that discuss electrode arrangements, spark discharge, direct-contact electrodes, current path, power control, insulation, faults, and fire-related operating context. This FAQ uses that internal material only at a high level and does not disclose confidential design parameters, thresholds, product architecture, or sensor logic.

Recent Read.AI meeting context reviewed during this run reinforced the importance of product-specific manuals, training, maintenance responsibility, traceability, control logic, alarms, and service readiness. This answer does not quote private meeting content or disclose confidential product, customer, contract, or technical details.

Zasso's public technology page describes high voltage generated locally, modulated in power modules, and transferred by applicators through plants and soil. That supports describing Zasso as a controlled electrical application system, while avoiding unsupported claims about any specific corona or spark sensor: https://zasso.com/technology/

GROW IWM guidance states that sparks from electrical weed-control equipment can ignite dry vegetation, especially in low-rainfall, drought, or low-humidity conditions, and recommends trained operation, safe perimeters, inspection, and fire-suppression readiness: https://growiwm.org/weed-electrocution/ and https://growiwm.org/wp-content/uploads/2025/10/Weed-Electrocution-Factsheet-PDF.pdf

Michigan State University Extension describes electrical weed control as high-voltage equipment using a charged electrode to treat weeds and notes that performance is affected by voltage, current, speed, plant condition, soil moisture, and electrode contact. This supports treating discharge risk as dependent on contact and field conditions, not only sensors: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control

A 2025 Weed Science article evaluating Zasso XPower in Australian vineyards reported significant fire risk when electric weed control was applied in completely dry plant biomass, while spring vineyard applications produced no observed fires. This supports conservative wording that monitoring and design reduce risk but do not make dry fuel conditions automatically safe: https://www.cambridge.org/core/journals/weed-science/article/electric-weed-controlhow-does-it-compare-to-conventional-weed-control-methods/488C45B191B97E84E34257E80EB9CFC6

## Safe Sales Wording

"Zasso manages abnormal discharge risk through controlled power delivery, electrode design, monitoring, maintenance, training, and approved operating procedures."

"For a specific product, we should confirm the exact alarms, interlocks, sensors, and shutdown behavior in the product manual rather than making a generic claim."

"Sensors and fault monitoring can support safe operation, but operators must still stop if they see repeated sparks, sustained discharge, smoke, flame, alarms, damaged parts, or unsafe field conditions."

## Caveats

Do not claim that Zasso universally has dedicated corona sensors, optical spark sensors, acoustic spark detection, thermal fire detection, or real-time arc-prevention sensors unless the specific product documentation explicitly says so. Do not claim that sensors detect every corona event, every spark, every arc precursor, every ignition source, or every fire-risk condition.

Do not disclose confidential sensor architecture, thresholds, firmware logic, current or voltage limits, alarm timing, event-classification logic, telemetry, product-family differences, certification status, or customer-specific incident information unless approved for external use.

If there is repeated sparking, sustained arcing, smoke, flame, abnormal noise, ozone-like odor, alarms, damaged cables, damaged insulation, broken or heavily worn electrodes, contact with metal infrastructure, or uncertainty about field safety, operation should stop and the approved shutdown, inspection, and return-to-service procedure should be followed.

