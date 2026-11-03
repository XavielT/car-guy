# Google Places terms verdict (research 2026-11-03)

## VERIFIED against the live text (added by the PROMPT-00 session, 2026-11-03)
Source: https://cloud.google.com/maps-platform/terms/maps-service-terms — "(Last modified October 28, 2026)", read directly (the page is JS-rendered; the HTML was downloaded and the text extracted). The rest of this file was drafted before that and is superseded where it disagrees.

- **§14.1 Places API (Legacy and New) — Use without a Google Map:** "Customer may use Google Maps Content from the Places API in Customer Applications without a corresponding Google Map."
- **§14.2 No use with a non-Google map:** "Customer must not use Google Maps Content from the Places API in conjunction with a non-Google map." (Same clause exists for Geocoding §, Directions, Distance Matrix, Roads, Routes.)
- **§14.3 Caching:** "Customer may temporarily cache latitude and longitude values from the Places API for up to 30 consecutive calendar days, after which Customer must delete the cached latitude and longitude values."
- **General §3 Google ID caching:** "Customer may cache ... place_id from Places API, Directions API, Geolocation API and Routes API".
- **General §2 Attribution:** "Customer will attribute all the Services in accordance with the Documentation." and "Customer may not remove, alter, or obscure Google provided attribution, links to terms, or user-facing notices."
- **Places UI Kit §15.1** is the only Places product allowed with a non-Google map (not what we planned to use).

**Reading for Car Guy.** A list screen that shows Places results and contains no map is allowed (§14.1). "In conjunction with a non-Google map" (§14.2) is the risk: Car Guy has MapLibre screens, so the Places list must never share a screen with a map, never be plotted, and never feed coordinates to one. Persisting name/address/phone/rating into a Contact is not covered by any exemption (only place_id and, for 30 days, lat/lng), so the ADR-69 plan "pre-fill a Contact from Google" is NOT supported by the terms as written.

**Decision (logged in PROGRESS):** `FEATURE_GOOGLE_PLACES` default = **OFF**. If Xaviel later turns it on, only the "list-only" variant below ships: results screen without any map, Google attribution, "Open in Google Maps" link, store `place_id` only plus fields the person types; details re-fetched at display time. Default alternative for "find a gomera/taller": MapTiler Geocoding (allowed with MapLibre) or OSM Overpass (ODbL, attribute OpenStreetMap contributors).


## (a) Google content with a non-Google map
- Historical 2018 ToS s10.4(e): "You must not use the Content in a Maps API Implementation that contains a non-Google map." (https://developers.google.com/maps/terms-20180207, last updated 2018-02-07 - OLD.)
- Current Service Specific Terms snippet, Android Geocoder SDK s3.2: "No use with a non-Google map." Current Places-specific wording NOT verified. The Places Policies page says nothing requiring a Google map and nothing forbidding a non-Google one; its closest line: "Don't misrepresent Google Maps by attributing it with non-Google Maps Platform content."
- Our design shows a LIST only, no Google data (coordinates, pins, routes) on MapLibre. That is the safest reading of the rule, but a list with addresses shown next to a non-Google map is a grey area if the user can see them side by side. Mitigation: do not plot Google-returned lat/lng on the MapLibre map; use "Open in Google Maps" for any map view.

## (b) Caching / storage
- Place IDs: "Place IDs are exempt from the caching restrictions stated in Section 3.2.3(b)" and Google "recommends refreshing place IDs if they are more than 12 months old" (free Place Details call, ID field only). https://developers.google.com/maps/documentation/places/web-service/place-id
- Lat/lng: snippets of the Service Specific Terms (Android Geocoder, Address Validation) allow caching lat/lng for "up to 30 consecutive calendar days," then delete. Places API table not read; assume the same 30-day rule.
- General rule (2018 text, still the pattern): "You will not pre-fetch, cache, index, or store any Content to be used outside the Service" (s10.5(d)). Name, address, phone, rating are NOT in the exempt list -> treat as not storable beyond transient/session use.

## (c) Attribution (https://developers.google.com/maps/documentation/places/web-service/policies, no date shown)
- "Attribution should take the form of the Google Maps logo whenever possible."; where space is limited "the text Google Maps is acceptable."
- "Never remove, hide, obscure, or modify it." Extra attribution not needed on a Google Map that already shows it (not our case).
- If Google returns third-party data-provider attributions, text must "say the name 'Google Maps' and the relevant data provider(s)"; the logo alone is not enough. So pass through `attributions` / show them.

## (d) Storing phone/address into the user's own contact record
- Not addressed on the pages I could read. No explicit exemption exists for phone/address (only place_id is exempt), and a saved contact is storage of Content "outside the Service". Strictly read, NOT allowed to persist name/address/phone/rating from Places. (Counter-argument: user manually confirming and typing/editing data into their own contact is user-generated content; Google's terms do not clearly bless this. Uncertain.)

## Verdict
- "Server-side, list-only, attribution shown, nothing on MapLibre, store only place_id": this is the compliant core. Server-side calls are fine; transient display of list with logo/attribution fine; place_id storage explicitly fine; no Google data on MapLibre matches (a).
- NOT cleanly allowed: pre-filling and PERSISTING phone/address/name into a contact record (d), and anything drawn on MapLibre.
- Recommendation: `FEATURE_GOOGLE_PLACES` default = OFF in code/env until a human reads the live Service Specific Terms (Places section). If enabled, variant "list-only": show results, on user tap store only `place_id` (+ user-typed fields) and re-fetch details at display time with attribution; do not auto-persist phone/address. If counsel/reading says persisting user-confirmed contact fields is OK, flip ON.
- Documented alternatives if OFF: MapTiler Geocoding API (tied to MapTiler terms, which allow use with MapLibre; check their storage clause), or OSM Overpass / Nominatim (ODbL: storing allowed with "(c) OpenStreetMap contributors" attribution; Overpass has fair-use limits, no phone data guarantees). OSM is the best fit for storing phone/address legally.

## Uncertain
- Current text and last-modified date of Service Specific Terms; Places-specific lat/lng 30-day row; any Places-specific "non-Google map" clause; whether the user-contact save counts as caching.

## Anthropic data handling (images sent to the API)
Per Anthropic's API data-retention page (https://platform.claude.com/docs/en/manage-claude/api-and-data-retention, fetched 2026-11-03): conversation content (prompts and outputs, including images) is "not retained by default" on the Claude API except for "Covered Models" (Fable 5.x / Mythos 5.x) which require 30-day retention; retained data is "never used for model training without your express permission"; zero data retention (ZDR) is available per organization by contacting Anthropic sales (not automatic; Files API uploads are retained until deleted; Covered Models are not ZDR-eligible unless authorized). Commercial Terms page itself (anthropic.com/legal) was not fetched; confirm DPA/Commercial Terms for the exact contract wording. For vehicle photos with plates/people, prefer Haiku/Sonnet (not Covered Models) so nothing is retained.
