# Map background image

Put the NSW terrain image here named exactly:

    nsw-terrain.jpg

(A .png also works if you change MAP_IMAGE in src/components/AustraliaMap.jsx.)

It is stretched to the map bounds set in AustraliaMap.jsx (AU_BOUNDS). If the
landmarks don't line up, tell Claude to nudge those bounds (north/south/east/west).
A higher-resolution image stays sharp when zoomed in.
