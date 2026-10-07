# The bundle is pure markdown with no Aurelia dependency

Version-coupling the package to Aurelia releases would force republishes on every Aurelia drop and add install friction, for zero runtime benefit — the skills execute nothing. We ship documentation only; the sole runtime dependency is the OpenCode plugin SDK. Content stays current through the source-validation process (ADR-0004) rather than through dependency bumps.
