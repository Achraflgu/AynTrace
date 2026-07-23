const API_BASE = window.location.origin;
const pathParts = window.location.pathname.split('/');
const token = pathParts[pathParts.length - 1] || new URLSearchParams(window.location.search).get('token');

let watchId = null;
let isTracking = false;
let updateCount = 0;
let lastKnownData = null;
let wakeLock = null;

let heartbeatInterval = null;
let heartbeatWorker = null;
const HEARTBEAT_MS = 8000;
const TRACKING_ACTIVE_KEY = `ayntrace-tracking-active:${token || 'missing'}`;

document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');

    if(startBtn) startBtn.addEventListener('click', startTracking);
    if(stopBtn) stopBtn.addEventListener('click', stopTracking);
    
    const sosBtn = document.getElementById('sos-btn');
    if(sosBtn) sosBtn.addEventListener('click', sendSOSSignal);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === 'visible' && isTracking) {
        resumeTrackingLoop();
      } else if (isTracking) {
        sendLastKnownHeartbeat();
      }
    });

    window.addEventListener('focus', () => {
      if (isTracking) resumeTrackingLoop();
    });

    window.addEventListener('pageshow', () => {
      if (localStorage.getItem(TRACKING_ACTIVE_KEY) === 'true') {
        if (isTracking) resumeTrackingLoop();
        else startTracking({ resumed: true });
      }
    });

    window.addEventListener('online', () => {
      if (isTracking) resumeTrackingLoop();
    });

    document.addEventListener('resume', () => {
      if (isTracking) resumeTrackingLoop();
    });

    window.addEventListener('beforeunload', () => {
      if (isTracking) notifyTrackerStopped(true);
    });

    getDeviceInfo();

    if (localStorage.getItem(TRACKING_ACTIVE_KEY) === 'true') {
      startTracking({ resumed: true });
    }
});

function getElements() {
    return {
        loadingEl: document.getElementById('loading'),
        errorSection: document.getElementById('error-section'),
        errorMessage: document.getElementById('error-message'),
        deviceSection: document.getElementById('device-section'),
        startBtn: document.getElementById('start-btn'),
        stopBtn: document.getElementById('stop-btn'),
        statusBadge: document.getElementById('status-badge'),
        statusText: document.getElementById('status-text'),
        wakelockMsg: document.getElementById('wakelock-msg')
    };
}

function showError(message) {
    const els = getElements();
    els.loadingEl.classList.add('hidden');
    els.deviceSection.classList.add('hidden');
    els.errorSection.classList.remove('hidden');
    els.errorMessage.textContent = message;
}

function showDevice(info) {
    const els = getElements();
    els.loadingEl.classList.add('hidden');
    els.errorSection.classList.add('hidden');
    els.deviceSection.classList.remove('hidden');
    document.getElementById('device-name').textContent = info.deviceName;
    document.getElementById('enterprise-name').textContent = info.enterpriseName;
}

function setStatus(status, className) {
    const els = getElements();
    els.statusBadge.className = 'status-badge ' + className;
    els.statusText.textContent = status;
}

