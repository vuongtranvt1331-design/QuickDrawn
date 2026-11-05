class WesternSoundEngine {
      constructor() {
        this.ctx = null;
        this.muted = false;
        // Local Wilhelm scream (source and attribution in assets/audio/README.txt). Kept quiet for classroom use.
        this.screamAudio = new Audio("./assets/audio/wilhelmscream.mp3");
        this.screamAudio.preload = "auto";
        this.screamAudio.volume = 0.18;
      }

      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
      }

      toggleMute() {
        this.muted = !this.muted;
        return this.muted;
      }

      playClick() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.055);
      }

      playTick() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        try {
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          // Soft neutral wooden tick: sine drop 600Hz -> 200Hz in 18ms
          osc.type = "sine";
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.018);

          // Subtle, quiet gain (0.045 ~ 10-12% normalized volume)
          gain.gain.setValueAtTime(0.045, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.02);
        } catch (_) {}
      }

      playGunshot(isPlayerWin = true) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // White noise burst for revolver bang
        const bufferSize = this.ctx.sampleRate * 0.28;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.06));
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1100, now);
        filter.Q.setValueAtTime(0.8, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.26);

        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        whiteNoise.start(now);

        // Ricochet / Metallic twang follow-up
        const osc = this.ctx.createOscillator();
        const ricGain = this.ctx.createGain();
        osc.type = "sawtooth";
        if (isPlayerWin) {
          osc.frequency.setValueAtTime(1400, now + 0.06);
          osc.frequency.exponentialRampToValueAtTime(420, now + 0.28);
        } else {
          osc.frequency.setValueAtTime(340, now + 0.05);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);
        }
        ricGain.gain.setValueAtTime(0.16, now + 0.05);
        ricGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(ricGain);
        ricGain.connect(this.ctx.destination);
        osc.start(now + 0.05);
        osc.stop(now + 0.36);
      }

      playScream() {
        if (this.muted) return;
        this.init();
        try {
          this.screamAudio.pause();
          this.screamAudio.currentTime = 0;
          this.screamAudio.volume = 0.18;
          const playback = this.screamAudio.play();
          if (playback && typeof playback.catch === "function") {
            playback.catch(() => this.playGunshot(false));
          }
        } catch (_) {
          this.playGunshot(false);
        }
      }

      playVictoryFanfare() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const now = this.ctx.currentTime + idx * 0.11;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.24);
        });
      }

      playFlowStateSound() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        // Energetic 8-bit power-up arpeggio: E5 -> G#5 -> B5 -> E6
        const notes = [659.25, 830.61, 987.77, 1318.51];
        notes.forEach((freq, idx) => {
          const now = this.ctx.currentTime + idx * 0.065;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.2);
        });
      }
    }

    /*************************************************************************
     * OXFORD & DICTIONARY PRONUNCIATION PROVIDER & CACHE ENGINE
     *************************************************************************/
    const OXFORD_CONFIG = {
      // Official Oxford Dictionaries API credentials (configurable)
      appId: "",
      appKey: "",
      baseUrl: "https://od-api.oxforddictionaries.com/api/v2",
      language: "en-gb"
    };

    class WordPronunciationEngine {
      constructor() {
        this.cache = new Map(); // LRU Map: word -> { audioUrl, source }
        this.maxCacheSize = 100;
        this.activeAudio = null;
        this.isSpeaking = false;
        this.preloadingSet = new Set();
        this.preferredVoice = null;
        this.initVoices();
      }

      init() {
        this.initVoices();
      }

      initVoices() {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const updateVoices = () => {
            try {
              const voices = window.speechSynthesis.getVoices() || [];
              this.preferredVoice = voices.find(v => v.lang === "en-GB" || v.lang === "en_GB") ||
                                    voices.find(v => v.lang && v.lang.startsWith("en")) || null;
            } catch (_) {}
          };
          updateVoices();
          if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = updateVoices;
          }
        }
      }

      stop() {
        if (this.activeAudio) {
          try {
            this.activeAudio.pause();
            this.activeAudio.currentTime = 0;
          } catch (_) {}
          this.activeAudio = null;
        }
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          try {
            window.speechSynthesis.cancel();
          } catch (_) {}
        }
        this.isSpeaking = false;
        dom.btnWordSpeaker?.classList.remove("speaking");
      }

      async resolveAudioForWord(word) {
        const clean = (word || "").trim().toLowerCase();
        if (!clean) return null;

        // 1. In-memory LRU cache hit
        if (this.cache.has(clean)) {
          const item = this.cache.get(clean);
          this.cache.delete(clean);
          this.cache.set(clean, item);
          return item;
        }

        // 2. Genuine Oxford API Adapter (if credentials configured)
        if (OXFORD_CONFIG.appId && OXFORD_CONFIG.appKey) {
          try {
            const oxUrl = `${OXFORD_CONFIG.baseUrl}/entries/${OXFORD_CONFIG.language}/${encodeURIComponent(clean)}`;
            const res = await fetch(oxUrl, {
              headers: {
                "app_id": OXFORD_CONFIG.appId,
                "app_key": OXFORD_CONFIG.appKey
              }
            });
            if (res.ok) {
              const data = await res.json();
              let oxAudioUrl = null;
              const lexicalEntries = data.results?.[0]?.lexicalEntries || [];
              for (const le of lexicalEntries) {
                const entries = le.entries || [];
                for (const e of entries) {
                  for (const p of e.pronunciations || []) {
                    if (p.audioFile) { oxAudioUrl = p.audioFile; break; }
                  }
                  if (oxAudioUrl) break;
                }
                if (oxAudioUrl) break;
              }
              if (oxAudioUrl) {
                const result = { audioUrl: oxAudioUrl, source: "oxford" };
                this.setCache(clean, result);
                return result;
              }
            }
          } catch (e) {
            console.warn("Oxford API lookup failed, falling back to dictionary:", e);
          }
        }

        // 3. Authorized Open Dictionary API (Free Dictionary API, matching LS app)
        try {
          const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`);
          if (res.ok) {
            const data = await res.json();
            let dictAudioUrl = null;
            if (Array.isArray(data) && data[0]?.phonetics) {
              for (const item of data[0].phonetics) {
                if (item.audio && item.audio.length > 0) {
                  if (item.audio.includes("-uk")) {
                    dictAudioUrl = item.audio;
                    break;
                  }
                  if (!dictAudioUrl) dictAudioUrl = item.audio;
                }
              }
            }
            if (dictAudioUrl) {
              const result = { audioUrl: dictAudioUrl, source: "dictionary" };
              this.setCache(clean, result);
              return result;
            }
          }
        } catch (_) {}

        // 4. Fallback Provider: Browser Speech Synthesis
        const fallbackResult = { audioUrl: null, source: "speechSynthesis" };
        this.setCache(clean, fallbackResult);
        return fallbackResult;
      }

      setCache(key, val) {
        if (this.cache.size >= this.maxCacheSize) {
          const oldestKey = this.cache.keys().next().value;
          this.cache.delete(oldestKey);
        }
        this.cache.set(key, val);
      }

      async preloadUpcoming(words) {
        if (!Array.isArray(words)) return;
        const upcoming = words
          .map(w => (w || "").trim().toLowerCase())
          .filter(w => w && !this.cache.has(w) && !this.preloadingSet.has(w))
          .slice(0, 2);

        for (const word of upcoming) {
          this.preloadingSet.add(word);
          this.resolveAudioForWord(word).then(res => {
            if (res && res.audioUrl) {
              const audio = new Audio();
              audio.preload = "auto";
              audio.src = res.audioUrl;
            }
          }).catch(() => {}).finally(() => {
            this.preloadingSet.delete(word);
          });
        }
      }

      async pronounce(word) {
        if (sound.muted) return;
        const clean = (word || "").trim().toLowerCase();
        if (!clean) return;

        this.stop();
        this.isSpeaking = true;
        dom.btnWordSpeaker?.classList.add("speaking");

        try {
          const resolved = await this.resolveAudioForWord(clean);
          if (sound.muted) {
            this.isSpeaking = false;
            dom.btnWordSpeaker?.classList.remove("speaking");
            return;
          }

          if (resolved && resolved.audioUrl) {
            const audio = new Audio(resolved.audioUrl);
            audio.preload = "auto";
            audio.volume = 0.85;
            this.activeAudio = audio;

            audio.onended = () => {
              if (this.activeAudio === audio) {
                this.isSpeaking = false;
                this.activeAudio = null;
                dom.btnWordSpeaker?.classList.remove("speaking");
              }
            };
            audio.onerror = () => {
              if (this.activeAudio === audio) {
                this.activeAudio = null;
                this.speakSynthesisFallback(clean);
              }
            };

            const playPromise = audio.play();
            if (playPromise && typeof playPromise.catch === "function") {
              playPromise.catch(() => {
                this.speakSynthesisFallback(clean);
              });
            }
            return;
          }

          this.speakSynthesisFallback(clean);
        } catch (_) {
          this.speakSynthesisFallback(clean);
        }
      }

      speakSynthesisFallback(text) {
        if (sound.muted) {
          this.isSpeaking = false;
          dom.btnWordSpeaker?.classList.remove("speaking");
          return;
        }
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = "en-GB";
            u.rate = 0.95;
            if (this.preferredVoice) u.voice = this.preferredVoice;
            u.onend = () => {
              this.isSpeaking = false;
              dom.btnWordSpeaker?.classList.remove("speaking");
            };
            u.onerror = () => {
              this.isSpeaking = false;
              dom.btnWordSpeaker?.classList.remove("speaking");
            };
            window.speechSynthesis.speak(u);
          } catch (_) {
            this.isSpeaking = false;
            dom.btnWordSpeaker?.classList.remove("speaking");
          }
        } else {
          this.isSpeaking = false;
          dom.btnWordSpeaker?.classList.remove("speaking");
        }
      }
    }

    const sound = new WesternSoundEngine();
    const pronunciationEngine = new WordPronunciationEngine();
    window.sound = sound;
    window.pronunciationEngine = pronunciationEngine;
    window.OXFORD_CONFIG = OXFORD_CONFIG;
