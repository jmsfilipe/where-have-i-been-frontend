#Where Have I Been
##Visualizing Personal Geolocation Data
###Client Side

This repository offers the source code of the client side of Where Have I Been.

To make the analysis of personal geolocation data easier, we devised a visual language for accessing and querying that data, including support for personal semantics of locations. This visual language was validated, before proceeding to develop the system, to see if users could use it and understand it.

We then implemented this system that integrates our visual language with result viewing and map interaction. An evaluation showed people could use and understand the whole system.


![alt tag](http://web.tecnico.ulisboa.pt/jorge.s.filipe/tese/interface.png)
1. Query area
2. Result area
3. Map area
4. Settings area

To generate the JS:
browserify custom.js -o vis-custom.js -s vis