async function getDeviceInfo() {
  if (!token) {
    showError('Token de suivi invalide ou manquant.');
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/api/track/${token}/info`);
    if (!response.ok) throw new Error();
    const info = await response.json();
    showDevice(info);
  } catch (error) {
    showError('Lien expiré ou introuvable.');
  }
}

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      document.getElementById('wakelock-msg').classList.remove('hidden');
      wakeLock.addEventListener('release', () => { });
    } catch (err) {
      console.log(`Wake Lock error: ${err.name}, ${err.message}`);
    }
  }
}

function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => { wakeLock = null; });
    document.getElementById('wakelock-msg').classList.add('hidden');
  }
}

function forcePositionUpdate() {
    if (!isTracking) return;
    navigator.geolocation.getCurrentPosition(
        (pos) => sendPosition(pos, true),
        (err) => {
            if (err.code === err.PERMISSION_DENIED) {
                setStatus('REFUSÉ', 'status-error');
                stopTracking();
            } else if (err.code === err.TIMEOUT) {
                console.debug('GPS Timeout - waiting for next cycle');
            } else {
                console.debug('GPS Error: ', err.message);
            }
        },
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
}

async function sendPosition(position, isFallback = false) {
  const data = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    speed: position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0,
    heading: position.coords.heading || 0,
    altitude: position.coords.altitude,
    accuracy: position.coords.accuracy
  };

  if (navigator.getBattery) {
    try {
      const battery = await navigator.getBattery();
      data.battery = Math.round(battery.level * 100);
      document.getElementById('battery').textContent = data.battery;
    } catch (e) { }
  }

  lastKnownData = data;

  document.getElementById('lat').textContent = data.lat.toFixed(6);
  document.getElementById('lng').textContent = data.lng.toFixed(6);
  document.getElementById('speed').textContent = data.speed;

  try {
    const response = await fetch(`${API_BASE}/api/track/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      updateCount++;
      document.getElementById('update-log').textContent =
        `Dernier signal: ${new Date().toLocaleTimeString()} (#${updateCount}${isFallback ? ' f' : ''})`;
      setStatus('EN DIRECT', 'status-active');
    } else {
      // Non-2xx response (502 etc.) — try GET fallback as well
      console.warn('POST returned non-ok status', response.status, response.statusText);
      try {
        const params = new URLSearchParams({
          lat: data.lat,
          lng: data.lng,
          speed: data.speed,
          heading: data.heading,
          battery: data.battery,
          altitude: data.altitude,
          accuracy: data.accuracy
        });
        const fallback = await fetch(`${API_BASE}/api/track/${token}?${params.toString()}`, { method: 'GET' });
        if (fallback.ok) {
          updateCount++;
          document.getElementById('update-log').textContent =
            `Dernier signal: ${new Date().toLocaleTimeString()} (#${updateCount}${isFallback ? ' f' : ''})`;
          setStatus('EN DIRECT', 'status-active');
          return;
        } else {
          console.warn('Fallback GET returned non-ok', fallback.status, fallback.statusText);
        }
      } catch (e) {
        console.error('Fallback GET failed', e);
      }
    }
  } catch (error) {
    console.error('API Error', error);
    // Fallback: try a simple GET request with query params (helps through some tunnels/proxies)
    try {
      const params = new URLSearchParams({
        lat: data.lat,
        lng: data.lng,
        speed: data.speed,
        heading: data.heading,
        battery: data.battery,
        altitude: data.altitude,
        accuracy: data.accuracy
      });
      const fallback = await fetch(`${API_BASE}/api/track/${token}?${params.toString()}`, { method: 'GET' });
      if (fallback.ok) {
        updateCount++;
        document.getElementById('update-log').textContent =
          `Dernier signal: ${new Date().toLocaleTimeString()} (#${updateCount}${isFallback ? ' f' : ''})`;
        setStatus('EN DIRECT', 'status-active');
        return;
      }
    } catch (e) {
      console.error('Fallback GET failed', e);
    }
  }
}

