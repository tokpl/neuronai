# Scalability

`ScalabilityAnalyzer` reviews module boundaries, dependencies, and coupling.

Example:

> **Warning:** Payment module directly depends on notification system.  
> **Recommendation:** Use event communication.

Critical flows live in `ProjectScaleProfile` (default: Login, Payment, Search).
