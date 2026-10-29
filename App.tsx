import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Image, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Modal, ScrollView, Linking, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TMDB_KEY_STORAGE = 'TMDB_KEY';
const FAV_KEY = 'FAV_LIST';
const WATCH_KEY = 'WATCH_LIST';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

type Media = {
  id: string;
  title: string;
  year?: string;
  poster?: string;
  type: 'movie' | 'tv' | 'anime';
  overview?: string;
  vote?: number;
};

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'discover' | 'movies' | 'series' | 'anime' | 'favs'>('discover');
  const [results, setResults] = useState<Media[]>([]);
  const [favs, setFavs] = useState<Media[]>([]);
  const [watch, setWatch] = useState<Media[]>([]);
  const [selected, setSelected] = useState<Media | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempKey, setTempKey] = useState('');

  useEffect(() => {
    (async () => {
      const k = await AsyncStorage.getItem(TMDB_KEY_STORAGE);
      const f = await AsyncStorage.getItem(FAV_KEY);
      const w = await AsyncStorage.getItem(WATCH_KEY);
      if (k) setApiKey(k);
      if (f) setFavs(JSON.parse(f));
      if (w) setWatch(JSON.parse(w));
      loadDiscover(k || '');
    })();
  }, []);

  const saveFavs = async (list: Media[]) => {
    setFavs(list);
    await AsyncStorage.setItem(FAV_KEY, JSON.stringify(list));
  };

  const loadDiscover = async (key: string) => {
    setLoading(true);
    try {
      if (!key) {
        setResults([
          { id: '299534', title: 'Avengers Endgame', year: '2019', poster: IMG_BASE + '/or06FN3Dka5tukK1e9sl16pB3iy.jpg', type: 'movie', vote: 8.3 },
          { id: '533535', title: 'Deadpool & Wolverine', year: '2024', poster: IMG_BASE + '/8cdWjvZQUExUUTzyp4t6EDMubf.jpg', type: 'movie', vote: 7.6 },
          { id: '693134', title: 'Dune Part Two', year: '2024', poster: IMG_BASE + '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', type: 'movie', vote: 8.2 },
          { id: '1429', title: 'Attack on Titan', year: '2013', poster: IMG_BASE + '/hTP1DtLGFamjfu8WqjnuQdP1.jpg', type: 'anime', vote: 8.7 },
        ]);
      } else {
        const res = await fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${key}`);
        const data = await res.json();
        const mapped: Media[] = (data.results || []).slice(0, 20).map((m: any) => ({
          id: String(m.id),
          title: m.title || m.name,
          year: (m.release_date || m.first_air_date || '').slice(0, 4),
          poster: m.poster_path ? IMG_BASE + m.poster_path : undefined,
          type: m.media_type === 'tv' ? 'tv' : 'movie',
          overview: m.overview,
          vote: m.vote_average
        }));
        setResults(mapped);
      }
    } catch (e) { console.log(e); }
    setLoading(false);
  };

  const searchAll = useCallback(async (q: string, key: string) => {
    if (!q.trim()) { loadDiscover(key); return; }
    setLoading(true);
    try {
      if (!key) {
        setResults(prev => prev.filter(m => m.title.toLowerCase().includes(q.toLowerCase())));
      } else {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encodeURIComponent(q)}`);
        const data = await res.json();
        const mapped: Media[] = (data.results || []).filter((x: any) => x.media_type !== 'person').slice(0, 30).map((m: any) => ({
          id: String(m.id),
          title: m.title || m.name,
          year: (m.release_date || m.first_air_date || '').slice(0, 4),
          poster: m.poster_path ? IMG_BASE + m.poster_path : undefined,
          type: m.media_type === 'tv' ? 'tv' : 'movie',
          overview: m.overview,
          vote: m.vote_average
        }));
        setResults(mapped);
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  const loadByType = async (t: string) => {
    setTab(t as any);
    if (t === 'favs') { setResults(favs); return; }
    if (!apiKey && t !== 'anime') { loadDiscover(''); return; }
    setLoading(true);
    try {
      if (t === 'anime') {
        const gql = await fetch('https://graphql.anilist.co', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `{ Page(perPage:20){ media(type:ANIME, sort:POPULARITY_DESC){ id title{english romaji} coverImage{large} startDate{year} averageScore description } } }` })
        });
        const d = await gql.json();
        const mapped: Media[] = (d.data?.Page?.media || []).map((m: any) => ({
          id: 'ani_' + m.id, title: m.title.english || m.title.romaji, year: String(m.startDate.year || ''), poster: m.coverImage.large, type: 'anime' as const, overview: m.description?.replace(/<[^>]*>/g, '').slice(0, 200), vote: m.averageScore ? m.averageScore / 10 : undefined
        }));
        setResults(mapped);
        setLoading(false);
        return;
      }
      let url = '';
      if (t === 'movies') url = `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}`;
      if (t === 'series') url = `https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}`;
      if (t === 'discover') { loadDiscover(apiKey); return; }
      if (url) {
        const res = await fetch(url);
        const data = await res.json();
        const mapped: Media[] = (data.results || []).map((m: any) => ({
          id: String(m.id), title: m.title || m.name, year: (m.release_date || m.first_air_date || '').slice(0, 4), poster: m.poster_path ? IMG_BASE + m.poster_path : undefined, type: t === 'movies' ? 'movie' : 'tv', overview: m.overview, vote: m.vote_average
        }));
        setResults(mapped);
      }
    } catch (e) {}
    setLoading(false);
  };

  const toggleFav = (m: Media) => {
    const exists = favs.find(x => x.id === m.id);
    const next = exists ? favs.filter(x => x.id !== m.id) : [m, ...favs];
    saveFavs(next);
  };

  const renderItem = ({ item }: { item: Media }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
      <Image source={{ uri: item.poster || 'https://via.placeholder.com/300x450' }} style={styles.poster} />
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardMeta}>{item.year} • {item.type.toUpperCase()} {item.vote ? `★ ${item.vote.toFixed(1)}` : ''}</Text>
      </View>
      <TouchableOpacity onPress={() => toggleFav(item)} style={styles.favBtn}>
        <Text style={{ color: favs.find(x => x.id === item.id) ? '#ff3040' : '#8a94a8' }}>{favs.find(x => x.id === item.id) ? '♥' : '♡'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0e14" />
      <View style={styles.header}>
        <Text style={styles.logo}>STATIC <Text style={{ color: '#00e676' }}>HUB</Text></Text>
        <TouchableOpacity onPress={() => { setTempKey(apiKey); setShowSettings(true); }} style={styles.settingsBtn}>
          <Text style={styles.settingsText}>⚙</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>Movies · Series · Anime</Text>
      <View style={styles.searchBox}>
        <Text style={{ color: '#8a94a8' }}>🔍</Text>
        <TextInput value={query} onChangeText={t => { setQuery(t); searchAll(t, apiKey); }} placeholder="Smart search across catalogues..." placeholderTextColor="#8a94a8" style={styles.searchInput} />
      </View>
      <View style={styles.tabs}>
        {[{ k: 'discover', l: 'For You' }, { k: 'movies', l: 'Movies' }, { k: 'series', l: 'Series' }, { k: 'anime', l: 'Anime' }, { k: 'favs', l: `Favs (${favs.length})` }].map(t => (
          <TouchableOpacity key={t.k} onPress={() => loadByType(t.k)} style={[styles.tab, tab === t.k && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t.k && styles.tabTextOn]}>{t.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList data={results} keyExtractor={i => i.id} renderItem={renderItem} numColumns={2} columnWrapperStyle={{ gap: 12 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} ListEmptyComponent={<Text style={{ color: '#8a94a8', textAlign: 'center', marginTop: 40 }}>{loading ? 'Loading...' : 'No titles. Add TMDB key in settings.'}</Text>} />

      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalRoot}>
          <View style={styles.modalBox}>
            <ScrollView>
              {selected && (<>
                <Image source={{ uri: selected.poster }} style={{ width: '100%', height: 320, borderRadius: 12 }} />
                <Text style={styles.modalTitle}>{selected.title}</Text>
                <Text style={styles.modalMeta}>{selected.year} • {selected.type} {selected.vote ? `• ★ ${selected.vote.toFixed(1)}` : ''}</Text>
                <Text style={styles.modalOverview}>{selected.overview || 'Open official page for trailer and where to watch.'}</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => Linking.openURL(`https://www.themoviedb.org/${selected.type === 'tv' ? 'tv' : 'movie'}/${selected.id.replace('ani_', '')}`)}>
                  <Text style={styles.primaryText}>View Trailer & Legal Options</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secBtn} onPress={() => { if (selected) toggleFav(selected); }}>
                  <Text style={styles.secText}>{favs.find(x => x.id === selected.id) ? 'Remove from Favourites' : 'Add to Favourites ♥'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelected(null)} style={[styles.secBtn, { marginBottom: 20 }]}><Text style={styles.secText}>Close</Text></TouchableOpacity>
              </>)}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showSettings} animationType="fade" transparent>
        <View style={styles.modalRoot}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Safer API Setup</Text>
            <Text style={styles.modalMeta}>TMDB key stored only on phone. Never hardcode in GitHub.</Text>
            <TextInput value={tempKey} onChangeText={setTempKey} placeholder="Paste TMDB API Key v3" placeholderTextColor="#8a94a8" style={[styles.searchBox, { marginTop: 12 }]} />
            <Text style={{ color: '#8a94a8', fontSize: 11, marginTop: 8 }}>Get free key: themoviedb.org → Settings → API. Anime uses AniList (no key).</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={async () => { await AsyncStorage.setItem(TMDB_KEY_STORAGE, tempKey); setApiKey(tempKey); setShowSettings(false); loadDiscover(tempKey); Alert.alert('Saved', 'API key saved locally'); }}>
              <Text style={styles.primaryText}>Save Key</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSettings(false)} style={styles.secBtn}><Text style={styles.secText}>Cancel</Text></TouchableOpacity>
            <Text style={{ color: '#8a94a8', fontSize: 10, marginTop: 12, textAlign: 'center' }}>Static Hub does not host films. Discovers via TMDB/AniList and links to official sources.</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0e14' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 4 },
  logo: { color: '#fff', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#8a94a8', fontSize: 12, paddingHorizontal: 16, marginBottom: 8 },
  settingsBtn: { backgroundColor: '#151b2a', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  settingsText: { color: '#fff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#151b2a', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: '#1f2a44' },
  searchInput: { flex: 1, color: '#fff' },
  tabs: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#151b2a', borderRadius: 20, borderWidth: 1, borderColor: '#1f2a44' },
  tabOn: { backgroundColor: '#fff', borderColor: '#fff' },
  tabText: { color: '#8a94a8', fontSize: 12, fontWeight: '600' },
  tabTextOn: { color: '#000', fontWeight: '800' },
  card: { flex: 1, backgroundColor: '#151b2a', borderRadius: 12, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: '#1f2a44' },
  poster: { width: '100%', height: 210, backgroundColor: '#0b0e14' },
  cardInfo: { padding: 8 },
  cardTitle: { color: '#fff', fontSize: 12, fontWeight: '800' },
  cardMeta: { color: '#8a94a8', fontSize: 10, marginTop: 2 },
  favBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#151b2a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '85%', borderWidth: 1, borderColor: '#1f2a44' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 12 },
  modalMeta: { color: '#8a94a8', fontSize: 12, marginTop: 4 },
  modalOverview: { color: '#cbd5e1', fontSize: 13, marginTop: 10, lineHeight: 18 },
  primaryBtn: { backgroundColor: '#00e676', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#000', fontWeight: '900' },
  secBtn: { backgroundColor: '#0b0e14', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#1f2a44' },
  secText: { color: '#fff', fontWeight: '700' },
});
