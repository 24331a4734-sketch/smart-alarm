/* ===================================================
   Smart Sleep Alarm — Script
   Pure JavaScript: clock, alarms, snooze, sounds, timer
=================================================== */

// ---------- State ----------
let is24Hour = true;                 // clock display format
let alarms = [];                     // {id, hour, minute, enabled, label}
let activeAlarmId = null;            // currently ringing alarm id
let currentSound = null;             // key of currently playing ambient sound
let sleepTimerInterval = null;       // interval id for sleep timer countdown
let sleepTimerEnd = null;            // timestamp when sleep timer ends

// ---------- Element references ----------
const clockEl = document.getElementById('clock');
const dateEl = document.getElementById('dateDisplay');
const formatToggleBtn = document.getElementById('formatToggle');

const hourSelect = document.getElementById('hourSelect');
const minuteSelect = document.getElementById('minuteSelect');
const ampmSelect = document.getElementById('ampmSelect');
const setAlarmBtn = document.getElementById('setAlarmBtn');
const alarmStatus = document.getElementById('alarmStatus');
const alarmList = document.getElementById('alarmList');

const soundGrid = document.getElementById('soundGrid');
const nowPlaying = document.getElementById('nowPlaying');
const stopSoundBtn = document.getElementById('stopSoundBtn');

const timerBtns = document.querySelectorAll('.timer-btn');
const timerDisplay = document.getElementById('timerDisplay');

const alarmOverlay = document.getElementById('alarmOverlay');
const alarmTimeText = document.getElementById('alarmTimeText');
const snoozeBtn = document.getElementById('snoozeBtn');
const stopAlarmBtn = document.getElementById('stopAlarmBtn');

const toast = document.getElementById('toast');
const appEl = document.querySelector('.app');

// Audio elements
const alarmAudio = document.getElementById('alarmAudio');
const sounds = {
  rain: document.getElementById('rainAudio'),
  ocean: document.getElementById('oceanAudio'),
  piano: document.getElementById('pianoAudio')
};

// ===================================================
// Initialization
// ===================================================
function init() {
  populateTimeSelectors();
  loadAlarmsFromStorage();
  loadFormatPreference();
  renderAlarmList();
  updateClock();
  setInterval(updateClock, 1000); // real-time clock, updates every second

  // Request notification permission for alarm alerts
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Fill hour & minute dropdowns based on current format
function populateTimeSelectors() {
  const maxHour = is24Hour ? 23 : 12;
  const minHour = is24Hour ? 0 : 1;

  hourSelect.innerHTML = '';
  for (let h = minHour; h <= maxHour; h++) {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = String(h).padStart(2, '0');
    hourSelect.appendChild(opt);
  }

  minuteSelect.innerHTML = '';
  for (let m = 0; m < 60; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = String(m).padStart(2, '0');
    minuteSelect.appendChild(opt);
  }

  // Show/hide AM-PM selector depending on format
  ampmSelect.style.display = is24Hour ? 'none' : 'inline-block';
}

// ===================================================
// Clock
// ===================================================
function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  let suffix = '';

  if (!is24Hour) {
    suffix = hours >= 12 ? ' PM' : ' AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
  }

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  clockEl.textContent = `${hh}:${mm}:${ss}${suffix}`;

  // Date display
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  dateEl.textContent = now.toLocaleDateString(undefined, dateOptions);

  // Check alarms every tick (only fires when seconds === 0)
  checkAlarms(now);
}

// Toggle between 12h and 24h display
formatToggleBtn.addEventListener('click', () => {
  is24Hour = !is24Hour;
  formatToggleBtn.textContent = is24Hour ? 'Switch to 12-hour' : 'Switch to 24-hour';
  localStorage.setItem('sleepAlarm_format', is24Hour ? '24' : '12');
  populateTimeSelectors();
  updateClock();
});

