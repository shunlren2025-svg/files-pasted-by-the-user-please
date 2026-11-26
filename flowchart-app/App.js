import React, { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import {
  Alert,
  KeyboardAvoidingView,
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
const DEFAULT_HELPER_URL = 'http://192.168.1.100:8787';

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

function formatDue(value) {
  if (!value) return 'No time set';
  return value;
}

function getTimeLabel(value) {
  const match = String(value || '').match(/\d{1,2}:\d{2}\s?(?:AM|PM)/i);
  return match ? match[0] : 'Any time';
}

export default function App() {
  const [tab, setTab] = useState('planner');
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [newDue, setNewDue] = useState('Today · 4:00 PM');
  const [newRepeat, setNewRepeat] = useState('Never');
  const [helperUrl, setHelperUrl] = useState(DEFAULT_HELPER_URL);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [thinking, setThinking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);

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

  const completed = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);

  function addTask() {
    if (!newTask.trim()) {
      Alert.alert('Add an assignment', 'Write a short name first, like “Math worksheet”.');
      return;
    }
    setTasks((current) => [{ id: String(Date.now()), title: newTask.trim(), due: newDue.trim() || 'No time set', repeat: newRepeat, done: false }, ...current]);
    setNewTask('');
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
  const calendarDays = ['Today', 'Tomorrow', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  async function saveHelperUrl(value) {
    setHelperUrl(value);
    await AsyncStorage.setItem(HELPER_KEY, value);
  }

  async function askAI() {
    if (!question.trim() || thinking) return;
    setThinking(true);
    setAnswer('');
    try {
      const endpoint = Platform.OS === 'web' ? '/api/ai' : `${helperUrl.replace(/\/$/, '')}/ai`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question.trim() }),
      });
      const data = await response.json();
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
            <View style={styles.avatar}><Text style={styles.avatarText}>F</Text></View>
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
                <TextInput value={newDue} onChangeText={setNewDue} placeholder="When?" placeholderTextColor={colors.muted} style={[styles.input, styles.dueInput]} />
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
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}

              <View style={styles.differenceCard}><Text style={styles.differenceLabel}>WHAT MAKES FLOWCHART DIFFERENT</Text><Text style={styles.differenceTitle}>Your messy notes become choices.</Text><Text style={styles.differenceText}>Ask the helper to balance homework, practice, exercise, and free time instead of forcing everything into one plan.</Text></View>
            </>
          )}

          {tab === 'calendar' && (
            <>
              <View style={styles.aiIntro}><Text style={styles.aiBadge}>MY CALENDAR</Text><Text style={styles.aiTitle}>See the time clearly.</Text><Text style={styles.aiText}>Your assignments appear by day and time. Repeating plans stay visible all week.</Text></View>
              {calendarDays.map((day, index) => {
                const dayTasks = tasks.filter((task) => index === 0 || (task.repeat && task.repeat !== 'Never'));
                return <View key={day} style={styles.dayCard}><View style={styles.dayHeader}><Text style={styles.dayTitle}>{day}</Text><Text style={styles.dayCount}>{dayTasks.length ? `${dayTasks.length} plan${dayTasks.length === 1 ? '' : 's'}` : 'Open'}</Text></View>{dayTasks.length ? dayTasks.map((task) => <View key={`${day}-${task.id}`} style={styles.eventRow}><View style={styles.timePill}><Text style={styles.timeText}>{getTimeLabel(task.due)}</Text></View><View style={styles.eventCopy}><Text style={styles.eventTitle}>{task.title}</Text><Text style={styles.eventRepeat}>{task.repeat && task.repeat !== 'Never' ? task.repeat : 'One time'}</Text></View></View>) : <Text style={styles.openDay}>Nothing planned yet.</Text>}</View>;
              })}
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

          {tab === 'messages' && <View style={styles.messagesCard}><Text style={styles.messageIcon}>☼</Text><Text style={styles.aiTitle}>Team messages, later.</Text><Text style={styles.aiText}>This space is ready for team or school updates in a future version. For now, keep your assignment flow here.</Text></View>}
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
  safe: { flex: 1, backgroundColor: colors.soft }, flex: { flex: 1 }, page: { padding: 22, paddingBottom: 130 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }, eyebrow: { color: colors.purple, fontSize: 12, fontWeight: '800', letterSpacing: 2 }, title: { color: colors.ink, fontSize: 27, fontWeight: '800', marginTop: 6, maxWidth: 280 }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' }, heroCard: { backgroundColor: colors.ink, borderRadius: 24, padding: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }, heroCopy: { flex: 1 }, heroKicker: { color: '#B9B4FF', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 }, heroTitle: { color: '#fff', fontSize: 23, fontWeight: '800', marginTop: 7 }, heroText: { color: '#C9CBE0', fontSize: 13, marginTop: 7, lineHeight: 19 }, progressRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 7, borderColor: colors.purple, alignItems: 'center', justifyContent: 'center', marginLeft: 14 }, progressText: { color: '#fff', fontWeight: '800', fontSize: 15 }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 12, marginTop: 4 }, count: { color: colors.muted, fontSize: 13, marginBottom: 12 }, addCard: { backgroundColor: colors.card, borderRadius: 18, padding: 15, marginBottom: 25, borderWidth: 1, borderColor: colors.line }, input: { color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10, fontSize: 15 }, dueInput: { fontSize: 13, marginTop: 4 }, questionInput: { minHeight: 100, textAlignVertical: 'top', borderBottomWidth: 0 }, fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 7 }, chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.soft }, chipActive: { backgroundColor: colors.purpleSoft, borderColor: colors.purple }, chipText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: colors.purple }, primaryButton: { backgroundColor: colors.purple, borderRadius: 13, alignItems: 'center', padding: 14, marginTop: 14 }, voiceButton: { backgroundColor: colors.purpleSoft, borderRadius: 13, alignItems: 'center', padding: 12, marginTop: 12 }, voiceButtonActive: { backgroundColor: '#FFE9E8' }, voiceText: { color: colors.purple, fontSize: 13, fontWeight: '800' }, disabledButton: { opacity: 0.55 }, primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' }, emptyCard: { backgroundColor: colors.card, borderRadius: 18, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: colors.line }, emptyIcon: { color: colors.purple, fontSize: 26 }, emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 16, marginTop: 10 }, emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: 6 }, taskCard: { backgroundColor: colors.card, borderRadius: 17, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line }, taskDone: { opacity: 0.62 }, check: { width: 25, height: 25, borderRadius: 9, borderWidth: 2, borderColor: '#D8D9E5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, checkDone: { backgroundColor: colors.green, borderColor: colors.green }, checkText: { color: '#fff', fontWeight: '900' }, taskCopy: { flex: 1 }, taskTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' }, taskTitleDone: { textDecorationLine: 'line-through' }, taskDue: { color: colors.muted, marginTop: 4, fontSize: 12 }, chevron: { color: colors.muted, fontSize: 25, marginLeft: 8 }, differenceCard: { backgroundColor: colors.purpleSoft, borderRadius: 18, padding: 18, marginTop: 20 }, differenceLabel: { color: colors.purple, fontWeight: '800', fontSize: 10, letterSpacing: 1.2 }, differenceTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 8 }, differenceText: { color: colors.muted, lineHeight: 20, marginTop: 7 }, dayCard: { backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 11, borderWidth: 1, borderColor: colors.line }, dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, dayTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, dayCount: { color: colors.purple, fontSize: 12, fontWeight: '700' }, eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line }, timePill: { backgroundColor: colors.purpleSoft, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 8, marginRight: 10 }, timeText: { color: colors.purple, fontSize: 11, fontWeight: '800' }, eventCopy: { flex: 1 }, eventTitle: { color: colors.ink, fontWeight: '700', fontSize: 14 }, eventRepeat: { color: colors.muted, fontSize: 11, marginTop: 3 }, openDay: { color: colors.muted, fontSize: 13 }, aiIntro: { backgroundColor: colors.purpleSoft, borderRadius: 22, padding: 21, marginBottom: 25 }, aiBadge: { color: colors.purple, fontWeight: '800', letterSpacing: 1.2, fontSize: 11 }, aiTitle: { color: colors.ink, fontWeight: '800', fontSize: 25, marginTop: 8 }, aiText: { color: colors.muted, lineHeight: 21, marginTop: 8, fontSize: 14 }, answerCard: { backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.purple, marginBottom: 14 }, answerLabel: { color: colors.purple, fontWeight: '800', fontSize: 10, letterSpacing: 1.2 }, answerText: { color: colors.ink, fontSize: 15, lineHeight: 23, marginTop: 10 }, tipCard: { backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.line, marginBottom: 14 }, tipTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 }, tipText: { color: colors.muted, lineHeight: 20, marginTop: 7 }, safetyCard: { backgroundColor: '#FFF5E9', borderRadius: 16, padding: 16, marginBottom: 22 }, safetyTitle: { color: colors.orange, fontWeight: '800' }, safetyText: { color: '#8D6A42', lineHeight: 19, marginTop: 6, fontSize: 13 }, inputStandalone: { backgroundColor: colors.card, color: colors.ink, borderWidth: 1, borderColor: colors.line, borderRadius: 13, padding: 13, fontSize: 14 }, helperHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 }, messagesCard: { backgroundColor: colors.card, borderRadius: 22, padding: 24, alignItems: 'center', marginTop: 30 }, messageIcon: { color: colors.purple, fontSize: 38, marginBottom: 10 }, tabBar: { position: 'absolute', left: 16, right: 16, bottom: 18, height: 72, backgroundColor: colors.card, borderRadius: 22, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: colors.line }, tabButton: { alignItems: 'center', justifyContent: 'center', minWidth: 82 }, tabIcon: { color: colors.muted, fontSize: 21, marginBottom: 4 }, tabLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' }, tabActive: { color: colors.purple },
});
