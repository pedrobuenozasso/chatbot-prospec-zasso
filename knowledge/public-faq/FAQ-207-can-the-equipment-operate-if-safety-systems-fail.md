---
faq_id: FAQ-207
question: "Can the equipment operate if safety systems fail?"
status: Done
audience: Customer-facing
evidence_level: Medium
last_processed: 2026-07-05
last_improved:
---

# Can the equipment operate if safety systems fail?

## Short Answer

No, Zasso equipment should not be operated if a safety system has failed, is bypassed, or is reporting an unresolved fault. Based on current Zasso materials, safety-related faults are intended to warn, inhibit, stop high-voltage operation, or require service action depending on the product and fault condition. If a safety system fails or behaves unexpectedly, the safe customer-facing rule is to stop work, keep people and animals away, follow the approved manual, and restart only after the issue is understood and the equipment is cleared for operation.

## Detailed Answer

Zasso electrical weeding uses controlled high-voltage energy, so safe operation depends on more than the treatment function itself. It depends on a layered safety architecture that may include emergency stops, interlocks, high-voltage enable and inhibit logic, insulation monitoring, grounding or earthing checks, electrode-position or ground-contact monitoring, fault detection, alarms, controlled shutdown, training, inspections, and maintenance procedures.

In customer-facing terms, the equipment is designed so that defined safety or readiness conditions must be satisfied before high-voltage operation is allowed. If a relevant safety system detects an unsafe condition, reports a fault, loses a required signal, or cannot prove a required permissive condition, the expected behavior is not normal operation. Depending on the machine and configuration, the system may prevent high-voltage activation, stop output, latch a fault, display an alarm, prevent restart, or require inspection or service.

This does not mean every conceivable fault in every field condition can be detected automatically, and it does not mean a machine is safe to use simply because it appears to power on. Operators should treat failed, damaged, contaminated, bypassed, or unreliable safety systems as a stop-work condition. Examples include damaged insulation, failed emergency-stop behavior, unresolved interlock warnings, repeated high-voltage inhibit messages, grounding or return-path warnings, abnormal current behavior, damaged cables, faulty sensors, missing guards, unexplained shutdowns, or any alarm that the manual treats as safety-relevant.

The safest practical answer is: Zasso equipment is intended to operate only when the product-specific safety and readiness conditions are met. If a safety system fails, the equipment should be taken out of normal operation until the approved manual, trained operator, qualified maintenance team, or Zasso support confirms the correct action.

## What This Means for Customers

Customers should build a clear operating rule into training: do not continue work by ignoring, resetting repeatedly, bypassing, or improvising around safety faults. A safety-related alarm or failed safety device is not just a productivity issue; it may indicate that the machine cannot prove the conditions needed for high-voltage operation.

For farms, contractors, municipalities, distributors, and service teams, this means pre-use inspections, operator training, maintenance records, sensor and electrode cleanliness, cable and insulation checks, emergency-stop checks, and product-specific restart procedures matter. If the equipment stops or refuses to enable high voltage, the operator should keep the work area controlled, follow the displayed alarm and manual, and restart only when the cause has been addressed.

This framing protects both people and the customer relationship. It avoids promising that the machine can detect every possible fault, while making the safety expectation very clear: operation depends on intact safety systems and approved procedures.

## Evidence and Context

Zasso's public technology material describes Electroherb as a high-voltage system and states that safety mechanisms include visual and acoustic warnings, insulating materials, grounding elements, speed and height detections, and professional training: https://zasso.com/technology/

Existing Zasso FAQ files in GitHub support the same product-specific, layered safety framing. FAQ-157 says automatic shutdown or high-voltage inhibit functions can remove or block high-voltage operation under defined unsafe or abnormal conditions. FAQ-161 says relevant systems are designed to detect defined faults and to warn, inhibit, or stop high-voltage operation when required. FAQ-203 describes built-in protections as a layered safety architecture and cautions that the approved product manual is authoritative for exact protections and procedures.

Zasso GitHub concept notes on interlock loops and safe shutdown support a conservative engineering interpretation: safety-related permissive paths should prove required conditions before hazardous functions operate, and shutdown or inhibit behavior should move the system toward a defined safer state when a required condition is not met. These concept notes also caution that a closed loop or apparent power state does not by itself prove that all hazards are controlled.

Zasso SharePoint search during this run surfaced safety and standards context, including machinery electrical-safety material such as IEC 60204-11 documentation in the Zasso technical-support library. This FAQ uses that context only at a high level and does not disclose confidential thresholds, circuit design, service procedures, certification details, or proprietary safety architecture.

Recent Read.AI meeting context reviewed during this run reinforces the importance of manuals, training, traceability, maintenance discipline, customer support, and avoiding responsibility for unsafe operation or unauthorized equipment changes. This FAQ does not quote private meeting content or disclose customer-specific or contract-specific details.

External safety context also supports the conservative answer. Michigan State University Extension describes electrical weed control as using charged electrodes and high-voltage electricity, with operation affected by voltage, current, speed, soil moisture, plant condition, and electrode contact: https://www.canr.msu.edu/resources/basics-of-electrical-weed-control

GROW IWM guidance notes that electrical weed-control equipment operates at high voltage and that improper handling can create severe shock and fire risks, reinforcing the need for training, safe working perimeters, inspection, maintenance, protective equipment where required, and caution around difficult conditions: https://growiwm.org/weed-electrocution/ and https://growiwm.org/wp-content/uploads/2025/10/Weed-Electrocution-Factsheet-PDF.pdf

OSHA hazardous-energy guidance supports the same service and maintenance principle: workers must be protected from unexpected energization, startup, or release of stored energy during servicing and maintenance: https://www.osha.gov/control-hazardous-energy and https://www.osha.gov/etools/lockout-tagout/hot-topics/relationship-subpart-o/hazard-unexpected-energization

## Safe Sales Wording

"Zasso equipment should not be operated with a failed, bypassed, or unresolved safety system. Safety-related faults should be treated as stop-work events until the approved manual or qualified support confirms the correct action."

"The machine is designed to operate only when the required product-specific safety and readiness conditions are met; if those conditions are not proven, high-voltage operation may be inhibited or stopped."

"A safety alarm is not something to work around. It is a signal to keep the area controlled, check the manual, and restart only when the cause is understood and cleared."

## Caveats

Do not claim that every Zasso product has identical interlocks, sensors, alarms, restart rules, safety ratings, certifications, response times, or diagnostic coverage. Do not claim that every possible safety-system failure is always detected instantly, or that a machine is safe to touch or safe to operate because it has powered down.

Do not imply that customers may bypass safety devices, ignore alarms, repeatedly reset faults, improvise wiring, operate with damaged insulation or cables, operate outside the manual, or continue work while waiting for service. Do not disclose product-specific thresholds, circuit topology, firmware logic, fault codes, validation data, certification status, customer-specific requirements, or service procedures unless already approved for external use.

The exact behavior after a safety-system failure depends on the product, configuration, applicator, software and hardware version, market, documentation package, maintenance state, sensor health, cable and insulation condition, grounding or return-path condition, electrode condition, soil and plant conductivity, weather, water or metal exposure, and local safety requirements.

