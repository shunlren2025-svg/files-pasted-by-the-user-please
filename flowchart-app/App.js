import React, { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const TASKS_KEY = 'flowchart.tasks';
const HELPER_KEY = 'flowchart.helperUrl';
const DEFAULT_HELPER_URL = Platform.OS === 'web' ? 'http://127.0.0.1:8787' : 'http://192.168.1.100:8787';
const MESSAGE_APPS = [
  { id: 'teamsnap', label: 'TeamSnap', icon: 'TS' },
  { id: 'instagram', label: 'Instagram', icon: 'IG' },
  { id: 'messages', label: 'Messages', icon: 'SMS' },
  { id: 'gmail', label: 'Gmail', icon: 'G' },
  { id: 'more', label: 'More apps', icon: '+' },
];

const colors = {
  ink: '#1C2340',
  muted: '#6F7898',
  soft: '#F7F8FC',
  card: '#FFFFFF',
  purple: '#6D5DFB',
  purpleSoft: '#EEEAFE',
  green: '#2BB673',
  orange: '#F39A3D',
  line: '#E8EAF2',
};

const HOLIDAYS = {
  US: [
    ['01-01', "New Year's Day"], ['01-19', 'Martin Luther King Jr. Day'], ['02-16', "Presidents' Day"],
    ['05-25', 'Memorial Day'], ['06-19', 'Juneteenth'], ['07-04', 'Independence Day'], ['09-07', 'Labor Day'],
    ['10-12', 'Columbus Day'], ['11-11', 'Veterans Day'], ['11-26', 'Thanksgiving Day'], ['12-25', 'Christmas Day'],
  ],
  CA: [['01-01', "New Year's Day"], ['07-01', 'Canada Day'], ['09-07', 'Labour Day'], ['10-12', 'Thanksgiving Day'], ['12-25', 'Christmas Day']],
  UK: [['01-01', "New Year's Day"], ['04-03', 'Good Friday'], ['05-04', 'Early May Bank Holiday'], ['08-31', 'Summer Bank Holiday'], ['12-25', 'Christmas Day'], ['12-26', 'Boxing Day']],
};

function formatDue(value) {
  if (!value) return 'No time set';
  return value;
}

function getTimeLabel(value) {
  const match = String(value || '').match(/\d{1,2}:\d{2}\s?(?:AM|PM)/i);
  return match ? match[0] : 'Any time';
}

function getWeekDays(anchor) {
  const start = new Date(anchor);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getMonthCells(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function sameDay(first, second) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function nthWeekday(year, month, weekday, nth) {
  const date = new Date(year, month, 1);
  date.setDate(1 + ((weekday - date.getDay() + 7) % 7) + (nth - 1) * 7);
  return date;
}

function lastWeekday(year, month, weekday) {
  const date = new Date(year, month + 1, 0);
  date.setDate(date.getDate() - ((date.getDay() - weekday + 7) % 7));
  return date;
}

function getHolidayLabel(date, country) {
  const key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const fixed = (HOLIDAYS[country] || HOLIDAYS.US).find(([holidayKey]) => holidayKey === key);
  if (fixed) return fixed[1];
  if (country === 'US') {
    const year = date.getFullYear();
    const floating = [[nthWeekday(year, 0, 1, 3), 'Martin Luther King Jr. Day'], [nthWeekday(year, 1, 1, 3), "Presidents' Day"], [lastWeekday(year, 4, 1), 'Memorial Day'], [nthWeekday(year, 8, 1, 1), 'Labor Day'], [nthWeekday(year, 9, 1, 2), 'Columbus Day'], [nthWeekday(year, 10, 4, 4), 'Thanksgiving Day']];
    return floating.find(([holidayDate]) => sameDay(holidayDate, date))?.[1] || '';
  }
  return '';
}

function formatDateLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function App() {
  const [tab, setTab] = useState('planner');
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [newDue, setNewDue] = useState('Today · 4:00 PM');
  const [newDate, setNewDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newRepeat, setNewRepeat] = useState('Never');
  const [newLocation, setNewLocation] = useState('');
  const [helperUrl, setHelperUrl] = useState(DEFAULT_HELPER_URL);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [thinking, setThinking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const [calendarMode, setCalendarMode] = useState('week');
  const [holidayCountry, setHolidayCountry] = useState('US');
  const [countryName, setCountryName] = useState('United States');
  const [holidayEntries, setHolidayEntries] = useState([]);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [messageSource, setMessageSource] = useState('all');
  const [connectedApps, setConnectedApps] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(TASKS_KEY), AsyncStorage.getItem(HELPER_KEY)]).then(([savedTasks, savedUrl]) => {
      if (savedTasks) setTasks(JSON.parse(savedTasks));
      if (savedUrl) setHelperUrl(savedUrl);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [tasks, loaded]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const places = await Location.reverseGeocodeAsync(position.coords);
        const place = places[0];
        const iso = place?.isoCountryCode?.toUpperCase();
        if (active && iso) {
          setHolidayCountry(iso);
          setCountryName(place.country || iso);
        }
      } catch {
        // The calendar keeps the United States preset if location permission is declined.
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${selectedDate.getFullYear()}/${holidayCountry}`);
        if (!response.ok) return;
        const entries = await response.json();
        if (active) setHolidayEntries(entries);
      } catch {
        if (active) setHolidayEntries([]);
      }
    })();
    return () => { active = false; };
  }, [holidayCountry, selectedDate.getFullYear()]);

  useEffect(() => {
    if (newLocation.trim().length < 3) {
      setLocationSuggestions([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(newLocation.trim())}`);
        if (response.ok) setLocationSuggestions(await response.json());
      } catch {
        setLocationSuggestions([]);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [newLocation]);

  const completed = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);

  function addTask() {
    if (!newTask.trim()) {
      Alert.alert('Add an assignment', 'Write a short name first, like “Math worksheet”.');
      return;
    }
    setTasks((current) => [{ id: String(Date.now()), title: newTask.trim(), date: toDateKey(newDate), due: `${formatDateLabel(newDate)} · ${newDue.trim() || 'Any time'}`, repeat: newRepeat, location: newLocation.trim(), done: false }, ...current]);
    setNewTask('');
    setNewLocation('');
    setShowDatePicker(false);
  }

  function toggleTask(id) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  }

  async function startVoiceNote() {
    if (Platform.OS !== 'web') {
      Alert.alert('Voice notes on web', 'Open the web version on your laptop or PC to record and transcribe a voice note.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      Alert.alert('Voice recording unavailable', 'This browser does not support microphone recording. Try the latest Chrome or Edge.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = SpeechRecognition ? new SpeechRecognition() : null;
      if (recognition) {
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
          const words = Array.from(event.results).slice(event.resultIndex).map((result) => result[0].transcript).join(' ');
          setQuestion((current) => `${current} ${words}`.trim());
        };
        recognition.start();
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recognition?.stop();
      };
      recorder.start();
      recorderRef.current = { recorder, recognition };
      setRecording(true);
    } catch {
      Alert.alert('Microphone permission needed', 'Allow microphone access in your browser, then try again.');
    }
  }

  function stopVoiceNote() {
    recorderRef.current?.recorder?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  const repeatOptions = ['Never', 'Every day', 'Every week'];
  const calendarDays = getWeekDays(selectedDate);
  const monthCells = getMonthCells(selectedDate);
  const datePickerCells = getMonthCells(newDate);
  const monthLabel = selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const holidays = HOLIDAYS[holidayCountry] || HOLIDAYS.US;

  function isTaskOnDate(task, date) {
    if (task.repeat === 'Every day') return true;
    if (task.repeat === 'Every week') return task.date ? new Date(`${task.date}T00:00:00`).getDay() === date.getDay() : true;
    if (task.date) return sameDay(new Date(`${task.date}T00:00:00`), date);
    return sameDay(date, selectedDate);
  }

  function getHolidayForDate(date) {
    const key = toDateKey(date);
    const dynamic = holidayEntries.find((entry) => entry.date === key);
    return dynamic?.localName || dynamic?.name || getHolidayLabel(date, holidayCountry);
  }

  function toggleMessageApp(id) {
    setConnectedApps((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function openMap(location) {
    if (!location) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`);
  }

  async function saveHelperUrl(value) {
    setHelperUrl(value);
    await AsyncStorage.setItem(HELPER_KEY, value);
  }

  async function askAI() {
    if (!question.trim() || thinking) return;
    setThinking(true);
    setAnswer('');
    try {
      const onLocalWeb = Platform.OS === 'web' && typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const endpoint = Platform.OS === 'web' && !onLocalWeb ? '/api/ai' : `${helperUrl.replace(/\/$/, '')}/ai`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question.trim() }),
      });
      const raw = await response.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error('The AI helper returned an unexpected response. Check that the helper is running and try again.');
      }
      if (!response.ok) throw new Error(data.error || 'The helper could not answer.');
      setAnswer(data.answer);
    } catch (error) {
      setAnswer(error?.message || 'I could not reach the AI right now. Please check the Wi-Fi and the helper.');
    } finally {
      setThinking(false);
    }
  }

  const app = (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>FLOWCHART</Text>
              <Text style={styles.title}>Make time for what matters.</Text>
            </View>
            <View style={styles.avatar}><Text style={styles.logoBolt}>ϟ</Text><Text style={styles.logoLetters}>FC</Text></View>
          </View>

          {tab === 'planner' && (
            <>
              <View style={styles.heroCard}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroKicker}>TODAY'S FLOW</Text>
                  <Text style={styles.heroTitle}>{completed}/{tasks.length || 0} tasks complete</Text>
                  <Text style={styles.heroText}>Small steps now make tomorrow easier.</Text>
                </View>
                <View style={styles.progressRing}><Text style={styles.progressText}>{tasks.length ? Math.round((completed / tasks.length) * 100) : 0}%</Text></View>
              </View>

              <Text style={styles.sectionTitle}>Add an assignment</Text>
              <View style={styles.addCard}>
                <TextInput value={newTask} onChangeText={setNewTask} placeholder="What needs doing?" placeholderTextColor={colors.muted} style={styles.input} />
                <Pressable onPress={() => setShowDatePicker((current) => !current)} style={styles.dateButton}><Text style={styles.dateButtonText}>Date: {formatDateLabel(newDate)}</Text><Text style={styles.dateButtonIcon}>▦</Text></Pressable>
                {showDatePicker ? <View style={styles.datePicker}><Text style={styles.datePickerTitle}>{newDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><View style={styles.miniGrid}>{datePickerCells.slice(0, 35).map((date) => <Pressable key={date.toISOString()} onPress={() => { setNewDate(date); setShowDatePicker(false); }} style={[styles.miniDay, date.getMonth() !== newDate.getMonth() && styles.miniMuted, sameDay(date, newDate) && styles.miniSelected]}><Text style={[styles.miniDayText, sameDay(date, newDate) && styles.miniSelectedText]}>{date.getDate()}</Text></Pressable>)}</View></View> : null}
                <TextInput value={newDue} onChangeText={setNewDue} placeholder="Time, e.g. 4:00 PM" placeholderTextColor={colors.muted} style={[styles.input, styles.dueInput]} />
                <TextInput value={newLocation} onChangeText={setNewLocation} placeholder="Location (optional)" placeholderTextColor={colors.muted} style={[styles.input, styles.dueInput]} />
                {locationSuggestions.length ? <View style={styles.locationSuggestions}>{locationSuggestions.map((suggestion) => <Pressable key={suggestion.place_id} onPress={() => { setNewLocation(suggestion.display_name); setLocationSuggestions([]); }} style={styles.locationSuggestion}><Text numberOfLines={2} style={styles.locationSuggestionText}>{suggestion.display_name}</Text></Pressable>)}</View> : null}
                <Text style={styles.fieldLabel}>Repeat</Text>
                <View style={styles.chipRow}>{repeatOptions.map((option) => <Pressable key={option} onPress={() => setNewRepeat(option)} style={[styles.chip, newRepeat === option && styles.chipActive]}><Text style={[styles.chipText, newRepeat === option && styles.chipTextActive]}>{option}</Text></Pressable>)}</View>
                <Pressable onPress={addTask} style={styles.primaryButton}><Text style={styles.primaryText}>Add to my flow</Text></Pressable>
              </View>

              <View style={styles.sectionRow}><Text style={styles.sectionTitle}>My assignments</Text><Text style={styles.count}>{tasks.length} total</Text></View>
              {tasks.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.emptyTitle}>Your flow is clear.</Text><Text style={styles.emptyText}>Add one assignment above so nothing gets left behind.</Text></View>
              ) : tasks.map((task) => (
                <Pressable key={task.id} onPress={() => toggleTask(task.id)} style={[styles.taskCard, task.done && styles.taskDone]}>
                  <View style={[styles.check, task.done && styles.checkDone]}><Text style={styles.checkText}>{task.done ? '✓' : ''}</Text></View>
                  <View style={styles.taskCopy}><Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>{task.title}</Text><Text style={styles.taskDue}>{formatDue(task.due)}{task.repeat && task.repeat !== 'Never' ? ` · ${task.repeat}` : ''}</Text></View>
                  {task.location ? <Pressable onPress={() => openMap(task.location)} style={styles.mapButton}><Text style={styles.mapButtonText}>Start map</Text></Pressable> : null}<Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}

              <View style={styles.differenceCard}><Text style={styles.differenceLabel}>WHAT MAKES FLOWCHART DIFFERENT</Text><Text style={styles.differenceTitle}>Your messy notes become choices.</Text><Text style={styles.differenceText}>Ask the helper to balance homework, practice, exercise, and free time instead of forcing everything into one plan.</Text></View>
            </>
          )}

          {tab === 'calendar' && (
            <>
              <View style={styles.aiIntro}><Text style={styles.aiBadge}>MY CALENDAR</Text><Text style={styles.aiTitle}>See the time clearly.</Text><Text style={styles.aiText}>Switch between a week time grid and a month overview. Repeating plans and holidays stay visible.</Text></View>
              <View style={styles.calendarToolbar}><Pressable onPress={() => setSelectedDate(new Date())} style={styles.todayButton}><Text style={styles.todayText}>Today</Text></Pressable><Pressable onPress={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - (calendarMode === 'month' ? 30 : 7)))}><Text style={styles.navText}>‹</Text></Pressable><Text style={styles.calendarTitle}>{calendarMode === 'month' ? monthLabel : `${calendarDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${calendarDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}</Text><Pressable onPress={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + (calendarMode === 'month' ? 30 : 7)))}><Text style={styles.navText}>›</Text></Pressable></View>
              <View style={styles.modeRow}><Pressable onPress={() => setCalendarMode('week')} style={[styles.modeButton, calendarMode === 'week' && styles.modeButtonActive]}><Text style={[styles.modeText, calendarMode === 'week' && styles.modeTextActive]}>Week</Text></Pressable><Pressable onPress={() => setCalendarMode('month')} style={[styles.modeButton, calendarMode === 'month' && styles.modeButtonActive]}><Text style={[styles.modeText, calendarMode === 'month' && styles.modeTextActive]}>Month</Text></Pressable></View>
              <View style={styles.miniCalendar}><Text style={styles.miniTitle}>{monthLabel}</Text><View style={styles.miniGrid}>{monthCells.slice(0, 35).map((date) => <Pressable key={date.toISOString()} onPress={() => setSelectedDate(date)} style={[styles.miniDay, date.getMonth() !== selectedDate.getMonth() && styles.miniMuted, sameDay(date, selectedDate) && styles.miniSelected]}><Text style={[styles.miniDayText, sameDay(date, selectedDate) && styles.miniSelectedText]}>{date.getDate()}</Text></Pressable>)}</View></View>
              {calendarMode === 'week' ? <View style={styles.weekGrid}><View style={styles.weekHeader}><Text style={styles.timeHeader}>TIME</Text>{calendarDays.map((date) => <Text key={date.toISOString()} style={[styles.weekDay, sameDay(date, selectedDate) && styles.selectedWeekDay]}>{date.toLocaleDateString(undefined, { weekday: 'short' })}{'\n'}{date.getDate()}</Text>)}</View>{Array.from({ length: 12 }, (_, hourIndex) => <View key={hourIndex} style={styles.timeRow}><Text style={styles.timeLabel}>{hourIndex + 7}:00</Text>{calendarDays.map((date) => { const holiday = getHolidayForDate(date); const eventTasks = tasks.filter((task) => isTaskOnDate(task, date) && getTimeLabel(task.due).startsWith(String((hourIndex + 7) % 12 || 12))); return <View key={date.toISOString()} style={styles.timeCell}>{hourIndex === 0 && holiday ? <Text style={styles.holidayChip}>{holiday}</Text> : null}{eventTasks.map((task) => <Pressable key={task.id} onPress={() => task.location && openMap(task.location)} style={styles.calendarEvent}><Text style={styles.calendarEventText}>{task.title}</Text>{task.location ? <Text style={styles.mapHint}>Start map</Text> : null}</Pressable>)}</View>; })}</View>)}</View> : <View style={styles.monthGrid}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => <Text key={label} style={styles.monthWeekday}>{label}</Text>)}{monthCells.map((date) => { const holiday = getHolidayForDate(date); const dateTasks = tasks.filter((task) => isTaskOnDate(task, date)); return <Pressable key={date.toISOString()} onPress={() => setSelectedDate(date)} style={[styles.monthCell, date.getMonth() !== selectedDate.getMonth() && styles.miniMuted, sameDay(date, selectedDate) && styles.monthSelected]}><Text style={styles.monthDate}>{date.getDate()}</Text>{holiday ? <Text style={styles.monthHoliday}>{holiday}</Text> : null}{dateTasks.slice(0, 2).map((task) => <View key={task.id} style={styles.monthEvent}><Text numberOfLines={1} style={styles.monthEventText}>{task.title}</Text></View>)}</Pressable>; })}</View>}
              <View style={styles.holidayPanel}><Text style={styles.sectionTitle}>National holidays</Text><Text style={styles.helperHint}>Location detected: {countryName}. Showing {holidayCountry} holiday dates for {selectedDate.getFullYear()}.</Text><View style={styles.chipRow}>{['US', 'CA', 'UK'].map((country) => <Pressable key={country} onPress={() => { setHolidayCountry(country); setCountryName(country); }} style={[styles.chip, holidayCountry === country && styles.chipActive]}><Text style={[styles.chipText, holidayCountry === country && styles.chipTextActive]}>{country}</Text></Pressable>)}</View>{(holidayEntries.length ? holidayEntries.slice(0, 8).map((entry) => [entry.date, entry.localName || entry.name]) : holidays.slice(0, 8)).map(([key, label]) => <Text key={key} style={styles.holidayLine}>{label}</Text>)}</View>
            </>
          )}

          {tab === 'ai' && (
            <>
              <View style={styles.aiIntro}><Text style={styles.aiBadge}>AI HELPER</Text><Text style={styles.aiTitle}>Plan it your way.</Text><Text style={styles.aiText}>Type a messy note or a homework question. FlowChart will show its assumptions and give you choices.</Text></View>
              <Text style={styles.sectionTitle}>Your question</Text>
              <View style={styles.addCard}><TextInput value={question} onChangeText={setQuestion} placeholder="e.g. I have math at 6 and swim at 7. When can I study?" placeholderTextColor={colors.muted} style={[styles.input, styles.questionInput]} multiline /><Pressable onPress={recording ? stopVoiceNote : startVoiceNote} style={[styles.voiceButton, recording && styles.voiceButtonActive]}><Text style={styles.voiceText}>{recording ? '■ Stop and write it down' : '● Record a voice note'}</Text></Pressable><Pressable disabled={thinking} onPress={askAI} style={[styles.primaryButton, thinking && styles.disabledButton]}><Text style={styles.primaryText}>{thinking ? 'Thinking…' : 'Ask FlowChart'}</Text></Pressable></View>
              {answer ? <View style={styles.answerCard}><Text style={styles.answerLabel}>FLOWCHART SAYS</Text><Text style={styles.answerText}>{answer}</Text></View> : <View style={styles.tipCard}><Text style={styles.tipTitle}>Try a real-life note</Text><Text style={styles.tipText}>“I have homework, violin, and swimming today. Help me make a plan with time to relax.”</Text></View>}
              <View style={styles.safetyCard}><Text style={styles.safetyTitle}>A safe suggestion</Text><Text style={styles.safetyText}>This is a suggestion, not a guarantee. Check the plan and change anything that does not fit your day.</Text></View>
              <Text style={styles.sectionTitle}>Computer helper address</Text><TextInput value={helperUrl} onChangeText={saveHelperUrl} autoCapitalize="none" autoCorrect={false} style={styles.inputStandalone} /><Text style={styles.helperHint}>Use the address printed when the computer helper starts. Your key stays on your computer.</Text>
            </>
          )}

          {tab === 'messages' && <><View style={styles.aiIntro}><Text style={styles.aiBadge}>MESSAGE HUB</Text><Text style={styles.aiTitle}>All your messages in one place.</Text><Text style={styles.aiText}>Choose the apps you want to connect. FlowChart will keep each service separate and ask you to sign in safely.</Text></View><View style={styles.modeRow}><Pressable onPress={() => setMessageSource('all')} style={[styles.modeButton, messageSource === 'all' && styles.modeButtonActive]}><Text style={[styles.modeText, messageSource === 'all' && styles.modeTextActive]}>All</Text></Pressable>{MESSAGE_APPS.slice(0, 4).map((app) => <Pressable key={app.id} onPress={() => setMessageSource(app.id)} style={[styles.modeButton, messageSource === app.id && styles.modeButtonActive]}><Text style={[styles.modeText, messageSource === app.id && styles.modeTextActive]}>{app.icon}</Text></Pressable>)}</View><Text style={styles.sectionTitle}>Connect apps</Text>{MESSAGE_APPS.map((app) => <View key={app.id} style={styles.appRow}><View style={styles.appIcon}><Text style={styles.appIconText}>{app.icon}</Text></View><View style={styles.appCopy}><Text style={styles.appName}>{app.label}</Text><Text style={styles.appStatus}>{connectedApps.includes(app.id) ? 'Connected on this device' : 'Ready to connect securely'}</Text></View><Pressable onPress={() => toggleMessageApp(app.id)} style={[styles.connectButton, connectedApps.includes(app.id) && styles.connectedButton]}><Text style={[styles.connectText, connectedApps.includes(app.id) && styles.connectedText]}>{connectedApps.includes(app.id) ? 'Connected' : 'Connect'}</Text></Pressable></View>)}<View style={styles.messagesCard}><Text style={styles.messageIcon}>☼</Text><Text style={styles.aiTitle}>Your inbox will appear here.</Text><Text style={styles.aiText}>{connectedApps.length ? 'The connection controls are ready. Provider sign-in and permissions are needed before real messages can be imported.' : 'Connect an app above to choose which messages FlowChart can show.'}</Text></View></>}
        </ScrollView>
        <View style={styles.tabBar}>
          <TabButton active={tab === 'planner'} label="My flow" icon="▦" onPress={() => setTab('planner')} />
          <TabButton active={tab === 'calendar'} label="Calendar" icon="□" onPress={() => setTab('calendar')} />
          <TabButton active={tab === 'ai'} label="AI helper" icon="✦" onPress={() => setTab('ai')} />
          <TabButton active={tab === 'messages'} label="Messages" icon="◌" onPress={() => setTab('messages')} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  if (Platform.OS === 'web') {
    return <View style={styles.webStage}><View style={styles.webPhone}>{app}</View></View>;
  }
  return app;
}