function loadFormatPreference() {
  const saved = localStorage.getItem('sleepAlarm_format');
  is24Hour = saved !== '12'; // default to 24-hour
  formatToggleBtn.textContent = is24Hour ? 'Switch to 12-hour' : 'Switch to 24-hour';
  populateTimeSelectors();
}

// ===================================================
// Alarms
// ===================================================

// Add a new alarm from the selectors
setAlarmBtn.addEventListener('click', () => {
  let hour = parseInt(hourSelect.value, 10);
  const minute = parseInt(minuteSelect.value, 10);

  // Convert 12-hour input to 24-hour storage format
  if (!is24Hour) {
    const period = ampmSelect.value;
    if (period === 'AM') {
      if (hour === 12) hour = 0;
    } else {
      if (hour !== 12) hour += 12;
    }
  }

  const alarm = {
    id: Date.now(),
    hour,
    minute,
    enabled: true
  };

  alarms.push(alarm);
  saveAlarmsToStorage();
  renderAlarmList();
  showToast('Alarm set for ' + formatTime(hour, minute));
});

// Render the list of saved alarms
function renderAlarmList() {
  alarmList.innerHTML = '';

  if (alarms.length === 0) {
    alarmStatus.textContent = 'No alarm set';
    alarmStatus.classList.remove('active');
    return;
  }

  const anyEnabled = alarms.some(a => a.enabled);
  alarmStatus.textContent = anyEnabled ? 'Alarm is active' : 'All alarms disabled';
  alarmStatus.classList.toggle('active', anyEnabled);

  alarms.forEach(alarm => {
    const li = document.createElement('li');

    const timeSpan = document.createElement('span');
    timeSpan.className = 'alarm-time';
    timeSpan.textContent = formatTime(alarm.hour, alarm.minute);
    if (!alarm.enabled) timeSpan.style.opacity = '0.4';

    const actions = document.createElement('div');
    actions.className = 'alarm-actions';

    // Enable/disable toggle switch
    const label = document.createElement('label');
    label.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = alarm.enabled;
    input.addEventListener('change', () => {
      alarm.enabled = input.checked;
      saveAlarmsToStorage();
      renderAlarmList();
    });
    const slider = document.createElement('span');
    slider.className = 'slider-toggle';
    label.appendChild(input);
    label.appendChild(slider);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn delete';
    delBtn.innerHTML = '🗑️';
    delBtn.title = 'Delete alarm';
    delBtn.addEventListener('click', () => {
      alarms = alarms.filter(a => a.id !== alarm.id);
      saveAlarmsToStorage();
      renderAlarmList();
    });

    actions.appendChild(label);
    actions.appendChild(delBtn);

    li.appendChild(timeSpan);
    li.appendChild(actions);
    alarmList.appendChild(li);
  });
}

// Format hour/minute (24h storage) into a display string based on current preference
function formatTime(hour, minute) {
  const mm = String(minute).padStart(2, '0');
  if (is24Hour) {
    return `${String(hour).padStart(2, '0')}:${mm}`;
  } else {
    let h = hour % 12;
    if (h === 0) h = 12;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    return `${String(h).padStart(2, '0')}:${mm} ${suffix}`;
  }
}

// Check if any enabled alarm matches the current time (runs every second, fires on second 0)
function checkAlarms(now) {
  if (activeAlarmId !== null) return; // an alarm is already ringing

  if (now.getSeconds() !== 0) return; // only trigger exactly at the minute mark

  alarms.forEach(alarm => {
    if (alarm.enabled && alarm.hour === now.getHours() && alarm.minute === now.getMinutes()) {
      triggerAlarm(alarm);
    }
  });
}

// Trigger the alarm ringing UI + sound
function triggerAlarm(alarm) {
  activeAlarmId = alarm.id;
  alarmTimeText.textContent = `It's ${formatTime(alarm.hour, alarm.minute)}`;
  alarmOverlay.classList.add('show');
  appEl.classList.add('vibrate'); // visual vibration simulation

  alarmAudio.currentTime = 0;
  alarmAudio.play().catch(() => {
    // Autoplay might be blocked until user interacts; that's expected.
  });

  showNotification('Smart Sleep Alarm', `Time to wake up! It's ${formatTime(alarm.hour, alarm.minute)}`);
}

