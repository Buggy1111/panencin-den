(function () {
  "use strict";

  var state = {
    scene: "home",
    weather: null,
    outsideOutfit: "sundress",
    sunscreen: 0,
    onTowel: false,
    tubFilled: false,
    bubbles: 0,
    teeth: false,
    hair: false,
    inRobe: false,
    pajamas: false,
    inBed: false,
    alarmHour: 7,
    soundOn: true,
    bowColor: "pink",
    hairColor: "brown",
    glassesColor: "ink",
    currentMeal: null,
    mealTableSet: false,
    mealFood: null,
    mealBites: 0,
  };

  try {
    var saved = JSON.parse(localStorage.getItem("panenka-state") || "{}");
    Object.assign(state, saved);
  } catch (e) { /* ignore */ }

  function persist() {
    try { localStorage.setItem("panenka-state", JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ================= ZVUKY (Web Audio, žádné externí soubory) ================= */
  var SFX = (function () {
    var ctx = null;
    function ensureCtx() {
      if (!ctx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        ctx = new Ctx();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    function tone(freq, start, dur, type, peak) {
      var c = ensureCtx();
      if (!c) return;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, c.currentTime + start);
      g.gain.setValueAtTime(0.0001, c.currentTime + start);
      g.gain.linearRampToValueAtTime(peak || 0.2, c.currentTime + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime + start);
      o.stop(c.currentTime + start + dur + 0.05);
    }
    function noise(start, dur, peak, lp) {
      var c = ensureCtx();
      if (!c) return;
      var n = Math.max(1, Math.floor(c.sampleRate * dur));
      var buf = c.createBuffer(1, n, c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = c.createBufferSource();
      src.buffer = buf;
      var filt = c.createBiquadFilter();
      filt.type = "lowpass"; filt.frequency.value = lp || 1200;
      var g = c.createGain();
      g.gain.setValueAtTime(peak || 0.15, c.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
      src.connect(filt); filt.connect(g); g.connect(c.destination);
      src.start(c.currentTime + start); src.stop(c.currentTime + start + dur + 0.05);
    }
    function guard(fn) { return function () { if (state.soundOn) fn(); }; }
    return {
      tap: guard(function () { tone(560, 0, 0.1, "sine", 0.16); }),
      select: guard(function () { tone(720, 0, 0.09, "triangle", 0.18); tone(920, 0.05, 0.1, "triangle", 0.14); }),
      chime: guard(function () { tone(660, 0, 0.16, "sine", 0.2); tone(880, 0.08, 0.2, "sine", 0.18); tone(990, 0.16, 0.3, "sine", 0.16); }),
      sparkle: guard(function () { for (var i = 0; i < 4; i++) tone(1100 + i * 180, i * 0.05, 0.12, "sine", 0.1); }),
      splash: guard(function () { noise(0, 0.4, 0.22, 1600); tone(200, 0, 0.3, "sine", 0.08); }),
      bubble: guard(function () { tone(900 + Math.random() * 300, 0, 0.09, "sine", 0.08); }),
      bell: guard(function () { tone(1400, 0, 0.14, "square", 0.1); tone(1400, 0.2, 0.14, "square", 0.1); tone(1400, 0.4, 0.2, "square", 0.1); }),
      whoosh: guard(function () { noise(0, 0.3, 0.14, 2200); }),
      fanfare: guard(function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, i * 0.13, 0.22, "triangle", 0.22); });
        tone(1046.5, 0.5, 0.45, "sine", 0.2);
      }),
    };
  })();

  /* ================= HLAS (Web Speech API, český ženský hlas) ================= */
  var VOICE = (function () {
    var pickedVoice = null;
    function pickVoice() {
      if (!window.speechSynthesis) return;
      var voices = window.speechSynthesis.getVoices() || [];
      var czech = voices.filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf("cs") === 0; });
      var female = czech.filter(function (v) { return /female|žena|zuzana|iveta|klara|petra/i.test(v.name); });
      pickedVoice = female[0] || czech[0] || voices.filter(function (v) { return /female/i.test(v.name); })[0] || null;
    }
    if (window.speechSynthesis) {
      pickVoice();
      window.speechSynthesis.onvoiceschanged = pickVoice;
    }
    return {
      say: function (text) {
        if (!state.soundOn || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = "cs-CZ";
        if (pickedVoice) u.voice = pickedVoice;
        u.pitch = 1.15;
        u.rate = 0.96;
        window.speechSynthesis.speak(u);
      },
      stop: function () { if (window.speechSynthesis) window.speechSynthesis.cancel(); },
    };
  })();

  var soundBtn = document.getElementById("soundBtn");
  soundBtn.addEventListener("click", function () {
    state.soundOn = !state.soundOn;
    soundBtn.textContent = state.soundOn ? "🔊" : "🔇";
    if (!state.soundOn) VOICE.stop();
    persist();
  });
  soundBtn.textContent = state.soundOn ? "🔊" : "🔇";

  var tpl = document.getElementById("dollTemplate");
  var doll = tpl.content.firstElementChild.cloneNode(true);
  var spots = {
    home: document.getElementById("dollSpotHome"),
    outside: document.getElementById("dollSpotOutside"),
    beach: document.getElementById("dollSpotBeach"),
    bath: document.getElementById("dollSpotBath"),
    meal: document.getElementById("dollSpotMeal"),
    bedtime: document.getElementById("dollSpotBed"),
  };

  function setOutfit(name) {
    doll.querySelectorAll(".outfit").forEach(function (g) {
      g.classList.toggle("on", g.dataset.outfit === name);
    });
    burstSparkle();
  }
  function setAccessory(name, on) {
    var g = doll.querySelector('.accessory[data-accessory="' + name + '"]');
    if (g) g.classList.toggle("on", !!on);
  }
  function clearAccessories() {
    doll.querySelectorAll(".accessory").forEach(function (g) { g.classList.remove("on"); });
  }
  function burstSparkle() {
    var b = doll.querySelector("#sparkleBurst");
    if (!b) return;
    b.classList.remove("go");
    void b.offsetWidth;
    b.classList.add("go");
  }

  /* Barva mašličky — kosmetická volba na doll elementu přes CSS proměnné,
     platí ve všech scénách (mašle je součást panenky, ne kroje). */
  var bowPalette = {
    pink: { a: "#ff6fa5", b: "#ff87b3", c: "#e8497f", label: "růžová" },
    blue: { a: "#5b8def", b: "#7ea3f2", c: "#3a68c9", label: "modrá" },
    purple: { a: "#a978d6", b: "#c39fe8", c: "#8355b8", label: "fialová" },
    gold: { a: "#f5b942", b: "#f7cc73", c: "#d99a1f", label: "zlatá" },
  };
  function applyBowColor() {
    var p = bowPalette[state.bowColor] || bowPalette.pink;
    doll.style.setProperty("--bow-a", p.a);
    doll.style.setProperty("--bow-b", p.b);
    doll.style.setProperty("--bow-c", p.c);
    document.querySelectorAll(".bow-swatch").forEach(function (b) {
      b.classList.toggle("picked", b.dataset.bow === state.bowColor);
    });
  }
  document.querySelectorAll(".bow-swatch").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.bowColor = btn.dataset.bow;
      applyBowColor();
      persist();
      SFX.tap();
      VOICE.say("Mašlička je teď " + (bowPalette[state.bowColor].label) + ".");
    });
  });

  /* Barva vlásků — stejný princip jako mašlička (CSS proměnné na doll elementu). */
  var hairPalette = {
    brown: { a: "#8a6249", b: "#5f4130", label: "hnědá" },
    black: { a: "#4a3a4a", b: "#241c28", label: "černá" },
    blonde: { a: "#f2d38a", b: "#d9ac52", label: "plavá" },
    ginger: { a: "#e8823f", b: "#c05a26", label: "rezavá" },
  };
  function applyHairColor() {
    var p = hairPalette[state.hairColor] || hairPalette.brown;
    doll.style.setProperty("--hair-a", p.a);
    doll.style.setProperty("--hair-b", p.b);
    document.querySelectorAll(".hair-swatch").forEach(function (b) {
      b.classList.toggle("picked", b.dataset.hair === state.hairColor);
    });
  }
  document.querySelectorAll(".hair-swatch").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.hairColor = btn.dataset.hair;
      applyHairColor();
      persist();
      SFX.tap();
      VOICE.say("Vlásky jsou teď " + (hairPalette[state.hairColor].label) + ".");
    });
  });

  /* Barva brýlí (sluneční brýle na pláži) — stejný princip, jen jedna CSS proměnná. */
  var glassesPalette = {
    ink: { a: "#4a3350", label: "tmavá" },
    red: { a: "#e8432e", label: "červená" },
    blue: { a: "#3a68c9", label: "modrá" },
    green: { a: "#4fa868", label: "zelená" },
  };
  function applyGlassesColor() {
    var p = glassesPalette[state.glassesColor] || glassesPalette.ink;
    doll.style.setProperty("--glasses-a", p.a);
    document.querySelectorAll(".glasses-swatch").forEach(function (b) {
      b.classList.toggle("picked", b.dataset.glasses === state.glassesColor);
    });
  }
  document.querySelectorAll(".glasses-swatch").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.glassesColor = btn.dataset.glasses;
      applyGlassesColor();
      persist();
      SFX.tap();
      VOICE.say("Brýle jsou teď " + (glassesPalette[state.glassesColor].label) + ".");
    });
  });

  /* Odznáčky — trvalá sbírka nezávislá na `state` (ten se při návratu domů
     částečně resetuje kvůli znovuhratelnosti; odznáčky ne, jsou to trofeje). */
  var badges = { outside: false, beach: false, bath: false, breakfast: false, lunch: false, dinner: false, bedtime: false };
  try { Object.assign(badges, JSON.parse(localStorage.getItem("panenka-badges") || "{}")); } catch (e) { /* ignore */ }
  function persistBadges() {
    try { localStorage.setItem("panenka-badges", JSON.stringify(badges)); } catch (e) { /* ignore */ }
  }
  function renderBadges() {
    document.querySelectorAll(".badge").forEach(function (el) {
      el.classList.toggle("earned", !!badges[el.dataset.badge]);
    });
  }
  var allBadgesTimer = null;
  function checkAllBadges() {
    var allDone = badges.outside && badges.beach && badges.bath &&
      badges.breakfast && badges.lunch && badges.dinner && badges.bedtime;
    if (!allDone) return;
    SFX.fanfare();
    burstSparkle();
    VOICE.say("Paráda! Andulka dneska zvládla úplně všechno! Za chviličku si to může vysbírat znovu.");
    var strip = document.getElementById("badgeStrip");
    strip.classList.remove("celebrate");
    void strip.offsetWidth;
    strip.classList.add("celebrate");
    setTimeout(function () { strip.classList.remove("celebrate"); }, 2200);
    // Po chvilce se odznáčky vrátí do výchozího stavu, ať je má Andulka pořád
    // co sbírat znovu — nejsou to jednorázové trofeje, ale opakovatelný cíl.
    if (allBadgesTimer) clearTimeout(allBadgesTimer);
    allBadgesTimer = setTimeout(function () {
      badges.outside = badges.beach = badges.bath = badges.breakfast = badges.lunch = badges.dinner = badges.bedtime = false;
      persistBadges();
      renderBadges();
    }, 60000);
  }
  function earnBadge(key) {
    if (badges[key]) return;
    badges[key] = true;
    persistBadges();
    renderBadges();
    var el = document.querySelector('.badge[data-badge="' + key + '"]');
    if (el) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
    SFX.bell();
    checkAllBadges();
  }

  var SCENE_INTRO = {
    home: "Ahoj! Co budeme dělat?",
    outside: "Jdeme ven. Nejdřív se podíváme, jaké je venku počasí.",
    beach: "Jedeme na pláž! Nezapomeneme na krém proti sluníčku.",
    bath: "Je čas na koupel a čisté tělíčko.",
    bedtime: "Připravíme se na spaní. Pravidelný spánek dělá tělu moc dobře.",
  };

  /* Když se vrátí na hlavní obrazovku, aktivity se vrátí do výchozího stavu —
     ať si je může hrát znovu (namazat krémem, vykoupat, uspat) pořád dokola.
     Volby počasí/oblečení venku a čas budíku zůstávají (to je "nastavení", ne "hotovo"). */
  function resetActivities() {
    state.sunscreen = 0;
    state.onTowel = false;
    state.tubFilled = false;
    state.bubbles = 0;
    state.teeth = false;
    state.hair = false;
    state.inRobe = false;
    state.pajamas = false;
    state.inBed = false;
    state.mealTableSet = false;
    state.mealFood = null;
    state.mealBites = 0;
    if (wakeBtn && wakeBtn._timer) clearInterval(wakeBtn._timer);
    if (nightVeil) nightVeil.classList.remove("on");
    if (goodnightText) goodnightText.classList.remove("on");
    doll.classList.remove("sleeping");
    document.querySelectorAll(".zzz").forEach(function (z) { z.remove(); });
  }

  function goScene(name) {
    var changed = state.scene !== name;
    if (name === "home" && changed) resetActivities();
    state.scene = name;
    document.querySelectorAll(".scene").forEach(function (s) {
      s.classList.toggle("active", s.dataset.scene === name);
    });
    var spot = spots[name];
    if (spot && doll.parentElement !== spot) spot.appendChild(doll);

    clearAccessories();
    if (name === "beach") {
      // U moře je vždy nejdřív v plavkách, dokud si nelehne na deku.
      setOutfit("swimsuit");
    } else if (name === "bath") {
      // Než se vykoupe, je pořád v plavkách; po utření/oblečení je v županku.
      setOutfit(state.inRobe ? "robe" : "swimsuit");
      setAccessory("turban", state.inRobe);
    } else if (name === "bedtime") {
      // Dokud si nevezme pyžamko, zůstává v tom, co má z venku.
      setOutfit(state.pajamas ? "pajamas" : state.outsideOutfit);
    } else {
      setOutfit(state.outsideOutfit);
      setAccessory("tiara", state.outsideOutfit === "princess");
      if (name === "outside") tryAutoWeather();
    }
    renderAll();
    persist();
    if (changed) {
      SFX.select();
      var intro = name === "meal" ? mealMeta[state.currentMeal || "dinner"].intro : SCENE_INTRO[name];
      if (intro) VOICE.say(intro);
    }
  }

  document.querySelectorAll("[data-goto]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (btn.dataset.meal) state.currentMeal = btn.dataset.meal;
      goScene(btn.dataset.goto);
    });
  });

  /* ---------------- OUTSIDE ---------------- */
  var weatherMap = {
    sun: { cls: "w-sun", match: "sundress", label: "Sluníčko svítí!",
      why: "Sluníčko svítí. Na sluníčku nosíme lehké oblečení a chráníme kůži." },
    rain: { cls: "w-rain", match: "raincoat", label: "Prší, prší!",
      why: "Venku prší. Pláštěnka a holínky nás udrží krásně v suchu." },
    cold: { cls: "w-cold", match: "coat", label: "Brrr, je zima!",
      why: "Je zima. Teplý kabátek a šálu, ať nám není zima." },
    cloud: { cls: "w-cloud", match: "cardigan", label: "Zataženo, ale příjemně.",
      why: "Je zataženo, ale teplo. Stačí lehký svetřík." },
  };
  /* Který kus oblečení se hodí na jaké počasí — jakmile si dítě vybere počasí,
     nabídka se zúží jen na to, co má smysl (netahat plavky do zimy). */
  var outfitWeather = {
    sundress: "sun", blue: "sun", pink: "sun", princess: "sun", green: "sun", yellow: "sun",
    cardigan: "cloud", denim: "cloud", windbreaker: "cloud", grayhoodie: "cloud", vest: "cloud", stripedtee: "cloud",
    raincoat: "rain", poncho: "rain", blueraincoat: "rain", greenstriped: "rain", pinkponcho: "rain", yellowoveralls: "rain",
    coat: "cold", snowsuit: "cold", purplesnowsuit: "cold", redcoat: "cold", graysweaterscarf: "cold", greenparka: "cold",
  };
  var outfitNames = {
    sundress: "Letní šatičky", raincoat: "Pláštěnka s holínkami", coat: "Zimní kabátek",
    cardigan: "Svetřík", blue: "Modré šaty", pink: "Růžové šaty", denim: "Riflové overaly",
    princess: "Princeznovské šaty", snowsuit: "Zimní kombinéza s botičkami",
    poncho: "Puntíkovaná pláštěnka", windbreaker: "Podzimní bunda",
    green: "Zelené šatičky", yellow: "Žluté tílko", grayhoodie: "Šedá mikina",
    vest: "Zelená vesta", stripedtee: "Pruhované triko", blueraincoat: "Modrá pláštěnka",
    greenstriped: "Zelená pruhovaná pláštěnka s holínkami", pinkponcho: "Růžové pončo s puntíky",
    yellowoveralls: "Žlutý nepromokavý overal", purplesnowsuit: "Fialová zimní kombinéza",
    redcoat: "Červený zimní kabát", graysweaterscarf: "Šedý svetr se šálou",
    greenparka: "Zelená parka s kožíškem",
  };
  var outsideSky = document.getElementById("outsideSky");
  var weatherFx = document.getElementById("weatherFx");
  var outsideFeedback = document.getElementById("outsideFeedback");
  var tempBadge = document.getElementById("tempBadge");

  /* Skutečné počasí podle polohy (Open-Meteo, bez klíče) — nastaví se jen
     jednou, při prvním vstupu ven, než si dítě samo něco vybere. Pak už se
     do volby nepleteme, ať si může zkoušet libovolné počasí na cvičení. */
  var autoWeatherTried = false;
  function classifyWeatherCode(code, tempC) {
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].indexOf(code) !== -1) return "rain";
    if ([71, 73, 75, 77, 85, 86].indexOf(code) !== -1) return "cold";
    if (typeof tempC === "number" && tempC <= 5) return "cold";
    if ([2, 3, 45, 48].indexOf(code) !== -1) return "cloud";
    return "sun";
  }
  function tryAutoWeather() {
    if (autoWeatherTried || !("geolocation" in navigator)) return;
    autoWeatherTried = true;
    tempBadge.textContent = "🌡️ zjišťuji počasí venku…";
    tempBadge.style.display = "";
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var url = "https://api.open-meteo.com/v1/forecast?latitude=" + pos.coords.latitude +
          "&longitude=" + pos.coords.longitude + "&current=temperature_2m,weather_code&timezone=auto";
        fetch(url)
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data || !data.current) { tempBadge.style.display = "none"; return; }
            // Teplotu ukážeme vždy, i když si dítě počasí už samo vybralo —
            // volbu počasí ale přepíšeme jen napoprvé, dokud ji nikdo neurčil.
            tempBadge.textContent = "🌡️ " + Math.round(data.current.temperature_2m) + " °C venku";
            if (!state.weather) {
              state.weather = classifyWeatherCode(data.current.weather_code, data.current.temperature_2m);
              renderOutside();
              persist();
              outsideFeedback.textContent = "Podle skutečného počasí venku! 🌦️";
              outsideFeedback.classList.add("show");
              VOICE.say(weatherMap[state.weather].why);
            }
          })
          .catch(function () { tempBadge.style.display = "none"; });
      },
      function () { tempBadge.style.display = "none"; },
      { timeout: 10000 }
    );
  }

  function renderWeatherFx(w) {
    weatherFx.innerHTML = "";
    if (w === "sun") {
      weatherFx.innerHTML = '<div class="ray"></div>';
    } else if (w === "rain") {
      for (var i = 0; i < 10; i++) {
        var d = document.createElement("div");
        d.className = "drop";
        d.style.left = (i * 10 + 3) + "%";
        d.style.animationDelay = (i * 0.09) + "s";
        weatherFx.appendChild(d);
      }
    } else if (w === "cold") {
      for (var j = 0; j < 12; j++) {
        var f = document.createElement("div");
        f.className = "flake";
        f.style.left = (j * 8 + 2) + "%";
        f.style.animationDelay = (j * 0.4) + "s";
        f.style.animationDuration = (5 + (j % 3)) + "s";
        weatherFx.appendChild(f);
      }
    } else if (w === "cloud") {
      for (var k = 0; k < 3; k++) {
        var p = document.createElement("div");
        p.className = "puff";
        p.style.top = (10 + k * 14) + "%";
        p.style.animationDuration = (16 + k * 6) + "s";
        p.style.animationDelay = (-k * 5) + "s";
        weatherFx.appendChild(p);
      }
    }
  }

  function renderOutside() {
    document.querySelectorAll('[data-weather]').forEach(function (b) {
      b.classList.toggle("picked", b.dataset.weather === state.weather);
    });
    document.querySelectorAll('#outsideOutfits [data-outfit]').forEach(function (b) {
      b.classList.toggle("picked", b.dataset.outfit === state.outsideOutfit);
      var star = b.querySelector(".star");
      if (star) star.remove();
      if (state.weather && weatherMap[state.weather].match === b.dataset.outfit) {
        var s = document.createElement("span");
        s.className = "star";
        s.textContent = "⭐";
        b.appendChild(s);
      }
      // Nabídka se zúží na oblečení pro zvolené počasí; dokud počasí nevybrala,
      // vidí úplně všechno.
      b.style.display = (!state.weather || outfitWeather[b.dataset.outfit] === state.weather) ? "" : "none";
    });
    if (state.weather) {
      outsideSky.className = "scene-bg sky-bg " + weatherMap[state.weather].cls;
      renderWeatherFx(state.weather);
    }
    if (state.scene === "outside") setAccessory("umbrella", state.weather === "rain");
  }

  document.querySelectorAll('[data-weather]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.weather = btn.dataset.weather;
      renderOutside();
      persist();
      SFX.tap();
      VOICE.say(weatherMap[state.weather].why);
    });
  });
  document.querySelectorAll('#outsideOutfits [data-outfit]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.outsideOutfit = btn.dataset.outfit;
      setOutfit(state.outsideOutfit);
      setAccessory("tiara", state.outsideOutfit === "princess");
      renderOutside();
      var match = state.weather && weatherMap[state.weather].match === state.outsideOutfit;
      if (match) earnBadge("outside");
      outsideFeedback.textContent = match
        ? "Paráda, přesně na tohle počasí! Jde ven s kamarádkou. 🎉"
        : "Krásně oblečená! I tak si užije procházku. 💛";
      outsideFeedback.classList.add("show");
      persist();
      SFX.chime();
      VOICE.say(outfitNames[state.outsideOutfit] + ". " + (match
        ? "Paráda, tohle oblečení je na dnešní počasí úplně nejlepší!"
        : "Hezké oblečení! Jde ven s kamarádkou."));
    });
  });

  /* ---------------- BEACH ---------------- */
  var sunscreenBtn = document.getElementById("sunscreenBtn");
  var sunscreenFill = document.getElementById("sunscreenFill");
  var sunscreenWrap = document.getElementById("sunscreenWrap");
  var shineRing = document.getElementById("shineRing");
  var towelBtn = document.getElementById("towelBtn");
  var towelMat = document.getElementById("towelMat");
  var beachFeedback = document.getElementById("beachFeedback");
  var dollSpotBeach = document.getElementById("dollSpotBeach");

  function renderBeach() {
    sunscreenFill.style.width = Math.min(100, state.sunscreen * 20) + "%";
    sunscreenWrap.style.display = state.sunscreen >= 5 ? "none" : "flex";
    towelMat.classList.toggle("active", state.onTowel);
    dollSpotBeach.classList.toggle("lying", state.onTowel);
    dollSpotBeach.style.bottom = state.onTowel ? "4.8%" : "26%";
    towelBtn.textContent = state.onTowel ? "Zvednout z deky" : "Položit na deku";
    if (state.sunscreen >= 5 && !state.onTowel) {
      beachFeedback.textContent = "Krásně chráněná krémem! ☀️🧴";
      beachFeedback.classList.add("show");
    }
  }

  sunscreenBtn.addEventListener("click", function () {
    if (state.sunscreen >= 5) return;
    state.sunscreen++;
    shineRing.classList.remove("go");
    void shineRing.offsetWidth;
    shineRing.classList.add("go");
    renderBeach();
    persist();
    SFX.sparkle();
    if (state.sunscreen === 1) VOICE.say("Krém chrání kůži před sluníčkem, aby se nespálila.");
    if (state.sunscreen === 5) VOICE.say("Hotovo, kůže je krásně chráněná!");
    if (state.sunscreen >= 5 && state.onTowel) earnBadge("beach");
  });
  towelBtn.addEventListener("click", function () {
    state.onTowel = !state.onTowel;
    if (state.onTowel) {
      beachFeedback.textContent = "Ahhh, pohodička na sluníčku! 😌";
      beachFeedback.classList.add("show");
      if (state.sunscreen >= 5) earnBadge("beach");
    }
    renderBeach();
    persist();
    SFX.select();
    VOICE.say(state.onTowel ? "Teď si krásně odpočine na dece ve stínu deštníku." : "Vstává z deky.");
  });

  /* ---------------- BATH ---------------- */
  var fillBtn = document.getElementById("fillBtn");
  var bubbleBtn = document.getElementById("bubbleBtn");
  var toothBtn = document.getElementById("toothBtn");
  var hairBtn = document.getElementById("hairBtn");
  var drainBtn = document.getElementById("drainBtn");
  var tubWater = document.getElementById("tubWater");
  var bubbleField = document.getElementById("bubbleField");
  var bathFeedback = document.getElementById("bathFeedback");
  var dollSpotBath = document.getElementById("dollSpotBath");
  var sink = document.getElementById("sink");

  function renderBath() {
    tubWater.style.height = state.tubFilled ? "70%" : "0%";
    var lying = state.tubFilled && !state.inRobe;
    dollSpotBath.classList.toggle("lying", lying);
    dollSpotBath.style.bottom = lying ? "9.8%" : (state.tubFilled ? "22%" : "30%");
    fillBtn.disabled = state.tubFilled;
    bubbleBtn.disabled = !state.tubFilled || state.inRobe;
    drainBtn.disabled = !state.tubFilled || state.inRobe;
    // Zoubky a vlásky se řeší u umyvadla, ne ve vaně — teprve když je osušená a oblečená.
    toothBtn.disabled = !state.inRobe;
    toothBtn.textContent = state.teeth ? "Zoubky čisté! 🪥✔️" : "Vyčistit zoubky 🪥";
    hairBtn.disabled = !state.inRobe;
    hairBtn.textContent = state.hair ? "Vlásky učesané! 💇✔️" : "Učesat vlásky 💇";
    sink.classList.toggle("active", state.inRobe);
    if (state.scene === "bath") setAccessory("turban", state.inRobe);
    if (state.inRobe) {
      bathFeedback.textContent = "Čistá, voňavá a v županku! ✨";
      bathFeedback.classList.add("show");
    }
  }
  function popBubble() {
    var b = document.createElement("div");
    var size = 8 + Math.random() * 14;
    b.className = "bubble";
    b.style.width = size + "px";
    b.style.height = size + "px";
    b.style.left = (20 + Math.random() * 60) + "%";
    bubbleField.appendChild(b);
    setTimeout(function () { b.remove(); }, 2700);
  }

  fillBtn.addEventListener("click", function () {
    state.tubFilled = true;
    renderBath();
    var t = setInterval(popBubble, 220);
    setTimeout(function () { clearInterval(t); }, 1600);
    persist();
    SFX.splash();
    VOICE.say("Napouštíme teplou vodu do vaničky.");
  });
  bubbleBtn.addEventListener("click", function () {
    for (var i = 0; i < 4; i++) setTimeout(popBubble, i * 90);
    state.bubbles++;
    persist();
    SFX.bubble();
    if (state.bubbles === 1) VOICE.say("Bublinky voní a moc hezky čistí pokožku.");
  });
  toothBtn.addEventListener("click", function () {
    state.teeth = true;
    renderBath();
    persist();
    burstSparkle();
    SFX.sparkle();
    bathFeedback.textContent = "Čisté zoubky, žádný kaz! 🦷✨";
    bathFeedback.classList.add("show");
    VOICE.say("Zoubky si čistíme ráno a večer, aby byly zdravé a nebolely.");
    if (state.hair) earnBadge("bath");
  });
  hairBtn.addEventListener("click", function () {
    state.hair = true;
    renderBath();
    persist();
    burstSparkle();
    SFX.chime();
    if (state.teeth) earnBadge("bath");
    bathFeedback.textContent = "Krásně učesané vlásky! 💇✨";
    bathFeedback.classList.add("show");
    VOICE.say("Vlásky si po koupeli hezky pročešeme, ať se netrhají a pěkně se lesknou.");
  });
  drainBtn.addEventListener("click", function () {
    state.inRobe = true;
    state.tubFilled = false;
    setOutfit("robe");
    renderBath();
    persist();
    SFX.whoosh();
    VOICE.say("Hotovo! Čistá, osušená a voňavá.");
  });

  /* ---------------- MEAL (snídaně/oběd/večeře — jedna scéna, tři kontexty) ---------------- */
  var mealEyebrow = document.getElementById("mealEyebrow");
  var mealBg = document.getElementById("mealBg");
  var mealFeedback = document.getElementById("mealFeedback");
  var plateFood = document.getElementById("plateFood");
  var setTableBtn = document.getElementById("setTableBtn");
  var eatBtn = document.getElementById("eatBtn");

  var mealMeta = {
    breakfast: { title: "Snídaně", cls: "", intro: "Dobré ráno! Co si dá Andulka k snídani?" },
    lunch: { title: "Oběd", cls: "midday", intro: "Je poledne, čas na oběd." },
    dinner: { title: "Večeře", cls: "evening", intro: "Slunce zapadá, čas na večeři." },
  };
  var mealFoodInfo = {
    porridge: { label: "Kaše s ovocem", emo: "🥣", why: "Kaše zasytí a dá sílu na celé dopoledne." },
    toast: { label: "Toast s medem", emo: "🍞", why: "Celozrnný toast s medem je sladká a zdravá snídaně." },
    cereal: { label: "Mléko s cereáliemi", emo: "🥛", why: "Mléko dodá vápník na silné kosti a zoubky." },
    egg: { label: "Vajíčko", emo: "🍳", why: "Vajíčko je plné bílkovin, ze kterých rosteme." },
    soup: { label: "Polévka", emo: "🍲", why: "Teplá polévka zahřeje bříško a je plná vitamínů." },
    pasta: { label: "Těstoviny se zeleninou", emo: "🍝", why: "Těstoviny dodají energii a zelenina vitamíny." },
    salad: { label: "Salát", emo: "🥗", why: "Čerstvá zelenina je plná vitamínů a vlákniny." },
    chicken: { label: "Kuřecí s rýží", emo: "🍗", why: "Kuřecí maso a rýže dodají sílu na odpoledne." },
    dumplings: { label: "Knedlíky s omáčkou", emo: "🍛", why: "Klasická česká večeře, moc dobrá." },
    sandwich: { label: "Chleba se sýrem", emo: "🥪", why: "Lehká večeře, ať se dobře usíná." },
    veggies: { label: "Zeleninový talíř", emo: "🥗", why: "Zelenina večer je lehká na bříško." },
    fruit: { label: "Ovoce", emo: "🍓", why: "Sladké ovoce místo sladkostí." },
  };

  function renderMeal() {
    var meal = state.currentMeal || "dinner";
    var meta = mealMeta[meal];
    mealEyebrow.textContent = meta.title;
    mealBg.className = "scene-bg meal-bg" + (meta.cls ? " " + meta.cls : "");
    document.querySelectorAll("#mealFoodRail [data-food]").forEach(function (b) {
      b.style.display = b.dataset.meal === meal ? "" : "none";
      b.classList.toggle("picked", b.dataset.food === state.mealFood);
    });
    setTableBtn.disabled = state.mealTableSet;
    setTableBtn.textContent = state.mealTableSet ? "Stůl prostřený ✔️" : "Prostřít stůl 🍽️";
    eatBtn.disabled = !state.mealTableSet || !state.mealFood || state.mealBites >= 5;
    eatBtn.textContent = state.mealBites >= 5 ? "Mňam, hotovo! 😋✔️" : "Ochutnat 😋";
    var info = state.mealFood ? mealFoodInfo[state.mealFood] : null;
    plateFood.textContent = info ? info.emo : "";
    plateFood.classList.toggle("on", !!info);
  }

  document.querySelectorAll("#mealFoodRail [data-food]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.mealFood = btn.dataset.food;
      state.mealBites = 0;
      renderMeal();
      persist();
      SFX.tap();
      var info = mealFoodInfo[state.mealFood];
      mealFeedback.textContent = info.label + " — dobrá volba! 😋";
      mealFeedback.classList.add("show");
      VOICE.say(info.label + ". " + info.why);
    });
  });
  setTableBtn.addEventListener("click", function () {
    state.mealTableSet = true;
    renderMeal();
    persist();
    SFX.select();
    VOICE.say("Prostřeme pěkně stůl, talíř a příbor.");
  });
  eatBtn.addEventListener("click", function () {
    if (state.mealBites >= 5) return;
    state.mealBites++;
    renderMeal();
    persist();
    if (state.mealBites >= 5) {
      SFX.chime();
      burstSparkle();
      mealFeedback.textContent = "Mňam, všechno snědla! 😋";
      mealFeedback.classList.add("show");
      VOICE.say("Mňam, všechno snědla! Za chviličku si jde umýt pusu a vyčistit zoubky.");
      earnBadge(state.currentMeal || "dinner");
    } else {
      SFX.bubble();
      mealFeedback.textContent = "Mňam! (" + state.mealBites + "/5)";
      mealFeedback.classList.add("show");
      if (state.mealBites === 1) VOICE.say("Papáme pomalu a pořádně kousáme.");
    }
  });

  /* ---------------- BEDTIME ---------------- */
  var pajamaBtn = document.getElementById("pajamaBtn");
  var tuckBtn = document.getElementById("tuckBtn");
  var goodnightBtn = document.getElementById("goodnightBtn");
  var blanket = document.getElementById("blanket");
  var clockCard = document.getElementById("clockCard");
  var clockTime = document.getElementById("clockTime");
  var hourUp = document.getElementById("hourUp");
  var hourDown = document.getElementById("hourDown");
  var nightVeil = document.getElementById("nightVeil");
  var goodnightText = document.getElementById("goodnightText");
  var wakeBtn = document.getElementById("wakeBtn");
  var bedFeedback = document.getElementById("bedFeedback");
  var dollSpotBed = document.getElementById("dollSpotBed");

  function renderClock() {
    clockTime.textContent = state.alarmHour + ":00";
  }
  function renderBed() {
    pajamaBtn.disabled = state.pajamas;
    tuckBtn.disabled = !state.pajamas || state.inBed;
    blanket.classList.toggle("on", state.inBed);
    dollSpotBed.classList.toggle("lying", state.inBed);
    dollSpotBed.style.bottom = state.inBed ? "4.9%" : "32%";
    clockCard.style.display = state.inBed ? "flex" : "none";
    goodnightBtn.disabled = !state.inBed;
    doll.classList.toggle("sleeping", state.scene === "bedtime" && state.inBed);
    renderClock();
  }

  pajamaBtn.addEventListener("click", function () {
    state.pajamas = true;
    setOutfit("pajamas");
    bedFeedback.textContent = "Měkoučké pyžamko! 🌙";
    bedFeedback.classList.add("show");
    renderBed();
    persist();
    SFX.sparkle();
    VOICE.say("Měkoučké pyžamko na spaní.");
  });
  tuckBtn.addEventListener("click", function () {
    state.inBed = true;
    renderBed();
    bedFeedback.textContent = "Nastav budíček na ráno.";
    bedFeedback.classList.add("show");
    persist();
    SFX.whoosh();
    VOICE.say("Uložíme ji do postýlky a přikryjeme dekou. Teď nastavíme budíček na ráno.");
  });
  hourUp.addEventListener("click", function () {
    state.alarmHour = state.alarmHour >= 10 ? 6 : state.alarmHour + 1;
    renderClock(); persist();
    SFX.tap();
  });
  hourDown.addEventListener("click", function () {
    state.alarmHour = state.alarmHour <= 6 ? 10 : state.alarmHour - 1;
    renderClock(); persist();
    SFX.tap();
  });
  goodnightBtn.addEventListener("click", function () {
    SFX.bell();
    VOICE.say("Budík zvoní v " + state.alarmHour + " hodin. Dobrou noc! Spánek pomáhá tělu i hlavě odpočinout a růst.");
    earnBadge("bedtime");
    nightVeil.classList.add("on");
    setTimeout(function () { goodnightText.classList.add("on"); }, 300);
    var zzzTimer = setInterval(function () {
      var z = document.createElement("div");
      z.className = "zzz go";
      z.textContent = "z";
      z.style.left = (46 + Math.random() * 10) + "%";
      z.style.bottom = "26%";
      document.querySelector('[data-scene="bedtime"]').appendChild(z);
      setTimeout(function () { z.remove(); }, 2400);
    }, 900);
    wakeBtn.dataset.timer = "";
    wakeBtn._timer = zzzTimer;
  });
  wakeBtn.addEventListener("click", function () {
    clearInterval(wakeBtn._timer);
    nightVeil.classList.remove("on");
    goodnightText.classList.remove("on");
    state.inBed = false;
    renderBed();
    persist();
    SFX.bell();
    VOICE.say("Dobré ráno! Vstáváme a hezky se protáhneme.");
  });

  function renderAll() {
    renderOutside();
    renderBeach();
    renderBath();
    renderMeal();
    renderBed();
  }

  // Domovská obrazovka podle skutečné hodiny — stejná hranice 6-18/18-6 jako
  // "Auto" motiv jinde. Stačí zjistit jednou při startu, appka se nenechává
  // otevřenou přes půlnoc.
  var homeHour = new Date().getHours();
  document.querySelector(".home-sky").classList.toggle("night-time", homeHour >= 18 || homeHour < 6);

  applyBowColor();
  applyHairColor();
  applyGlassesColor();
  renderBadges();
  goScene(state.scene || "home");
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
