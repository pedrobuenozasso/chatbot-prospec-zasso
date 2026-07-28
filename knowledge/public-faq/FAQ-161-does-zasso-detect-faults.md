---
faq_id: FAQ-161
question: "Does Zasso detect faults?"
status: Done
audience: Customer-facing
evidence_level: Medium
last_processed: 2026-07-04
last_improved:
---

# Does Zasso detect faults?

## Short Answer

Yes, based on current Zasso materials, relevant Zasso systems are designed to detect defined abnormal or unsafe conditions and to warn, inhibit, or stop high-voltage operation when required. Fault detection should be described as part of a layered safety architecture, not as a guarantee that every possible fault will be detected in every product or field condition. The exact detected faults, alarms, shutdown behavior, reset rules, and service actions are product-specific and should come from the approved manual, training, or Zasso technical support.

## Detailed Answer

Zasso equipment uses controlled high-voltage energy to treat target vegetation, so the system must manage both normal operating variation and safety-relevant abnormal conditions. In customer-safe language, fault detection means the machine monitors selected electrical, mechanical, sensor, and readiness conditions so that the control system can identify when operation is outside the expected envelope.

Depending on the product and configuration, fault detection may include insulation or leakage monitoring, grounding or earthing checks, open-circuit or low-current detection, short-circuit or over-current protection, emergency-stop and interlock status, electrode position or ground-contact monitoring, abnormal current or power behavior, tilt or position monitoring, sensor health checks, communication or watchdog faults, and product-specific alarms. Where fitted and approved, these detections can lead to an operator warning, high-voltage inhibit, automatic shutdown, fault latching, restart prevention, event logging, or service escalation.

The important customer message is that fault detection supports safe and disciplined operation, but it does not replace safe operating procedures. Operators still need to complete pre-use inspections, maintain the required safety distance, keep bystanders and animals away, avoid unsuitable conditions, respect alarms, follow shutdown and discharge procedures, and restart only when the manual allows it. Repeatedly resetting a fault without understanding the cause should not be presented as acceptable operation.

Because Zasso products, markets, and configurations can differ, sales teams should avoid publishing a universal list of fault codes or claiming identical diagnostic coverage across all machines. The safest answer is: Zasso designs relevant systems with fault-detection and high-voltage inhibit logic as part of a broader safety concept, and the exact behavior is defined in product-specific documentation.

## What This Means for Customers

Customers should expect Zasso equipment to behave like professional high-voltage agricultural or vegetation-management machinery. If the machine detects a relevant fault, it may alert the operator, prevent high-voltage activation, stop treatment output, or require a controlled reset or service check.

For operators, the practical rule is simple: treat any fault alarm, unexpected shutdown, insulation warning, grounding warning, damaged cable, abnormal sound, arcing, unusual smell, abnormal power behavior, sensor warning, or repeated restart request as safety-relevant until the cause is understood. Keep people and animals outside the safety zone, follow the manual, and escalate to trained maintenance or Zasso support when required.

For fleet owners, contractors, municipalities, and farms, fault detection should be included in training and operating discipline. Teams should know what alarms mean, who is allowed to reset the machine, when work must stop, what checks are required before restart, and when the equipment should be removed from service.

## Evidence and Context

Zasso's public technology material describes Electroherb as a high-voltage system that transfers electricity through applicators into plants and soil, and notes that safety relies on measures such as warnings, insulating materials, grounding elements, detections, and professional training: https://zasso.com/technology/

Existing Zasso FAQ files in GitHub support a product-specific and layered answer. FAQ-157 describes automatic shutdown and high-voltage inhibit logic. FAQ-158 explains insulation-failure detection. FAQ-159 describes presence detection as a possible product-specific safety layer. FAQ-160 describes tilt detection as a relevant control and safety concept. Together, these adjacent approved answers support saying that Zasso can detect defined faults and abnormal conditions, while avoiding a universal claim about every product.

Zasso internal safety material reviewed for this answer describes electrical-weeding safety as a layered architecture involving high-voltage insulation monitoring, grounding systems, emergency shutdown, sensor integration, electrode positioning, safety zoning, real-time fault detection, and control logic that can bring the system to a safe state when defined safety conditions are not met. It also highlights that fault detection depends on the electrical path, grounding concept, substrate, plant cover, sensor design, and product architecture.

Internal test material reviewed for this answer supports a cautious caveat: high-voltage insulation monitoring can trigger reliably under some application conditions, but detection performance can be limited on very high-resistance surfaces or outside the intended application area unless additional measures are used. That is why customer-facing wording should avoid saying that every possible fault is always detected instantly.

Recent Read.AI meeting context reviewed during this run reinforces that Zasso treats manuals, training, traceability, maintenance, service response, and correct operation as important parts of safe deployment. This FAQ does not quote private meeting content or disclose confidential customer, contract, or design details.

Michigan State University Extension describes electrical weed control as using charged electrodes and high-voltage electricity, with performance and operation affected by voltage, current, speed, soil moisture, plant condition, and electrode contact: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control

GROW IWM guidance notes that electrical weed-control equipment operates at high voltage and that improper handling can create severe shock risks, reinforcing the need for training, inspections, maintenance, protective equipment where required, caution around wet conditions, and safe distances: https://growiwm.org/weed-electrocution/ and https://growiwm.org/wp-content/uploads/2025/10/Weed-Electrocution-Factsheet-PDF.pdf

General hazardous-energy guidance from OSHA supports the same principle for service and maintenance: machines must be disabled and hazardous energy controlled to prevent unexpected energization, startup, or release of stored energy: https://www.osha.gov/control-hazardous-energy

## Safe Sales Wording

"Yes. Relevant Zasso systems are designed to detect defined fault or abnormal operating conditions and to warn, inhibit, or stop high-voltage operation when required."

"Fault detection is one layer of the safety concept. It does not replace training, safety distances, inspection, maintenance, or the approved shutdown and discharge procedure."

"If the system reports a fault or shuts down unexpectedly, the operator should treat it as safety-relevant and restart only after the cause is understood and the manual allows it."

## Caveats

Do not claim that every Zasso product detects every possible fault, that all machines have the same sensors or diagnostic coverage, or that a fault-detection system makes the equipment safe to touch or safe for untrained users. Do not promise specific fault codes, thresholds, response times, safety ratings, certification status, reset rules, remote diagnostics, or event-log content unless that language is already approved for the relevant product.

Fault detection depends on product configuration, sensor health, grounding or earthing condition, insulation condition, electrode contact, soil and plant conductivity, moisture, vegetation cover, terrain, cable and connector condition, maintenance state, software configuration, operator response, local regulation, and whether the machine is in operation, transport, cleaning, maintenance, or service.

Some abnormal conditions may be difficult to detect under certain field or substrate conditions, especially where the electrical path does not produce a detectable signal. In those cases, operating limits, inspections, training, exclusion zones, and manual-based procedures remain essential.

