---
faq_id: FAQ-206
question: "Can the equipment be remotely disabled?"
status: Done
audience: Customer-facing
evidence_level: Medium
last_processed: 2026-07-05
last_improved:
---

# Can the equipment be remotely disabled?

## Short Answer

Do not present remote disablement as a universal Zasso feature unless it is confirmed for the specific product, software version, market, and customer configuration. Zasso equipment is designed around product-specific safety controls such as alarms, inhibits, emergency-stop logic, interlocks, shutdown procedures, and trained operation; any connected diagnostic or fleet-management capability should be described separately and only when approved. For safety-critical situations, customers should rely on the approved local shutdown, emergency-stop, isolation, and maintenance procedures in the machine manual, not on an assumed remote command.

## Detailed Answer

The safest customer-facing answer is that remote disablement is product- and configuration-specific. Some modern machines may include connectivity, diagnostics, access control, firmware management, or service-support functions, but that does not automatically mean that a supplier can or should remotely disable high-voltage operation in the field. For Zasso, no current approved source reviewed in this run supports a blanket public claim that every machine can be remotely disabled.

Zasso's safety concept should be explained first through local and machine-level controls. Depending on the product, these may include emergency-stop functions, high-voltage enable and inhibit logic, interlocks, alarms, fault detection, controlled shutdown behavior, event logging, operator training, maintenance procedures, and product-specific restart rules. Those controls are the appropriate basis for safety discussions because they are tied to the delivered machine, its approved documentation, and its operating context.

If a specific Zasso product includes remote connectivity or service functionality, customers should confirm exactly what it can and cannot do. Important questions include whether the function is for diagnostics, software updates, access management, fleet monitoring, service support, or operational disablement; whether it affects only future starts or active operation; who is authorized to use it; what cybersecurity and audit controls apply; what happens if connectivity is lost; and how local emergency and manual isolation procedures remain available.

Remote disablement should never be positioned as a substitute for trained operators or local safety procedures. In an emergency, the operator must use the machine's approved emergency-stop and shutdown process. During service or maintenance, hazardous energy must be controlled using the required isolation, lockout, discharge, verification, and restart procedures for the machine and jurisdiction.

## What This Means for Customers

Customers should ask about the capabilities of the exact machine they are buying or operating. A Zasso representative can explain the product-specific controls, diagnostics, service process, and any approved connected features, but customers should not assume that all machines have the same remote functions.

For owners, contractors, distributors, and fleet managers, the practical implication is governance. If a connected disablement or access-control feature exists for a specific product, it should be documented in the contract, manual, service process, cybersecurity controls, user permissions, data policy, and local operating procedures. If it does not exist or is not approved for that product, the safe answer is that the machine must be controlled locally according to the manual.

For operators, the rule is simpler: do not wait for remote intervention in a safety situation. Stop the machine, maintain the safety zone, follow the approved shutdown and discharge procedure, and involve trained Zasso support or authorized service personnel when required.

## Evidence and Context

Zasso's public technology material describes Electroherb equipment as using built-in safety mechanisms such as visual and acoustic warnings, insulating materials, grounding elements, speed and height detections, and professional training: https://zasso.com/technology/

Existing Zasso FAQ files in GitHub support a product-specific and local safety-control framing. FAQ-157 covers automatic shutdown and high-voltage inhibit logic. FAQ-161 explains that relevant systems can detect defined faults and warn, inhibit, stop, latch faults, prevent restart, log events, or escalate to service depending on the product. FAQ-203 describes built-in protections as a layered safety architecture. FAQ-204 covers alarms, and FAQ-205 explains diagnostic and service-oriented logging.

Zasso GitHub concept notes on interlock loops and redundant safety circuits support the distinction between local safety functions, high-voltage enable or inhibit paths, fault latching, reset rules, automatic restart prevention, event logging, and service diagnostics. These sources do not establish a public, product-wide remote-disable capability.

SharePoint search during this run did not return a matching approved document for Zasso remote disablement, remote lockout, telematics disablement, or fleet-level operational blocking. Because no approved customer-facing remote-disable policy was verified, this answer avoids promising the feature.

Recent Read.AI meeting context reviewed during this run supports the importance of traceability, firmware and platform identification, control logic, service support, training, and maintenance discipline. This FAQ uses that context only at a high level and does not quote private meeting content or disclose confidential engineering, customer, or contract details.

External safety sources support the same conservative framing. OSHA hazardous-energy guidance explains that servicing and maintenance require practices and procedures to disable machinery or equipment and prevent unexpected energization, startup, or release of hazardous energy: https://www.osha.gov/control-hazardous-energy and https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.147. ISO 13850 describes emergency-stop design principles for machinery independent of energy type: https://www.iso.org/standard/59970.html. EU machinery safety materials identify machinery legislation as governing essential health and safety requirements for machinery placed on the EU market: https://single-market-economy.ec.europa.eu/sectors/mechanical-engineering/machinery_en.

## Safe Sales Wording

"Remote disablement should be discussed only for the specific Zasso product and configuration where it is approved and documented."

"Zasso's safety approach is based on product-specific local controls, alarms, inhibit logic, shutdown procedures, training, and maintenance discipline; remote service features, where available, do not replace those procedures."

"In an emergency or maintenance situation, operators should use the approved local shutdown, emergency-stop, isolation, and verification procedure in the machine manual."

## Caveats

Do not claim that every Zasso machine can be remotely disabled, remotely locked, remotely stopped during operation, remotely restarted, remotely updated, remotely monitored, or remotely controlled unless the statement is approved for the exact product, market, software version, connectivity package, contract, and customer use case.

Do not disclose confidential connectivity architecture, telemetry endpoints, cybersecurity controls, access credentials, service tools, firmware-update process, cloud architecture, customer data, machine identifiers, contractual rights, or disablement logic unless it has been explicitly approved for external use.

Remote connectivity, if present, may be affected by local regulation, customer consent, cybersecurity requirements, data-protection rules, connectivity availability, service contract terms, user permissions, software version, machine state, and safety design. A remote command should not be treated as a replacement for emergency stop, local isolation, lockout/tagout, discharge, voltage-free verification, maintenance inspection, or trained operator response.

