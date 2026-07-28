---
faq_id: FAQ-157
question: "Does Zasso have automatic shutdown systems?"
status: Done
audience: Customer-facing
evidence_level: Medium
last_processed: 2026-07-04
last_improved:
---

# Does Zasso have automatic shutdown systems?

## Short Answer

Yes, based on current Zasso materials, Zasso equipment is designed with automatic shutdown or high-voltage inhibit functions as part of a layered safety architecture. These systems can remove or block high-voltage operation when defined unsafe or abnormal conditions are detected. The exact shutdown triggers, sensors, response times, reset rules, and availability depend on the product, configuration, market, and approved operating manual.

## Detailed Answer

Zasso electrical weeding uses high-voltage energy, so safe operation cannot depend only on operator attention or warning labels. Current Zasso technical and safety materials describe a layered approach that may include emergency stop circuits, interlocks, high-voltage disable logic, insulation monitoring, grounding or earthing checks, electrode-position or ground-contact monitoring, open-circuit or low-current detection, fault latching, operator alerts, and restart prevention.

In practical customer language, the system is intended to stop treatment energy or prevent high-voltage operation when the machine detects that key safety or readiness conditions are not met. Examples may include an emergency stop activation, an open interlock, a detected insulation fault, loss or incorrect position of a grounding element, electrode position outside the target state, abnormal current or power behavior, human or animal presence in a defined danger zone where that feature is fitted, or other safety-critical faults.

However, automatic shutdown should not be presented as a guarantee that all hazards disappear instantly or that the machine can be used without training. A shutdown command is part of the safety chain, not the whole chain. Operators still need to maintain exclusion zones, follow alarms and manual instructions, avoid unsafe metal or water conditions, complete the correct shutdown and discharge procedure, and verify safe access before inspection, cleaning, maintenance, or service.

The best customer-facing summary is: Zasso designs its systems with automatic shutdown and inhibit logic where required by the product architecture, but customers should rely on the product-specific manual and training for the exact functions and operating rules.

## What This Means for Customers

Customers should expect Zasso equipment to behave like professional high-voltage machinery, with protective logic that can stop or prevent high-voltage operation under defined unsafe conditions. This supports safer operation, clearer fault handling, and better operator discipline in real field conditions.

At the same time, customers should not treat automatic shutdown as a substitute for training, inspection, exclusion zones, PPE where required, maintenance, or safe work procedures. If the machine stops automatically, the operator should treat that as a safety-relevant event, check the displayed alarm or procedure, keep people and animals away, and restart only when the approved manual and training allow it.

For fleet owners, contractors, municipalities, and farms, this means operator training should cover both normal shutdown and automatic shutdown events: what causes them, what the operator should do, when restart is allowed, and when Zasso service or qualified maintenance support is required.

## Evidence and Context

Zasso's public technology material describes Electroherb as a high-voltage system using applicators to transfer electricity through plants and soil, and notes that operational safety relies on measures such as warnings, insulating materials, grounding elements, detections, and professional training: https://zasso.com/technology/

Existing Zasso FAQ files in GitHub frame safety as procedure-based and product-specific. FAQ-132 explains that safety depends on engineered controls, energy delivery, exclusion zones, training, inspections, and conservative operating procedures. FAQ-154, FAQ-155, and FAQ-156 caution that shutdown is not by itself proof of safe-to-touch status and that discharge and verification procedures remain product-specific.

Zasso GitHub concept notes on high-voltage disable circuits and interlock loops describe the relevant safety logic at a high level: emergency stop, interlock opening, insulation monitoring, ground-fault or over-current protection, watchdogs, communication faults, contactor feedback, discharge interaction, fault latching, reset rules, restart prevention, and operator-visible inhibit reasons. These are internal concept materials and should not be treated as public claims about every specific product.

Zasso SharePoint safety material reviewed for this answer describes high-voltage electrical weeding safety as a layered architecture involving insulation, grounding, high-voltage insulation monitoring, fault detection, emergency shutdown, sensor integration, electrode positioning, safety zoning, and operator training. It also describes examples where ground-contact monitoring, electrode-position sensing, open-circuit detection, human or animal presence detection, and safety-control units can switch off or prevent high-voltage operation.

Recent Read.AI context reviewed during this run supports the importance of trained operation, manuals, certification, post-sales support, and service discipline. This FAQ does not quote private meeting content or disclose confidential customer, contract, or design details.

Michigan State University Extension describes electrical weed control as using charged electrodes and high-voltage electricity, with performance and operation affected by voltage, current, speed, soil moisture, plant condition, and electrode contact: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control

GROW IWM guidance notes that electrical weed-control equipment operates at high voltage and that improper handling can create severe shock risks, reinforcing the need for training, inspections, maintenance, protective equipment where required, caution around wet conditions, and safe distances: https://growiwm.org/weed-electrocution/ and https://growiwm.org/wp-content/uploads/2025/10/Weed-Electrocution-Factsheet-PDF.pdf

General hazardous-energy guidance from OSHA supports the same principle for service and maintenance: machines must be disabled and hazardous energy controlled to prevent unexpected energization, startup, or release of stored energy: https://www.osha.gov/control-hazardous-energy

## Safe Sales Wording

"Yes. Zasso systems are designed with automatic shutdown or high-voltage inhibit functions as part of a layered safety concept, but the exact features and procedures depend on the product and approved manual."

"Automatic shutdown helps manage defined unsafe or abnormal conditions, but it does not replace trained operation, safety distances, inspections, maintenance, or the correct shutdown and discharge procedure."

"If the equipment shuts down automatically, the operator should treat it as a safety-relevant event and restart only after the cause is understood and the manual allows it."

## Caveats

Do not claim that every Zasso product has the same automatic shutdown features, sensors, response times, safety rating, certification, diagnostic coverage, or reset behavior. Do not imply that automatic shutdown makes the equipment safe to touch, safe for untrained users, safe around bystanders, or safe in all weather and field conditions.

Do not disclose product-specific sensor layouts, circuit design, interlock topology, voltage or current thresholds, response times, software logic, fault codes, validation data, certification status, or service procedures unless that language is already approved for customer-facing use.

Automatic shutdown effectiveness depends on the product configuration, maintenance state, sensor health, soil and plant conditions, grounding condition, electrode condition, insulation condition, water or metal exposure, local regulation, and whether the event is normal operation, an alarm, an emergency stop, a fault, cleaning, transport, maintenance, or service.

