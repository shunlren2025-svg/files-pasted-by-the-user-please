import React, { useEffect, useMemo, useState } from 'react';
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

export default function App() {
  const [tab, setTab] = useState('planner');
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [newDue, setNewDue] = useState('Today · 4:00 PM');
  const [helperUrl, setHelperUrl] = useState(DEFAULT_HELPER_URL);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [thinking, setThinking] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
    setTasks((current) => [{ id: String(Date.now()), title: newTask.trim(), due: newDue.trim() || 'No time set', done: false }, ...current]);
    setNewTask('');
  }

  function toggleTask(id) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
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
      const response = await fetch(`${helperUrl.replace(/\/$/, '')}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The helper could not answer.');
      setAnswer(data.answer);
    } catch {
      setAnswer('I could not reach the AI right now. Please check your key, Wi-Fi, and that the FlowChart helper is running on your computer.');
    } finally {
      setThinking(false);
    }
  }

  return (
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
                <Pressable onPress={addTask} style={styles.primaryButton}><Text style={styles.primaryText}>Add to my flow</Text></Pressable>
              </View>

              <View style={styles.sectionRow}><Text style={styles.sectionTitle}>My assignments</Text><Text style={styles.count}>{tasks.length} total</Text></View>
              {tasks.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.emptyTitle}>Your flow is clear.</Text><Text style={styles.emptyText}>Add one assignment above so nothing gets left behind.</Text></View>
              ) : tasks.map((task) => (
                <Pressable key={task.id} onPress={() => toggleTask(task.id)} style={[styles.taskCard, task.done && styles.taskDone]}>
                  <View style={[styles.check, task.done && styles.checkDone]}><Text style={styles.checkText}>{task.done ? '✓' : ''}</Text></View>
                  <View style={styles.taskCopy}><Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>{task.title}</Text><Text style={styles.taskDue}>{formatDue(task.due)}</Text></View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}

              <View style={styles.differenceCard}><Text style={styles.differenceLabel}>WHAT MAKES FLOWCHART DIFFERENT</Text><Text style={styles.differenceTitle}>Your messy notes become choices.</Text><Text style={styles.differenceText}>Ask the helper to balance homework, practice, exercise, and free time instead of forcing everything into one plan.</Text></View>
            </>
          )}

          {tab === 'ai' && (
            <>
              <View style={styles.aiIntro}><Text style={styles.aiBadge}>AI HELPER</Text><Text style={styles.aiTitle}>Plan it your way.</Text><Text style={styles.aiText}>Type a messy note or a homework question. FlowChart will show its assumptions and give you choices.</Text></View>
              <Text style={styles.sectionTitle}>Your question</Text>
              <View style={styles.addCard}><TextInput value={question} onChangeText={setQuestion} placeholder="e.g. I have math at 6 and swim at 7. When can I study?" placeholderTextColor={colors.muted} style={[styles.input, styles.questionInput]} multiline /><Pressable disabled={thinking} onPress={askAI} style={[styles.primaryButton, thinking && styles.disabledButton]}><Text style={styles.primaryText}>{thinking ? 'Thinking…' : 'Ask FlowChart'}</Text></Pressable></View>
              {answer ? <View style={styles.answerCard}><Text style={styles.answerLabel}>FLOWCHART SAYS</Text><Text style={styles.answerText}>{answer}</Text></View> : <View style={styles.tipCard}><Text style={styles.tipTitle}>Try a real-life note</Text><Text style={styles.tipText}>“I have homework, violin, and swimming today. Help me make a plan with time to relax.”</Text></View>}
              <View style={styles.safetyCard}><Text style={styles.safetyTitle}>A safe suggestion</Text><Text style={styles.safetyText}>This is a suggestion, not a guarantee. Check the plan and change anything that does not fit your day.</Text></View>
              <Text style={styles.sectionTitle}>Computer helper address</Text><TextInput value={helperUrl} onChangeText={saveHelperUrl} autoCapitalize="none" autoCorrect={false} style={styles.inputStandalone} /><Text style={styles.helperHint}>Use the address printed when the computer helper starts. Your key stays on your computer.</Text>
            </>
          )}

          {tab === 'messages' && <View style={styles.messagesCard}><Text style={styles.messageIcon}>☼</Text><Text style={styles.aiTitle}>Team messages, later.</Text><Text style={styles.aiText}>This space is ready for team or school updates in a future version. For now, keep your assignment flow here.</Text></View>}
        </ScrollView>
        <View style={styles.tabBar}>
          <TabButton active={tab === 'planner'} label="My flow" icon="▦" onPress={() => setTab('planner')} />
          <TabButton active={tab === 'ai'} label="AI helper" icon="✦" onPress={() => setTab('ai')} />
          <TabButton active={tab === 'messages'} label="Messages" icon="◌" onPress={() => setTab('messages')} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TabButton({ active, label, icon, onPress }) {
  return <Pressable onPress={onPress} style={styles.tabButton}><Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text><Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.soft }, flex: { flex: 1 }, page: { padding: 22, paddingBottom: 130 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }, eyebrow: { color: colors.purple, fontSize: 12, fontWeight: '800', letterSpacing: 2 }, title: { color: colors.ink, fontSize: 27, fontWeight: '800', marginTop: 6, maxWidth: 280 }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' }, heroCard: { backgroundColor: colors.ink, borderRadius: 24, padding: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }, heroCopy: { flex: 1 }, heroKicker: { color: '#B9B4FF', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 }, heroTitle: { color: '#fff', fontSize: 23, fontWeight: '800', marginTop: 7 }, heroText: { color: '#C9CBE0', fontSize: 13, marginTop: 7, lineHeight: 19 }, progressRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 7, borderColor: colors.purple, alignItems: 'center', justifyContent: 'center', marginLeft: 14 }, progressText: { color: '#fff', fontWeight: '800', fontSize: 15 }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 12, marginTop: 4 }, count: { color: colors.muted, fontSize: 13, marginBottom: 12 }, addCard: { backgroundColor: colors.card, borderRadius: 18, padding: 15, marginBottom: 25, borderWidth: 1, borderColor: colors.line }, input: { color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10, fontSize: 15 }, dueInput: { fontSize: 13, marginTop: 4 }, questionInput: { minHeight: 100, textAlignVertical: 'top', borderBottomWidth: 0 }, primaryButton: { backgroundColor: colors.purple, borderRadius: 13, alignItems: 'center', padding: 14, marginTop: 14 }, disabledButton: { opacity: 0.55 }, primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' }, emptyCard: { backgroundColor: colors.card, borderRadius: 18, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: colors.line }, emptyIcon: { color: colors.purple, fontSize: 26 }, emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 16, marginTop: 10 }, emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: 6 }, taskCard: { backgroundColor: colors.card, borderRadius: 17, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line }, taskDone: { opacity: 0.62 }, check: { width: 25, height: 25, borderRadius: 9, borderWidth: 2, borderColor: '#D8D9E5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, checkDone: { backgroundColor: colors.green, borderColor: colors.green }, checkText: { color: '#fff', fontWeight: '900' }, taskCopy: { flex: 1 }, taskTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' }, taskTitleDone: { textDecorationLine: 'line-through' }, taskDue: { color: colors.muted, marginTop: 4, fontSize: 12 }, chevron: { color: colors.muted, fontSize: 25, marginLeft: 8 }, differenceCard: { backgroundColor: colors.purpleSoft, borderRadius: 18, padding: 18, marginTop: 20 }, differenceLabel: { color: colors.purple, fontWeight: '800', fontSize: 10, letterSpacing: 1.2 }, differenceTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 8 }, differenceText: { color: colors.muted, lineHeight: 20, marginTop: 7 }, aiIntro: { backgroundColor: colors.purpleSoft, borderRadius: 22, padding: 21, marginBottom: 25 }, aiBadge: { color: colors.purple, fontWeight: '800', letterSpacing: 1.2, fontSize: 11 }, aiTitle: { color: colors.ink, fontWeight: '800', fontSize: 25, marginTop: 8 }, aiText: { color: colors.muted, lineHeight: 21, marginTop: 8, fontSize: 14 }, answerCard: { backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.purple, marginBottom: 14 }, answerLabel: { color: colors.purple, fontWeight: '800', fontSize: 10, letterSpacing: 1.2 }, answerText: { color: colors.ink, fontSize: 15, lineHeight: 23, marginTop: 10 }, tipCard: { backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.line, marginBottom: 14 }, tipTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 }, tipText: { color: colors.muted, lineHeight: 20, marginTop: 7 }, safetyCard: { backgroundColor: '#FFF5E9', borderRadius: 16, padding: 16, marginBottom: 22 }, safetyTitle: { color: colors.orange, fontWeight: '800' }, safetyText: { color: '#8D6A42', lineHeight: 19, marginTop: 6, fontSize: 13 }, inputStandalone: { backgroundColor: colors.card, color: colors.ink, borderWidth: 1, borderColor: colors.line, borderRadius: 13, padding: 13, fontSize: 14 }, helperHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 }, messagesCard: { backgroundColor: colors.card, borderRadius: 22, padding: 24, alignItems: 'center', marginTop: 30 }, messageIcon: { color: colors.purple, fontSize: 38, marginBottom: 10 }, tabBar: { position: 'absolute', left: 16, right: 16, bottom: 18, height: 72, backgroundColor: colors.card, borderRadius: 22, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: colors.line }, tabButton: { alignItems: 'center', justifyContent: 'center', minWidth: 82 }, tabIcon: { color: colors.muted, fontSize: 21, marginBottom: 4 }, tabLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' }, tabActive: { color: colors.purple },
});
