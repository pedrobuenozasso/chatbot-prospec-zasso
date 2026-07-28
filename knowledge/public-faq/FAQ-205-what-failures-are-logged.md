---
faq_id: FAQ-205
question: "What failures are logged?"
status: Done
audience: Customer-facing
evidence_level: Medium
last_processed: 2026-07-05
last_improved:
---

# What failures are logged?

## Short Answer

Zasso machines can log safety-relevant and machine-relevant events such as alarms, fault conditions, high-voltage enable or inhibit states, emergency stops, abnormal electrical conditions, sensor or communication faults, temperature or component-protection events, and service or maintenance-related events. The exact logged items depend on the product, configuration, software version, market, and approved operating manual. Customers should treat the log as a diagnostic and service-support tool, not as a complete public fault-code catalogue or a substitute for trained operation.

## Detailed Answer

For customer discussions, the safest way to describe failure logging is that Zasso equipment may record important events that help operators, service teams, and engineering understand what happened before, during, or after a machine stop, alarm, inhibit, or abnormal operating state. These records can support troubleshooting, maintenance planning, warranty analysis, fleet learning, operator training, and safe restart decisions.

Typical logging categories may include emergency-stop activation, high-voltage enabled or inhibited states, operator commands, alarm occurrences, fault latches and resets, open-circuit or short-circuit indications, abnormal current or voltage behavior, insulation or leakage warnings, grounding or return-path concerns, over-current, over-voltage, under-voltage, over-temperature, communication loss, sensor faults, electrode or applicator position issues, speed or height detection issues where fitted, tilt or movement-related conditions where fitted, power-module protection events, watchdog or controller restart events, service actions, and repeated alarm patterns.

The exact log fields should not be generalized across all products. A tractor-mounted system, vineyard or orchard applicator, urban unit, manual applicator, prototype, regional configuration, or future product may have different controllers, sensors, displays, telemetry, storage capacity, fault names, timestamps, reset behavior, service access, and data-retention rules. The approved manual, service documentation, and product-specific training are therefore the authority for what is logged and how those logs should be interpreted.

A log entry also needs context. A recorded fault does not always prove the root cause. It may show the symptom, the subsystem involved, the measured condition, the sequence of events, or the safe response taken by the control system. Proper diagnosis may still require inspection of electrodes, cables, insulation, connectors, sensors, grounding or return-path condition, software version, field conditions, operator actions, maintenance history, and any service procedure required by Zasso.

## What This Means for Customers

Failure logging helps customers and service teams avoid guesswork. When a machine stops, inhibits high voltage, raises an alarm, or repeats the same issue, logs can help identify whether the event was operator recoverable, maintenance related, environment related, sensor related, electrical, software/control related, or service critical.

For farms, contractors, distributors, municipalities, and fleet owners, this means alarm and fault history should be part of disciplined operation. Operators should record recurring alarms, avoid repeatedly resetting safety-related faults without understanding the cause, keep maintenance and inspection records, and escalate unresolved or high-voltage-related faults to trained Zasso support or authorized service personnel.

For sales discussions, the practical message is that Zasso uses diagnostics and event history to support safer operation and better service, while keeping exact fault-code lists, thresholds, and service procedures product-specific.

## Evidence and Context

Zasso's public technology material states that Electroherb products use built-in safety mechanisms including visual and acoustic warnings, insulating materials, grounding elements, speed and height detections, and professional training: https://zasso.com/technology/

Existing Zasso FAQ files in GitHub support this answer. FAQ-203 describes built-in protections as a layered safety architecture and notes that protections may include sensor-based readiness checks, fault detection, alarms, controlled shutdown behavior, maintenance, and inspection procedures. FAQ-204 explains that alarms may include safety, high-voltage, electrical fault, machine-readiness, sensor, operational, maintenance, and emergency-related categories, and that exact alarms, reset rules, and service actions are product-specific.

Zasso's GitHub concept note on failure modes supports a structured distinction between a failure mode, its cause, its effect, the detection method, reset behavior, repair action, recurrence pattern, and event or fault-log evidence. It also notes that useful machine data should preserve the subsystem boundary, operating state, measured evidence, suspected cause, severity, reset behavior, and service action where available.

SharePoint R&D guide material reviewed for this answer supports a high-level safety and diagnostics framing for high-voltage electrical weeding systems, including safety analysis, insulation monitoring, voltage distribution, short-circuit scenarios, and sensor-based safety considerations. This FAQ does not disclose confidential diagrams, thresholds, validation data, or product-specific fault-code tables.

Recent Read.AI meeting summaries reviewed during this run support the importance of traceability, maintenance support, service response, operator training, and production or module-level identification. This FAQ uses that context only at a high level and does not quote private meeting content or disclose customer, contract, or engineering details.

External safety guidance is consistent with the conservative wording. GROW IWM notes that electrical weed-control equipment operates at high voltage and requires careful handling, training, inspection, maintenance, and risk management: https://growiwm.org/wp-content/uploads/2025/10/Weed-Electrocution-Factsheet-PDF.pdf. OSHA hazardous-energy guidance reinforces that equipment servicing and maintenance require control of hazardous energy to prevent unexpected energization, startup, or release of stored energy: https://www.osha.gov/control-hazardous-energy

## Safe Sales Wording

"Zasso machines can record key alarms, fault events, safety inhibits, high-voltage status, sensor or communication faults, and service-relevant events to support diagnostics and maintenance."

"The exact fault log depends on the product and software version, so the approved manual and service documentation are the authority."

"Logs help trained teams understand what happened, but they do not replace safe shutdown, inspection, maintenance, or authorized service support."

## Caveats

Do not publish a universal Zasso fault-code table unless it has been approved for the specific product, market, software version, and customer use case. Do not claim that every Zasso machine logs the same failures, fields, timestamps, thresholds, data retention period, remote telemetry, diagnostic coverage, restart logic, service actions, or maintenance rules.

Do not disclose confidential fault codes, diagnostic thresholds, electrical values, control logic, software architecture, sensor layouts, service procedures, validation results, supplier details, customer-specific data, machine identifiers, telemetry endpoints, cybersecurity controls, or warranty rules unless already approved for external use.

A logged fault is not always a root cause. It may be a symptom, a protective response, a communication issue, a sensor issue, an environmental condition, an operator workflow issue, a maintenance issue, or a true component failure. Interpretation should follow the approved manual and service process.

