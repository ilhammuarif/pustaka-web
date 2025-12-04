import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, PenTool, Home, Image as ImageIcon, Save, ArrowLeft, PlusCircle, User, X, Info, UploadCloud, Edit, Trash2, List, ChevronRight, ChevronLeft, Link as LinkIcon, AlertCircle, Eye, FileText, AlertTriangle, Settings, LogOut, Lock, Mail, Key, Loader2, Search, Filter, MessageCircle, Send, Heart, Type, ChevronDown, ChevronUp } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCustomToken } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, setDoc, getDoc, where, arrayUnion, arrayRemove, increment } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// --- 1. KONFIGURASI FIREBASE (Milik Ilham - WebNovelKuu) ---
const firebaseConfig = {
  apiKey: "AIzaSyBnc9NMHH4bQdfBm4E1EIKmCbhCvX23yEA",
  authDomain: "webnovelkuu.firebaseapp.com",
  projectId: "webnovelkuu",
  storageBucket: "webnovelkuu.firebasestorage.app",
  messagingSenderId: "758683527144",
  appId: "1:758683527144:web:069e6ef93b87158ef9265d"
};

// --- KODE RAHASIA PENDAFTARAN ---
const SECRET_CODE = "VIP-ILHAM"; 

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const appId = 'pustaka-utama'; 