async function sendStartSignal() {
  try {
    const response = await fetch(`${API_BASE}/api/track/${token}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      setStatus('EN LIGNE', 'status-active');
      document.getElementById('update-log').textContent =
        `Tracker actif: ${new Date().toLocaleTimeString()}`;
    }
  } catch (error) {
    console.debug('Start signal failed:', error);
  }
}

function notifyTrackerStopped(useBeacon = false) {
  const url = `${API_BASE}/api/track/${token}/stop`;

  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob(['{}'], { type: 'application/json' }));
    return;
  }

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    keepalive: true
  }).catch(error => console.debug('Stop signal failed:', error));
}

async function sendLastKnownHeartbeat() {
  if (!isTracking) return;

  if (!lastKnownData) {
    await sendStartSignal();
    return;
  }

  await sendPosition({
    coords: {
      latitude: lastKnownData.lat,
      longitude: lastKnownData.lng,
      speed: (Number(lastKnownData.speed) || 0) / 3.6,
      heading: lastKnownData.heading || 0,
      altitude: lastKnownData.altitude || null,
      accuracy: lastKnownData.accuracy || null
    }
  }, true);
}

function heartbeatTick() {
  if (!isTracking) return;

  forcePositionUpdate();
  setTimeout(() => {
    if (isTracking) sendLastKnownHeartbeat();
  }, 3500);
}

function startHeartbeatLoop() {
  stopHeartbeatLoop();

  if (window.Worker) {
    try {
      const workerCode = `
        let timer = null;
        self.onmessage = (event) => {
          const data = event.data || {};
          if (data.type === 'start') {
            clearInterval(timer);
            timer = setInterval(() => self.postMessage({ type: 'tick' }), data.ms || 8000);
            self.postMessage({ type: 'tick' });
          }
          if (data.type === 'stop') {
            clearInterval(timer);
            timer = null;
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      heartbeatWorker = new Worker(URL.createObjectURL(blob));
      heartbeatWorker.onmessage = (event) => {
        if (event.data?.type === 'tick') heartbeatTick();
      };
      heartbeatWorker.postMessage({ type: 'start', ms: HEARTBEAT_MS });
    } catch (error) {
      console.debug('Heartbeat worker unavailable:', error);
      heartbeatWorker = null;
    }
  }

  if (!heartbeatWorker) {
    heartbeatInterval = setInterval(heartbeatTick, HEARTBEAT_MS);
  }
  heartbeatTick();
}

function stopHeartbeatLoop() {
  if (heartbeatWorker) {
    heartbeatWorker.postMessage({ type: 'stop' });
    heartbeatWorker.terminate();
    heartbeatWorker = null;
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function resumeTrackingLoop() {
  if (!isTracking) return;
  requestWakeLock();
  sendStartSignal();
  _initWatch();
  startHeartbeatLoop();
}

function _initWatch() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(
        (position) => { sendPosition(position); },
        (error) => {
           console.warn("Watch Error", error);
           if (error.code === error.PERMISSION_DENIED) {
               setStatus('REFUSÉ', 'status-error');
               stopTracking();
           }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

function startTracking(options = {}) {
  if (isTracking) return;
  if (!navigator.geolocation) {
    showError('GPS non supporté.'); return;
  }
  setStatus(options.resumed ? 'REPRISE...' : 'ACQUISITION...', 'status-waiting');
  isTracking = true;
  localStorage.setItem(TRACKING_ACTIVE_KEY, 'true');
  document.getElementById('start-btn').classList.add('hidden');
  document.getElementById('stop-btn').classList.remove('hidden');

  requestWakeLock();
  sendStartSignal();
  forcePositionUpdate();
  _initWatch();
  startHeartbeatLoop();
}

function stopTracking() {
  isTracking = false;
  localStorage.removeItem(TRACKING_ACTIVE_KEY);
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  stopHeartbeatLoop();
  notifyTrackerStopped();
  
  releaseWakeLock();
  setStatus('ARRÊTÉ', 'status-waiting');
  document.getElementById('start-btn').classList.remove('hidden');
  document.getElementById('stop-btn').classList.add('hidden');
}

async function sendSOSSignal() {
  const sosBtn = document.getElementById('sos-btn');
  if (!sosBtn || sosBtn.disabled) return;

  showCustomModal({
    icon: '🚨',
    title: "Urgence SOS",
    desc: "Voulez-vous vraiment envoyer un signal d'URGENCE SOS ?",
    showCancel: true,
    confirmText: "Confirmer",
    confirmClass: "modal-btn-primary",
    onConfirm: async () => {
      try {
        sosBtn.disabled = true;
        sosBtn.style.opacity = '0.7';
        sosBtn.textContent = "ENVOI DE L'SOS EN COURS...";

        const response = await fetch(`${API_BASE}/api/track/${token}/sos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          showCustomModal({
            icon: '✅',
            title: "Signal Envoyé",
            desc: "Signal SOS envoyé avec succès ! L'équipe support et votre entreprise ont été notifiées immédiatement.",
            showCancel: false,
            confirmText: "OK",
            confirmClass: "modal-btn-success",
            onConfirm: () => {
              sosBtn.disabled = false;
              sosBtn.style.opacity = '1';
              sosBtn.style.background = '';
              sosBtn.style.boxShadow = '';
              sosBtn.innerHTML = '<div class="pulse"></div> SIGNALER URGENCE SOS';
            }
          });

          sosBtn.textContent = "SOS ENVOYÉ !";
          sosBtn.style.background = "#22c55e";
          sosBtn.style.boxShadow = "0 4px 20px rgba(34, 197, 94, 0.4)";
        } else {
          throw new Error();
        }
      } catch (error) {
        showCustomModal({
          icon: '❌',
          title: "Échec",
          desc: "Échec de l'envoi du signal SOS. Veuillez vérifier votre connexion internet.",
          showCancel: false,
          confirmText: "OK",
          confirmClass: "modal-btn-primary",
          onConfirm: () => {
            sosBtn.disabled = false;
            sosBtn.style.opacity = '1';
            sosBtn.innerHTML = '<div class="pulse"></div> SIGNALER URGENCE SOS';
          }
        });
      }
    }
  });
}

function showCustomModal({ icon, title, desc, showCancel, confirmText, confirmClass, onConfirm }) {
  const modal = document.getElementById('custom-modal');
  const iconEl = document.getElementById('modal-icon');
  const titleEl = document.getElementById('modal-title');
  const descEl = document.getElementById('modal-desc');
  const actionsEl = document.getElementById('modal-actions');

  iconEl.textContent = icon;
  titleEl.textContent = title;
  descEl.textContent = desc;

  actionsEl.innerHTML = '';

  if (showCancel) {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-btn modal-btn-secondary';
    cancelBtn.textContent = 'Annuler';
    cancelBtn.onclick = () => {
      modal.classList.add('hidden');
    };
    actionsEl.appendChild(cancelBtn);
  }

  const confirmBtn = document.createElement('button');
  confirmBtn.className = `modal-btn ${confirmClass || 'modal-btn-primary'}`;
  confirmBtn.textContent = confirmText || 'Confirmer';
  confirmBtn.onclick = () => {
    modal.classList.add('hidden');
    if (onConfirm) onConfirm();
  };
  actionsEl.appendChild(confirmBtn);

  modal.classList.remove('hidden');
}