function TabButton({ active, label, icon, onPress }) {
  return <Pressable onPress={onPress} style={styles.tabButton}><Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text><Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  webStage: { flex: 1, minHeight: '100vh', backgroundColor: '#E9EAF0', alignItems: 'center' },
  webPhone: { width: 400, maxWidth: '100%', height: '100vh', overflow: 'hidden', backgroundColor: colors.soft, shadowColor: '#1C2340', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  logoBolt: { color: '#B9B4FF', fontSize: 24, fontWeight: '900', transform: [{ rotate: '-14deg' }], lineHeight: 23 }, logoLetters: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: -2 },
  dateButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 11 }, dateButtonText: { color: colors.ink, fontSize: 14, fontWeight: '700' }, dateButtonIcon: { color: colors.purple, fontSize: 17 }, datePicker: { backgroundColor: colors.soft, borderRadius: 14, padding: 10, marginTop: 8 }, datePickerTitle: { color: colors.ink, fontWeight: '800', marginBottom: 6 }, locationSuggestions: { backgroundColor: colors.soft, borderRadius: 12, marginTop: 6, overflow: 'hidden' }, locationSuggestion: { padding: 10, borderBottomWidth: 1, borderBottomColor: colors.line }, locationSuggestionText: { color: colors.ink, fontSize: 12, lineHeight: 17 },
  appRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 15, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: colors.line }, appIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, appIconText: { color: colors.purple, fontSize: 11, fontWeight: '900' }, appCopy: { flex: 1 }, appName: { color: colors.ink, fontWeight: '800', fontSize: 14 }, appStatus: { color: colors.muted, fontSize: 11, marginTop: 3 }, connectButton: { backgroundColor: colors.purple, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9 }, connectedButton: { backgroundColor: colors.green }, connectText: { color: '#fff', fontSize: 10, fontWeight: '800' }, connectedText: { color: '#fff' },
  calendarToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, todayButton: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 }, todayText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, navText: { color: colors.ink, fontSize: 28, lineHeight: 28, paddingHorizontal: 4 }, calendarTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 }, modeRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 3, marginBottom: 12 }, modeButton: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 }, modeButtonActive: { backgroundColor: colors.ink }, modeText: { color: colors.muted, fontWeight: '800', fontSize: 12 }, modeTextActive: { color: '#fff' }, miniCalendar: { backgroundColor: colors.card, borderRadius: 16, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: colors.line }, miniTitle: { color: colors.ink, fontWeight: '800', marginBottom: 8 }, miniGrid: { flexDirection: 'row', flexWrap: 'wrap' }, miniDay: { width: '14.285%', alignItems: 'center', paddingVertical: 5, borderRadius: 12 }, miniDayText: { color: colors.ink, fontSize: 11 }, miniMuted: { opacity: 0.35 }, miniSelected: { backgroundColor: colors.purple }, miniSelectedText: { color: '#fff', fontWeight: '800' }, weekGrid: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, marginBottom: 14 }, weekHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 }, timeHeader: { width: 45, color: colors.muted, fontSize: 9, textAlign: 'center' }, weekDay: { flex: 1, color: colors.muted, fontSize: 10, textAlign: 'center', lineHeight: 15, fontWeight: '800' }, selectedWeekDay: { color: colors.purple }, timeRow: { flexDirection: 'row', minHeight: 42, borderBottomWidth: 1, borderBottomColor: colors.line }, timeLabel: { width: 45, color: colors.muted, fontSize: 9, textAlign: 'center', paddingTop: 9 }, timeCell: { flex: 1, borderLeftWidth: 1, borderLeftColor: colors.line, padding: 2 }, holidayChip: { backgroundColor: colors.green, color: '#fff', borderRadius: 5, fontSize: 8, padding: 3, overflow: 'hidden' }, calendarEvent: { backgroundColor: colors.purpleSoft, borderRadius: 5, padding: 4, marginTop: 2 }, calendarEventText: { color: colors.ink, fontSize: 8, fontWeight: '700' }, mapHint: { color: colors.purple, fontSize: 8, fontWeight: '800' }, monthGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.card, borderRadius: 16, padding: 5, borderWidth: 1, borderColor: colors.line, marginBottom: 14 }, monthWeekday: { width: '14.285%', color: colors.muted, fontSize: 9, fontWeight: '800', textAlign: 'center', paddingVertical: 6 }, monthCell: { width: '14.285%', minHeight: 62, borderTopWidth: 1, borderRightWidth: 1, borderColor: colors.line, padding: 4 }, monthSelected: { backgroundColor: colors.purpleSoft }, monthDate: { color: colors.ink, fontSize: 11, fontWeight: '800' }, monthHoliday: { color: colors.green, fontSize: 7, marginTop: 2 }, monthEvent: { backgroundColor: colors.purple, borderRadius: 3, paddingHorizontal: 3, marginTop: 3 }, monthEventText: { color: '#fff', fontSize: 7 }, holidayPanel: { backgroundColor: '#EAF8F0', borderRadius: 16, padding: 15, marginBottom: 18 }, holidayLine: { color: '#286B48', fontSize: 12, paddingTop: 7 }, mapButton: { backgroundColor: colors.purpleSoft, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 7, marginLeft: 6 }, mapButtonText: { color: colors.purple, fontSize: 9, fontWeight: '800' },
  safe: { flex: 1, backgroundColor: colors.soft }, flex: { flex: 1 }, page: { padding: 22, paddingBottom: 130 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }, eyebrow: { color: colors.purple, fontSize: 12, fontWeight: '800', letterSpacing: 2 }, title: { color: colors.ink, fontSize: 27, fontWeight: '800', marginTop: 6, maxWidth: 280 }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' }, heroCard: { backgroundColor: colors.ink, borderRadius: 24, padding: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }, heroCopy: { flex: 1 }, heroKicker: { color: '#B9B4FF', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 }, heroTitle: { color: '#fff', fontSize: 23, fontWeight: '800', marginTop: 7 }, heroText: { color: '#C9CBE0', fontSize: 13, marginTop: 7, lineHeight: 19 }, progressRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 7, borderColor: colors.purple, alignItems: 'center', justifyContent: 'center', marginLeft: 14 }, progressText: { color: '#fff', fontWeight: '800', fontSize: 15 }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 12, marginTop: 4 }, count: { color: colors.muted, fontSize: 13, marginBottom: 12 }, addCard: { backgroundColor: colors.card, borderRadius: 18, padding: 15, marginBottom: 25, borderWidth: 1, borderColor: colors.line }, input: { color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10, fontSize: 15 }, dueInput: { fontSize: 13, marginTop: 4 }, questionInput: { minHeight: 100, textAlignVertical: 'top', borderBottomWidth: 0 }, fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 7 }, chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.soft }, chipActive: { backgroundColor: colors.purpleSoft, borderColor: colors.purple }, chipText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: colors.purple }, primaryButton: { backgroundColor: colors.purple, borderRadius: 13, alignItems: 'center', padding: 14, marginTop: 14 }, voiceButton: { backgroundColor: colors.purpleSoft, borderRadius: 13, alignItems: 'center', padding: 12, marginTop: 12 }, voiceButtonActive: { backgroundColor: '#FFE9E8' }, voiceText: { color: colors.purple, fontSize: 13, fontWeight: '800' }, disabledButton: { opacity: 0.55 }, primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' }, emptyCard: { backgroundColor: colors.card, borderRadius: 18, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: colors.line }, emptyIcon: { color: colors.purple, fontSize: 26 }, emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 16, marginTop: 10 }, emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: 6 }, taskCard: { backgroundColor: colors.card, borderRadius: 17, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line }, taskDone: { opacity: 0.62 }, check: { width: 25, height: 25, borderRadius: 9, borderWidth: 2, borderColor: '#D8D9E5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, checkDone: { backgroundColor: colors.green, borderColor: colors.green }, checkText: { color: '#fff', fontWeight: '900' }, taskCopy: { flex: 1 }, taskTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' }, taskTitleDone: { textDecorationLine: 'line-through' }, taskDue: { color: colors.muted, marginTop: 4, fontSize: 12 }, chevron: { color: colors.muted, fontSize: 25, marginLeft: 8 }, differenceCard: { backgroundColor: colors.purpleSoft, borderRadius: 18, padding: 18, marginTop: 20 }, differenceLabel: { color: colors.purple, fontWeight: '800', fontSize: 10, letterSpacing: 1.2 }, differenceTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 8 }, differenceText: { color: colors.muted, lineHeight: 20, marginTop: 7 }, dayCard: { backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 11, borderWidth: 1, borderColor: colors.line }, dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, dayTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, dayCount: { color: colors.purple, fontSize: 12, fontWeight: '700' }, eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line }, timePill: { backgroundColor: colors.purpleSoft, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 8, marginRight: 10 }, timeText: { color: colors.purple, fontSize: 11, fontWeight: '800' }, eventCopy: { flex: 1 }, eventTitle: { color: colors.ink, fontWeight: '700', fontSize: 14 }, eventRepeat: { color: colors.muted, fontSize: 11, marginTop: 3 }, openDay: { color: colors.muted, fontSize: 13 }, aiIntro: { backgroundColor: colors.purpleSoft, borderRadius: 22, padding: 21, marginBottom: 25 }, aiBadge: { color: colors.purple, fontWeight: '800', letterSpacing: 1.2, fontSize: 11 }, aiTitle: { color: colors.ink, fontWeight: '800', fontSize: 25, marginTop: 8 }, aiText: { color: colors.muted, lineHeight: 21, marginTop: 8, fontSize: 14 }, answerCard: { backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.purple, marginBottom: 14 }, answerLabel: { color: colors.purple, fontWeight: '800', fontSize: 10, letterSpacing: 1.2 }, answerText: { color: colors.ink, fontSize: 15, lineHeight: 23, marginTop: 10 }, tipCard: { backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.line, marginBottom: 14 }, tipTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 }, tipText: { color: colors.muted, lineHeight: 20, marginTop: 7 }, safetyCard: { backgroundColor: '#FFF5E9', borderRadius: 16, padding: 16, marginBottom: 22 }, safetyTitle: { color: colors.orange, fontWeight: '800' }, safetyText: { color: '#8D6A42', lineHeight: 19, marginTop: 6, fontSize: 13 }, inputStandalone: { backgroundColor: colors.card, color: colors.ink, borderWidth: 1, borderColor: colors.line, borderRadius: 13, padding: 13, fontSize: 14 }, helperHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 }, messagesCard: { backgroundColor: colors.card, borderRadius: 22, padding: 24, alignItems: 'center', marginTop: 30 }, messageIcon: { color: colors.purple, fontSize: 38, marginBottom: 10 }, tabBar: { position: 'absolute', left: 16, right: 16, bottom: 18, height: 72, backgroundColor: colors.card, borderRadius: 22, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: colors.line }, tabButton: { alignItems: 'center', justifyContent: 'center', minWidth: 82 }, tabIcon: { color: colors.muted, fontSize: 21, marginBottom: 4 }, tabLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' }, tabActive: { color: colors.purple },
});
