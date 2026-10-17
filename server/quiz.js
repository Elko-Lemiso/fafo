"use strict";
// Data for the flag and map rounds: the country list, flag images and the world map.
// All of it ships in node_modules, so these rounds work on a Wi-Fi with no internet.
const path = require("path");
const express = require("express");

module.exports = function quiz(app, MODULES) {
  const atlasFile = path.join(MODULES, "world-atlas/countries-50m.json");
  const atlas = require(atlasFile);
  const inAtlas = new Set(atlas.objects.countries.geometries.map(g => g.id));
  // UN members only. `m` marks countries big enough to recognise from their outline.
  const countries = require("world-countries")
    .filter(c => c.unMember && c.cca2)
    .map(c => ({ c: c.cca2.toLowerCase(), n: c.name.common, r: c.region, s: c.subregion || c.region, id: c.ccn3, m: inAtlas.has(c.ccn3) && c.area >= 25000 ? 1 : 0 }))
    .sort((a, b) => a.n.localeCompare(b.n));
  const countriesJson = JSON.stringify(countries);

  app.get("/api/countries", (req, res) => res.type("json").set("Cache-Control", "public, max-age=86400").send(countriesJson));
  app.get("/data/world.json", (req, res) => res.sendFile(atlasFile, { maxAge: "7d" }));
  app.use("/flags", express.static(path.join(MODULES, "flag-icons/flags/4x3"), { maxAge: "7d" }));
  const vendor = { "d3-array": "d3-array/dist/d3-array.min.js", "d3-geo": "d3-geo/dist/d3-geo.min.js", "topojson": "topojson-client/dist/topojson-client.min.js" };
  for (const [name, file] of Object.entries(vendor)) app.get(`/vendor/${name}.js`, (req, res) => res.sendFile(path.join(MODULES, file), { maxAge: "7d" }));
};