// Stop the ringing alarm completely
stopAlarmBtn.addEventListener('click', () => {
  stopRingingAlarm();
});

function stopRingingAlarm() {
  alarmAudio.pause();
  alarmAudio.currentTime = 0;
  alarmOverlay.classList.remove('show');
  appEl.classList.remove('vibrate');
  activeAlarmId = null;
}

// Snooze: stop current ring, re-trigger 5 minutes later
snoozeBtn.addEventListener('click', () => {
  const snoozedId = activeAlarmId;
  stopRingingAlarm();
  showToast('Snoozed for 5 minutes');

  setTimeout(() => {
    // Build a temporary "alarm" object representing the snooze
    const now = new Date();
    const alarm = { id: snoozedId, hour: now.getHours(), minute: now.getMinutes(), enabled: true };
    triggerAlarm(alarm);
  }, 5 * 60 * 1000); // 5 minutes
});

// ===================================================
// LocalStorage persistence
// ===================================================
function saveAlarmsToStorage() {
  localStorage.setItem('sleepAlarm_alarms', JSON.stringify(alarms));
}

function loadAlarmsFromStorage() {
  const saved = localStorage.getItem('sleepAlarm_alarms');
  if (saved) {
    try {
      alarms = JSON.parse(saved);
    } catch (e) {
      alarms = [];
    }
  }
}

// ===================================================
// Sleep Sounds
// ===================================================
soundGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.sound-btn');
  if (!btn) return;

  const key = btn.dataset.sound;

  if (currentSound === key) {
    // Clicking the playing sound again stops it
    stopAllSounds();
    return;
  }

  stopAllSounds();
  currentSound = key;
  sounds[key].currentTime = 0;
  sounds[key].play().catch(() => {});
  btn.classList.add('playing');
  nowPlaying.textContent = `Playing: ${btn.querySelector('span:last-child').textContent}`;
});

stopSoundBtn.addEventListener('click', stopAllSounds);

function stopAllSounds() {
  Object.values(sounds).forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
  document.querySelectorAll('.sound-btn').forEach(b => b.classList.remove('playing'));
  currentSound = null;
  nowPlaying.textContent = 'Nothing playing';
}

// ===================================================
// Sleep Timer (auto-stop sounds after set duration)
// ===================================================
timerBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    timerBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const mins = parseInt(btn.dataset.mins, 10);

    // Clear any existing countdown
    if (sleepTimerInterval) {
      clearInterval(sleepTimerInterval);
      sleepTimerInterval = null;
    }

    if (mins === 0) {
      sleepTimerEnd = null;
      timerDisplay.textContent = 'Timer: off';
      return;
    }

    sleepTimerEnd = Date.now() + mins * 60 * 1000;
    updateTimerDisplay();

    sleepTimerInterval = setInterval(() => {
      const remaining = sleepTimerEnd - Date.now();
      if (remaining <= 0) {
        clearInterval(sleepTimerInterval);
        sleepTimerInterval = null;
        stopAllSounds();
        timerDisplay.textContent = 'Timer: finished — music stopped';
        timerBtns.forEach(b => b.classList.remove('active'));
        showToast('Sleep timer finished. Music stopped.');
      } else {
        updateTimerDisplay();
      }
    }, 1000);
  });
});

function updateTimerDisplay() {
  const remaining = Math.max(0, sleepTimerEnd - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  timerDisplay.textContent = `Timer: ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} remaining`;
}

// ===================================================
// Toast & Notifications
// ===================================================
let toastTimeout = null;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  } else {
    showToast(body);
  }
}

// ---------- Start the app ----------
init();