const GENRES = ["Semua", "Aksi", "Petualangan", "Romantis", "Horor", "Fantasi", "Sci-Fi", "Drama", "Komedi", "Misteri", "Slice of Life", "Isekai"];

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState({ name: '', photoUrl: '' });
  
  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regCode, setRegCode] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // App State
  const [view, setView] = useState('home'); 
  const [stories, setStories] = useState([]);
  const [currentStory, setCurrentStory] = useState(null);
  const [isLoadingStories, setIsLoadingStories] = useState(true);
  
  // Comments State
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenreFilter, setSelectedGenreFilter] = useState('Semua');
  
  // Forms
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState(''); 
  const [coverUrl, setCoverUrl] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState([]); 
  
  // Chapter Form
  const [chapters, setChapters] = useState([]); 
  const [activeChapterIndex, setActiveChapterIndex] = useState(null); 
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterContent, setChapterContent] = useState('');
  const [writeMode, setWriteMode] = useState('edit');

  // Reader Settings
  const [fontSize, setFontSize] = useState(16);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false); // BARU: State untuk expand sinopsis

  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Modal
  const [showImageModal, setShowImageModal] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imageModalMode, setImageModalMode] = useState('content'); 
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Fix Scroll & History
  useEffect(() => { window.scrollTo(0, 0); }, [view, activeChapterIndex]);
  useEffect(() => {
    const handlePopState = () => {
      if (activeChapterIndex !== null) setActiveChapterIndex(null);
      else if (view !== 'home') { setView('home'); setCurrentStory(null); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, activeChapterIndex]);
  const pushHistory = () => window.history.pushState(null, "", window.location.href);

  // --- AUTH INIT ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch (e) {}
      }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'info');
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) setUserProfile(userDoc.data());
        else setUserProfile({ name: '', photoUrl: '' });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault(); setAuthError(''); setAuthLoading(true);
    try {
        if (isRegistering) {
            if (regCode.trim() !== SECRET_CODE) throw new Error("kode-salah");
            await createUserWithEmailAndPassword(auth, email, password);
            showNotification("Akun berhasil dibuat!");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            showNotification("Berhasil masuk.");
        }
    } catch (error) {
        let msg = "Gagal.";
        if (error.message === "kode-salah") msg = "Kode Pendaftaran SALAH!";
        else if (error.code === 'auth/invalid-credential') msg = "Email/Password salah.";
        setAuthError(msg);
    } finally { setAuthLoading(false); }
  };
  const handleLogout = async () => { await signOut(auth); setView('home'); };

  // --- DATA LISTENER ---
  useEffect(() => {
    setIsLoadingStories(true);
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'stories'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStories(snapshot.docs.map(doc => ({
        id: doc.id, ...doc.data(),
        chapters: doc.data().chapters || [{ title: "Bagian Utama", content: doc.data().content }]
      })));
      setIsLoadingStories(false);
    }, () => setIsLoadingStories(false));
    return () => unsubscribe();
  }, []);

  // --- KOMENTAR LISTENER ---
  useEffect(() => {
    if (view === 'read' && currentStory) {
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'comments'),
            where('storyId', '==', currentStory.id)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            loadedComments.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.seconds : 0;
                const dateB = b.createdAt ? b.createdAt.seconds : 0;
                return dateB - dateA;
            });
            setComments(loadedComments);
        });
        return () => unsubscribe();
    }
  }, [view, currentStory]);

  // --- ACTIONS ---
  const handleSendComment = async () => {
      if (!user) { showNotification("Login dulu untuk komentar!"); return; }
      if (!newComment.trim()) return;

      setIsSendingComment(true);
      try {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'comments'), {
              storyId: currentStory.id,
              userId: user.uid,
              userName: userProfile.name || 'Anonim',
              userPhoto: userProfile.photoUrl || '',
              content: newComment,
              createdAt: serverTimestamp()
          });
          setNewComment('');
          showNotification("Komentar terkirim!");
      } catch (e) { showNotification("Gagal kirim komentar."); }
      finally { setIsSendingComment(false); }
  };

  const handleSaveProfile = async () => {
    if (!user) return; setIsSaving(true);
    try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), { name: userProfile.name, photoUrl: userProfile.photoUrl || '' });
        showNotification("Profil tersimpan!");
    } catch { showNotification("Gagal."); } finally { setIsSaving(false); }
  };

  const startEditing = (story) => {
    pushHistory(); setEditingId(story.id); setTitle(story.title);
    setAuthorName(story.authorName || userProfile.name || ''); setCoverUrl(story.coverUrl);
    setSynopsis(story.synopsis); setChapters(story.chapters || []);
    setGenre(Array.isArray(story.genre) ? story.genre : (story.genre ? [story.genre] : []));
    setActiveChapterIndex(null); setView('write');
  };

  const startWritingNew = () => { pushHistory(); resetForm(); if(userProfile.name) setAuthorName(userProfile.name); setView('write'); };

  const handleToggleLike = async (e, story) => {
      e.stopPropagation();
      if (!user) { showNotification("Login dulu untuk like!"); return; }
      const storyRef = doc(db, 'artifacts', appId, 'public', 'data', 'stories', story.id);
      const isLiked = story.likes && story.likes.includes(user.uid);
      try {
          if (isLiked) await updateDoc(storyRef, { likes: arrayRemove(user.uid) });
          else { await updateDoc(storyRef, { likes: arrayUnion(user.uid) }); showNotification("Kamu menyukai cerita ini ❤️"); }
      } catch (e) { console.error(e); }
  };

  const closeConfirmModal = () => setConfirmModal({ ...confirmModal, isOpen: false });
  const handleDeleteStory = (e, id) => {
    e.stopPropagation();
    setConfirmModal({ isOpen: true, title: 'Hapus Novel', message: 'Hapus permanen?', onConfirm: async () => {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stories', id));
        if (view === 'read') setView('home');
        closeConfirmModal();
    }});
  };

  const handlePublish = async () => {
    if (!title || chapters.length === 0) { showNotification("Judul & min 1 Bab wajib!"); return; }
    if (genre.length === 0) { showNotification("Pilih genre!"); return; }
    setIsSaving(true);
    try {
      const data = { title, authorName: authorName || 'Anonim', coverUrl, synopsis, genre, chapters, authorId: user.uid, updatedAt: serverTimestamp() };
      if (editingId) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stories', editingId), data);
      else { data.createdAt = serverTimestamp(); data.likes = []; await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'stories'), data); }
      resetForm(); setView('home'); showNotification(editingId ? "Terupdate!" : "Terbit!");
    } catch { showNotification("Gagal."); } finally { setIsSaving(false); }
  };

  const handleUpload = async () => {
    if (imageFile) {
        setIsUploading(true);
        try {
            const snap = await uploadBytes(ref(storage, `images/${Date.now()}_${imageFile.name}`), imageFile);
            const url = await getDownloadURL(snap.ref);
            applyImage(url);
        } catch { showNotification("Gagal upload."); } finally { setIsUploading(false); }
    } else if (tempImageUrl) applyImage(tempImageUrl);
  };

  const applyImage = (url) => {
    if (imageModalMode === 'cover') setCoverUrl(url);
    else if (imageModalMode === 'profile') setUserProfile(p => ({ ...p, photoUrl: url }));
    else setChapterContent(p => p + `\n\n[GAMBAR: ${url}]\n\n`);
    setShowImageModal(false); setTempImageUrl(''); setImageFile(null);
  };

  // Helpers
  const showNotification = (m) => { setNotification(m); setTimeout(() => setNotification(''), 3000); };
  const resetForm = () => { setTitle(''); setAuthorName(''); setCoverUrl(''); setSynopsis(''); setGenre([]); setChapters([]); setActiveChapterIndex(null); setEditingId(null); setIsSynopsisExpanded(false); };
  const toggleGenre = (g) => setGenre(p => p.includes(g) ? p.filter(i => i !== g) : (p.length >= 4 ? p : [...p, g]));
  
  const filteredStories = stories.filter(s => {
    const matchSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || (s.authorName && s.authorName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchGenre = selectedGenreFilter === 'Semua' || (Array.isArray(s.genre) ? s.genre.includes(selectedGenreFilter) : s.genre === selectedGenreFilter);
    return matchSearch && matchGenre;
  });

  const renderContent = (text) => text?.split('\n').map((l, i) => {
      const m = l.match(/\[GAMBAR:\s*(.*?)\]/);
      if (m) return <div key={i} className="my-6 flex justify-center"><img src={m[1]} className="max-w-full rounded shadow" onError={e=>e.target.style.display='none'}/></div>;
      return l.trim() ? <p key={i} className="mb-3 leading-relaxed text-gray-800 indent-0 sm:indent-6 text-justify" style={{fontSize: `${fontSize}px`}}>{l}</p> : <div key={i} className="h-4"></div>;
  });

  // --- UI ---
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-10">
      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div onClick={() => { resetForm(); setView('home'); }} className="flex items-center gap-2 cursor-pointer hover:opacity-80">
            <BookOpen className="text-orange-600" size={28} /><span className="font-bold text-lg sm:text-xl tracking-tight text-gray-800">Novel<span className="text-orange-600">in</span></span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { resetForm(); setView('home'); }} className={`p-2 rounded-full transition ${view === 'home' ? 'bg-orange-100 text-orange-600' : 'text-gray-500 hover:bg-gray-100'}`}><Home size={22} /></button>
            {user ? (
                <button onClick={() => { pushHistory(); resetForm(); setView('profile'); }} className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full border hover:bg-gray-100">
                    {userProfile.photoUrl ? <img src={userProfile.photoUrl} className="w-6 h-6 rounded-full object-cover" /> : <User size={20} />}
                    <span className="text-sm font-medium hidden sm:inline truncate max-w-[100px]">{userProfile.name || 'Penulis'}</span>
                </button>
            ) : <button onClick={() => { pushHistory(); setView('login'); }} className="px-3 py-2 bg-orange-600 text-white rounded-full text-xs font-bold hover:bg-orange-700">Masuk</button>}
          </div>
        </div>
      </nav>

      {notification && <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-3 rounded-full shadow-lg z-[60] text-sm animate-bounce">{notification}</div>}

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {view === 'home' && (
          <div className="animate-fade-in">
             <div className="mb-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
               <div className="relative z-10"><h1 className="text-2xl font-bold mb-2">Selamat Datang di Novelin</h1><p className="opacity-90 text-sm mb-4">Platform baca tulis novel gratis untuk komunitas kita.</p>
               {user ? <div className="flex gap-2"><button onClick={startWritingNew} className="bg-white text-orange-600 px-4 py-2 rounded-full font-bold text-sm">Tulis Cerita</button></div> : <button onClick={() => setView('login')} className="bg-white text-orange-600 px-4 py-2 rounded-full font-bold text-sm">Masuk untuk Menulis</button>}
               </div><BookOpen size={150} className="absolute -right-6 -bottom-8 text-white opacity-10 rotate-12" />
            </div>

            <div className="flex gap-2 mb-6">
                <div className="relative flex-1"><Search className="absolute left-3 top-3 text-gray-400" size={18} /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari..." className="w-full pl-10 p-2.5 border rounded-lg text-sm outline-none focus:border-orange-500" /></div>
                <div className="relative w-32"><Filter className="absolute left-3 top-3 text-gray-400" size={18} /><select value={selectedGenreFilter} onChange={(e) => setSelectedGenreFilter(e.target.value)} className="w-full pl-9 p-2.5 border rounded-lg text-sm bg-white appearance-none outline-none focus:border-orange-500">{GENRES.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
            </div>

            {isLoadingStories ? <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-orange-500"/></div> : 
             filteredStories.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">Tidak ada novel.</div> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredStories.map(story => {
                    const isLiked = user && story.likes && story.likes.includes(user.uid);
                    return (
                    <div key={story.id} onClick={() => { pushHistory(); setCurrentStory(story); setActiveChapterIndex(null); setView('read'); }} className="group cursor-pointer relative">
                      <div className="aspect-[2/3] bg-gray-200 rounded-lg overflow-hidden shadow mb-2 relative">
                         <img src={story.coverUrl} className="w-full h-full object-contain" onError={(e) => {e.target.src = 'https://placehold.co/400x600?text=No+Cover'}} />
                         <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">{story.chapters.length} Bab</div>
                         <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[90%]">{ (Array.isArray(story.genre) ? story.genre : [story.genre]).filter(Boolean).slice(0, 4).map((g,i) => <span key={i} className="bg-orange-500/90 text-white text-[8px] px-1 rounded">{g}</span>)}</div>
                         {/* Like Indicator */}
                         <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm cursor-pointer hover:bg-black/60" onClick={(e) => handleToggleLike(e, story)}>
                             <Heart size={10} className={isLiked ? "fill-red-500 text-red-500" : "text-white"} /> <span>{story.likes ? story.likes.length : 0}</span>
                         </div>
                      </div>
                      <h3 className="font-bold text-sm text-gray-800 line-clamp-2 leading-tight">{story.title}</h3>
                      <p className="text-[10px] text-gray-500 truncate">{story.authorName}</p>
                    </div>
                  )})}
                </div>
            )}
          </div>
        )}

        {/* View Read dengan Komentar */}
        {view === 'read' && currentStory && (
          <div className="animate-fade-in pb-20">
            <div className="flex justify-between items-center mb-4 sticky top-16 z-30 bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm border border-gray-100">
                <button onClick={() => { if(activeChapterIndex!==null) {pushHistory(); setActiveChapterIndex(null)} else {resetForm(); setView('home')} }} className="flex items-center gap-1 text-sm font-medium text-gray-600"><ArrowLeft size={16}/> {activeChapterIndex!==null ? 'Daftar' : 'Home'}</button>
                <div className="flex items-center gap-2">
                     {activeChapterIndex !== null && (
                         <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                             <Type size={14} className="text-gray-500"/>
                             <input type="range" min="12" max="24" value={fontSize} onChange={(e)=>setFontSize(e.target.value)} className="w-16 accent-orange-600 h-1" />
                         </div>
                     )}
                     {user?.uid === currentStory.authorId && <div className="flex gap-2"><button onClick={(e) => handleDeleteStory(e, currentStory.id)}><Trash2 size={16} className="text-red-500"/></button><button onClick={() => startEditing(currentStory)}><Edit size={16} className="text-orange-500"/></button></div>}
                </div>
            </div>

            {activeChapterIndex === null ? (
              <div className="max-w-2xl mx-auto">
                  <div className="flex gap-4 mb-6">
                      <img src={currentStory.coverUrl} className="w-28 h-40 object-cover rounded-lg shadow-md shrink-0" onError={(e) => e.target.src='https://placehold.co/400'} />
                      <div className="flex-1">
                          <h1 className="text-xl font-bold leading-tight mb-1">{currentStory.title}</h1>
                          <div className="text-xs text-gray-500 mb-2 flex items-center gap-2"><User size={12}/> {currentStory.authorName}</div>
                          <div className="flex flex-wrap gap-1 mb-2">{(Array.isArray(currentStory.genre) ? currentStory.genre : [currentStory.genre]).map(g=><span key={g} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600">{g}</span>)}</div>
                          
                          {/* SINOPSIS DENGAN TOGGLE (BARU) */}
                          <div className="relative">
                            <p className={`text-sm text-gray-700 leading-relaxed ${isSynopsisExpanded ? '' : 'line-clamp-3'}`}>
                                {currentStory.synopsis}
                            </p>
                            {currentStory.synopsis && currentStory.synopsis.length > 150 && (
                                <button 
                                    onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)} 
                                    className="flex items-center gap-1 text-xs text-orange-600 font-medium mt-1 hover:underline"
                                >
                                    {isSynopsisExpanded ? <><ChevronUp size={12}/> Tutup</> : <><ChevronDown size={12}/> Baca Selengkapnya</>}
                                </button>
                            )}
                          </div>

                      </div>
                  </div>
                  <div className="bg-white border rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b text-sm font-bold text-gray-600">Daftar Bab ({currentStory.chapters.length})</div>
                      <div className="divide-y">{currentStory.chapters.map((c,i) => <div key={i} onClick={()=>{pushHistory(); setActiveChapterIndex(i)}} className="p-3 hover:bg-orange-50 cursor-pointer flex justify-between items-center text-sm"><span><span className="font-bold text-orange-600 mr-2">BAB {i+1}</span> {c.title}</span><ChevronRight size={16} className="text-gray-300"/></div>)}</div>
                  </div>
                  
                  {/* KOLOM KOMENTAR */}
                  <div className="mt-8">
                      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><MessageCircle size={18}/> Komentar Pembaca</h3>
                      
                      {/* Form Komentar */}
                      <div className="flex gap-2 mb-6">
                          {user ? (
                              <>
                                <input 
                                    type="text" 
                                    value={newComment} 
                                    onChange={(e)=>setNewComment(e.target.value)} 
                                    placeholder="Tulis tanggapanmu..." 
                                    className="flex-1 border rounded-full px-4 py-2 text-sm focus:border-orange-500 outline-none"
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendComment()}
                                />
                                <button onClick={handleSendComment} disabled={isSendingComment || !newComment.trim()} className="bg-orange-600 text-white p-2 rounded-full hover:bg-orange-700 disabled:opacity-50"><Send size={18}/></button>
                              </>
                          ) : (
                              <div className="w-full text-center p-3 bg-gray-50 rounded-lg text-sm text-gray-500 cursor-pointer hover:bg-gray-100" onClick={()=>setView('login')}>Login untuk berkomentar</div>
                          )}
                      </div>

                      {/* List Komentar */}
                      <div className="space-y-4">
                          {comments.length === 0 ? <p className="text-center text-gray-400 text-xs italic">Belum ada komentar. Jadilah yang pertama!</p> : comments.map(c => (
                              <div key={c.id} className="flex gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0"><img src={c.userPhoto || 'https://placehold.co/100'} className="w-full h-full object-cover"/></div>
                                  <div className="bg-gray-50 p-3 rounded-lg rounded-tl-none flex-1">
                                      <div className="flex justify-between items-start mb-1">
                                          <span className="text-xs font-bold text-gray-700">{c.userName}</span>
                                          <span className="text-[10px] text-gray-400">{c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleDateString() : 'Baru saja'}</span>
                                      </div>
                                      <p className="text-sm text-gray-600">{c.content}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                  <div className="text-center mb-8"><h2 className="text-xs font-bold text-orange-600 tracking-widest uppercase mb-1">Bab {activeChapterIndex + 1}</h2><h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 leading-tight">{currentStory.chapters[activeChapterIndex].title}</h1></div>
                  <article className="font-serif leading-relaxed text-gray-800 px-2 text-justify">{renderContent(currentStory.chapters[activeChapterIndex].content)}</article>
                  <div className="flex justify-between mt-10 pt-6 border-t">
                      <button disabled={activeChapterIndex===0} onClick={()=>{window.scrollTo(0,0); setActiveChapterIndex(p=>p-1)}} className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-orange-600 disabled:opacity-30"><ChevronLeft size={16}/> Sebelumnya</button>
                      <button disabled={activeChapterIndex===currentStory.chapters.length-1} onClick={()=>{window.scrollTo(0,0); setActiveChapterIndex(p=>p+1)}} className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-orange-600 disabled:opacity-30">Selanjutnya <ChevronRight size={16}/></button>
                  </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: LOGIN/REGISTER - DIPERBAIKI SESUAI SCREENSHOT LAMA */}
        {view === 'login' && (
            <div className="flex items-center justify-center py-10 animate-fade-in">
                <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-gray-100">
                    <div className="text-center mb-8">
                        <BookOpen className="text-orange-600 mx-auto mb-3" size={40} />
                        <h2 className="text-2xl font-bold text-gray-800">{isRegistering ? 'Buat Akun Baru' : 'Masuk ke Pustaka'}</h2>
                        <p className="text-gray-500 text-sm mt-2">Bergabunglah untuk mulai berkarya.</p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" 
                                    placeholder="contoh@email.com"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                                <input 
                                    type="password" 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" 
                                    placeholder="******"
                                />
                            </div>
                        </div>

                        {isRegistering && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kode Pendaftaran (Wajib)</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <input 
                                        type="text" 
                                        required
                                        value={regCode}
                                        onChange={(e) => setRegCode(e.target.value)}
                                        className="w-full pl-10 p-2.5 border-2 border-orange-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-orange-50" 
                                        placeholder="Kode Rahasia dari Admin"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 italic">*Hanya yang punya kode ini yang bisa daftar.</p>
                            </div>
                        )}

                        {authError && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                                <AlertCircle size={16} /> {authError}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={authLoading}
                            className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-bold hover:bg-orange-700 transition shadow-lg disabled:opacity-50"
                        >
                            {authLoading ? 'Memproses...' : (isRegistering ? 'Daftar Akun Baru' : 'Masuk Sekarang')}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <p className="text-gray-600">
                            {isRegistering ? 'Sudah punya akun?' : 'Belum punya akun?'}
                            <button 
                                onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
                                className="ml-1 text-orange-600 font-bold hover:underline"
                            >
                                {isRegistering ? 'Login di sini' : 'Daftar di sini'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        )}

        {view === 'profile' && user && (
            <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow text-center">
                <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-3 overflow-hidden cursor-pointer" onClick={()=>openImageModal('profile')}><img src={userProfile.photoUrl||'https://placehold.co/100'} className="w-full h-full object-cover"/></div>
                <input value={userProfile.name} onChange={e=>setUserProfile({...userProfile, name:e.target.value})} className="text-center font-bold border-b focus:border-orange-500 outline-none w-full mb-4" placeholder="Nama Pena"/>
                <button onClick={handleSaveProfile} disabled={isSaving} className="w-full bg-gray-800 text-white py-2 rounded text-sm font-bold mb-2">Simpan Profil</button>
                <button onClick={handleLogout} className="w-full border text-red-500 py-2 rounded text-sm">Keluar</button>
            </div>
        )}

        {view === 'write' && ( /* Kode Write sama dengan sebelumnya, hanya disingkat agar muat */ 
            <div className="max-w-3xl mx-auto">
                <h2 className="font-bold text-xl mb-4 flex gap-2"><PenTool/> {editingId?'Edit':'Tulis'}</h2>
                {activeChapterIndex===null ? (
                    <div className="bg-white p-4 rounded shadow space-y-3">
                        <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full p-2 border rounded font-bold" placeholder="Judul"/>
                        <div className="flex gap-2">
                             <select 
                                value="" 
                                onChange={e => {
                                    const val = e.target.value;
                                    setGenre(prev => {
                                        const current = Array.isArray(prev) ? prev : [];
                                        if (current.includes(val)) return current;
                                        if (current.length >= 4) { showNotification("Maksimal 4 genre!"); return current; }
                                        return [...current, val];
                                    });
                                }} 
                                className="p-2 border rounded text-sm w-1/2"
                             >
                                <option value="" disabled>+ Tambah Genre</option>
                                {GENRES.filter(g=>g!=='Semua').map(g=><option key={g} value={g} disabled={genre.includes(g)}>{g}</option>)}
                             </select>
                             <div className="flex flex-wrap gap-1 items-center">{Array.isArray(genre)&&genre.map(g=><span key={g} onClick={()=>setGenre(prev=>prev.filter(i=>i!==g))} className="text-[10px] bg-orange-100 px-2 rounded cursor-pointer hover:bg-red-100">{g} &times;</span>)}</div>
                        </div>
                        <div className="flex gap-2"><div onClick={()=>openImageModal('cover')} className="w-20 h-28 bg-gray-100 border cursor-pointer flex items-center justify-center">{coverUrl?<img src={coverUrl} className="w-full h-full object-cover"/>:<UploadCloud/>}</div><textarea value={synopsis} onChange={e=>setSynopsis(e.target.value)} className="flex-1 p-2 border rounded" placeholder="Sinopsis"/></div>
                        <div className="border-t pt-2 mt-2"><div className="font-bold text-sm mb-2">Daftar Bab ({chapters.length})</div><button onClick={()=>setActiveChapterIndex('new')} className="text-xs bg-orange-100 text-orange-600 px-3 py-1 rounded mb-2">+ Tambah Bab</button>{chapters.map((c,i)=><div key={i} className="flex justify-between p-2 border text-sm"><span>{c.title}</span><div className="flex gap-2"><button onClick={()=>{setActiveChapterIndex(i); setChapterTitle(c.title); setChapterContent(c.content)}} className="text-blue-500"><Edit size={14}/></button><button onClick={()=>handleDeleteChapter(i)} className="text-red-500"><Trash2 size={14}/></button></div></div>)}</div>
                        <button onClick={handlePublish} disabled={isSaving} className="w-full bg-orange-600 text-white py-2 rounded font-bold mt-4">Simpan / Terbit</button>
                    </div>
                ) : (
                    <div className="bg-white p-4 rounded shadow h-[70vh] flex flex-col">
                        <input value={chapterTitle} onChange={e=>setChapterTitle(e.target.value)} className="w-full p-2 border rounded mb-2 font-bold" placeholder="Judul Bab"/>
                        <div className="flex gap-2 mb-2"><button onClick={()=>openImageModal('content')} className="text-xs bg-gray-100 px-2 py-1 rounded flex gap-1"><ImageIcon size={12}/> Gambar</button></div>
                        <textarea value={chapterContent} onChange={e=>setChapterContent(e.target.value)} className="flex-1 w-full p-2 border rounded resize-none" placeholder="Isi cerita..."/>
                        <div className="flex gap-2 mt-2 justify-end"><button onClick={()=>setActiveChapterIndex(null)} className="px-4 py-1 border rounded">Batal</button><button onClick={handleSaveChapterToLocal} className="px-4 py-1 bg-green-600 text-white rounded">Simpan Bab</button></div>
                    </div>
                )}
            </div>
        )}

        {/* Modal Gambar & Konfirmasi (Tetap sama) */}
        {showImageModal && <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"><div className="bg-white p-4 rounded w-full max-w-sm"><h3 className="font-bold mb-2">Upload Gambar</h3><input type="file" onChange={e=>setImageFile(e.target.files[0])} className="text-sm mb-2"/><p className="text-center text-xs my-2">- atau link -</p><input value={tempImageUrl} onChange={e=>setTempImageUrl(e.target.value)} className="w-full border p-1 rounded mb-2 text-sm" placeholder="https://..."/><div className="flex justify-end gap-2"><button onClick={()=>setShowImageModal(false)} className="px-3 py-1 border rounded text-sm">Batal</button><button onClick={handleUpload} disabled={isUploading} className="px-3 py-1 bg-orange-600 text-white rounded text-sm">{isUploading?'...':'Simpan'}</button></div></div></div>}
        {confirmModal.isOpen && <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"><div className="bg-white p-4 rounded text-center"><h3 className="font-bold mb-1">{confirmModal.title}</h3><p className="text-sm text-gray-500 mb-4">{confirmModal.message}</p><div className="flex gap-2 justify-center"><button onClick={closeConfirmModal} className="px-4 py-1 border rounded">Batal</button><button onClick={confirmModal.onConfirm} className="px-4 py-1 bg-red-600 text-white rounded">Ya</button></div></div></div>}
      </main>
    </div>
  );
}
