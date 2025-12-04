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
  
  // Chapter & Prologue Form
  const [chapters, setChapters] = useState([]); 
  const [prologue, setPrologue] = useState(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(null); 
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterContent, setChapterContent] = useState('');
  const [writeMode, setWriteMode] = useState('edit');

  // Reader Settings
  const [fontSize, setFontSize] = useState(16);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);

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

  // --- HELPERS & UTILS ---
  const showNotification = (m) => { setNotification(m); setTimeout(() => setNotification(''), 3000); };
  
  const resetForm = () => { 
      setTitle(''); setAuthorName(''); setCoverUrl(''); setSynopsis(''); setGenre([]); 
      setChapters([]); setPrologue(null);
      setActiveChapterIndex(null); setEditingId(null); setIsSynopsisExpanded(false); 
      setChapterTitle(''); setChapterContent(''); 
  };
  
  const pushHistory = () => window.history.pushState(null, "", window.location.href);

  // --- FUNGSI MODAL ---
  const openImageModal = (mode) => {
    setImageModalMode(mode);
    let initialUrl = '';
    if (mode === 'cover') initialUrl = coverUrl;
    else if (mode === 'profile') initialUrl = userProfile.photoUrl;
    setTempImageUrl(initialUrl); 
    setShowImageModal(true);
  };

  // --- EFFECTS ---
  useEffect(() => { window.scrollTo(0, 0); }, [view, activeChapterIndex]);
  
  useEffect(() => {
    const handlePopState = () => {
      if (activeChapterIndex !== null) setActiveChapterIndex(null);
      else if (view !== 'home') { setView('home'); setCurrentStory(null); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, activeChapterIndex]);

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

  // --- HANDLERS ---
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

  const handleSendComment = async () => {
      if (!user) { showNotification("Login dulu!"); return; }
      if (!newComment.trim()) return;
      setIsSendingComment(true);
      try {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'comments'), {
              storyId: currentStory.id, userId: user.uid, userName: userProfile.name || 'Anonim',
              userPhoto: userProfile.photoUrl || '', content: newComment, createdAt: serverTimestamp()
          });
          setNewComment(''); showNotification("Terkirim!");
      } catch (e) { showNotification("Gagal."); } finally { setIsSendingComment(false); }
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
    setPrologue(story.prologue || null);
    setActiveChapterIndex(null); setChapterTitle(''); setChapterContent('');
    setView('write');
  };

  const startWritingNew = () => { pushHistory(); resetForm(); if(userProfile.name) setAuthorName(userProfile.name); setView('write'); };

  const handleToggleLike = async (e, story) => {
      e.stopPropagation();
      if (!user) { showNotification("Login dulu!"); return; }
      const storyRef = doc(db, 'artifacts', appId, 'public', 'data', 'stories', story.id);
      const isLiked = story.likes && story.likes.includes(user.uid);
      try {
          if (isLiked) await updateDoc(storyRef, { likes: arrayRemove(user.uid) });
          else { await updateDoc(storyRef, { likes: arrayUnion(user.uid) }); showNotification("Disukai ❤️"); }
      } catch (e) {}
  };

  const closeConfirmModal = () => setConfirmModal({ ...confirmModal, isOpen: false });
  const handleDeleteStory = (e, id) => {
    e.stopPropagation();
    setConfirmModal({ isOpen: true, title: 'Hapus Novel', message: 'Hapus permanen?', onConfirm: async () => {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stories', id));
        if (view === 'read') setView('home');
        setConfirmModal({...confirmModal, isOpen:false});
    }});
  };

  const handleRemoveCover = (e) => {
    if(e) e.stopPropagation();
    setConfirmModal({ isOpen: true, title: 'Hapus Sampul', message: 'Hapus gambar sampul ini?', onConfirm: () => { setCoverUrl(''); setConfirmModal({...confirmModal, isOpen:false}); }});
  };

  // --- CHAPTER & PROLOG HANDLERS ---
  const handleEditChapter = (index) => {
    const chapter = chapters[index];
    if (!chapter) return;
    setActiveChapterIndex(index);
    setChapterTitle(chapter.title || '');
    setChapterContent(chapter.content || '');
    setWriteMode('edit'); 
  };

  const handleEditPrologue = () => {
      setActiveChapterIndex('prologue');
      setChapterTitle('Prolog'); // Set default untuk internal, tapi tidak ditampilkan di form
      setChapterContent(prologue ? prologue.content : '');
      setWriteMode('edit');
  };

  const handleDeletePrologue = () => {
      setConfirmModal({
        isOpen: true, title: 'Hapus Prolog', message: 'Hapus prolog ini?',
        onConfirm: () => {
          setPrologue(null);
          if (activeChapterIndex === 'prologue') { setActiveChapterIndex(null); setChapterTitle(''); setChapterContent(''); }
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      });
  };

  const handleDeleteChapter = (index) => {
    setConfirmModal({
      isOpen: true, title: 'Hapus Bab', message: 'Hapus bab ini?',
      onConfirm: () => {
        const updatedChapters = chapters.filter((_, i) => i !== index);
        setChapters(updatedChapters);
        if (activeChapterIndex === index) { setActiveChapterIndex(null); setChapterTitle(''); setChapterContent(''); }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSaveChapterToLocal = () => {
    // Validasi Judul hanya jika BUKAN Prolog
    if (activeChapterIndex !== 'prologue' && !chapterTitle) {
         showNotification("Judul Bab wajib diisi!"); return; 
    }
    if (!chapterContent) { showNotification("Isi cerita wajib diisi!"); return; }
    
    if (activeChapterIndex === 'prologue') {
        // Prolog otomatis berjudul "Prolog"
        setPrologue({ title: 'Prolog', content: chapterContent });
    } else {
        const newChapterData = { title: chapterTitle, content: chapterContent };
        const updatedChapters = [...chapters];
        if (activeChapterIndex === 'new') updatedChapters.push(newChapterData);
        else if (typeof activeChapterIndex === 'number') updatedChapters[activeChapterIndex] = newChapterData;
        setChapters(updatedChapters);
    }
    
    setChapterTitle(''); setChapterContent(''); setWriteMode('edit'); setActiveChapterIndex(null); 
  };

  const handlePublish = async () => {
    if (!title || chapters.length === 0) { showNotification("Judul & min 1 Bab wajib!"); return; }
    if (genre.length === 0) { showNotification("Pilih genre!"); return; }
    setIsSaving(true);
    try {
      const data = { 
          title, authorName: authorName || 'Anonim', coverUrl, synopsis, genre, chapters, prologue,
          authorId: user.uid, updatedAt: serverTimestamp() 
      };
      if (editingId) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stories', editingId), data);
      else { data.createdAt = serverTimestamp(); data.likes = []; await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'stories'), data); }
      resetForm(); setView('home'); showNotification(editingId ? "Terupdate!" : "Terbit!");
    } catch { showNotification("Gagal."); } finally { setIsSaving(false); }
  };

  // --- UPLOAD HANDLER ---
  const handleUpload = async () => { /* Logic upload file jika ada */ }; 

  const handleSaveImageLink = () => {
    if (!tempImageUrl) { setShowImageModal(false); return; }
    let finalUrl = tempImageUrl;
    if (tempImageUrl.includes('drive.google.com') || tempImageUrl.includes('docs.google.com')) {
      const idMatch = tempImageUrl.match(/[-\w]{25,}/);
      if (idMatch) {
        finalUrl = `https://drive.google.com/thumbnail?id=${idMatch[0]}&sz=w1200`;
        showNotification("Link Drive dikonversi!");
      }
    }
    if (imageModalMode === 'cover') setCoverUrl(finalUrl);
    else if (imageModalMode === 'profile') setUserProfile(p => ({ ...p, photoUrl: finalUrl }));
    else setChapterContent(p => p + `\n\n[GAMBAR: ${finalUrl}]\n\n`);
    setShowImageModal(false); setTempImageUrl('');
  };

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
                          <div className="relative">
                            <p className={`text-sm text-gray-700 leading-relaxed ${isSynopsisExpanded ? '' : 'line-clamp-3'}`}>{currentStory.synopsis}</p>
                            {currentStory.synopsis && currentStory.synopsis.length > 150 && (
                                <button onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)} className="flex items-center gap-1 text-xs text-orange-600 font-medium mt-1 hover:underline">
                                    {isSynopsisExpanded ? <><ChevronUp size={12}/> Tutup</> : <><ChevronDown size={12}/> Baca Selengkapnya</>}
                                </button>
                            )}
                          </div>
                      </div>
                  </div>
                  <div className="bg-white border rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b text-sm font-bold text-gray-600">Daftar Bab ({currentStory.chapters.length + (currentStory.prologue ? 1 : 0)})</div>
                      <div className="divide-y">
                          {/* PROLOGUE ITEM */}
                          {currentStory.prologue && (
                              <div onClick={()=>{pushHistory(); setActiveChapterIndex('prologue')}} className="p-3 hover:bg-orange-50 cursor-pointer flex justify-between items-center text-sm border-b-4 border-orange-50">
                                  <span className="font-bold text-orange-700">PROLOG</span><ChevronRight size={16} className="text-gray-300"/>
                              </div>
                          )}
                          {/* CHAPTER ITEMS */}
                          {currentStory.chapters.map((c,i) => <div key={i} onClick={()=>{pushHistory(); setActiveChapterIndex(i)}} className="p-3 hover:bg-orange-50 cursor-pointer flex justify-between items-center text-sm"><span><span className="font-bold text-orange-600 mr-2">BAB {i+1}</span> {c.title}</span><ChevronRight size={16} className="text-gray-300"/></div>)}
                      </div>
                  </div>
                  <div className="mt-8">
                      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><MessageCircle size={18}/> Komentar Pembaca</h3>
                      <div className="flex gap-2 mb-6">
                          {user ? (
                              <>
                                <input type="text" value={newComment} onChange={(e)=>setNewComment(e.target.value)} placeholder="Tulis tanggapanmu..." className="flex-1 border rounded-full px-4 py-2 text-sm focus:border-orange-500 outline-none" onKeyPress={(e) => e.key === 'Enter' && handleSendComment()} />
                                <button onClick={handleSendComment} disabled={isSendingComment || !newComment.trim()} className="bg-orange-600 text-white p-2 rounded-full hover:bg-orange-700 disabled:opacity-50"><Send size={18}/></button>
                              </>
                          ) : (<div className="w-full text-center p-3 bg-gray-50 rounded-lg text-sm text-gray-500 cursor-pointer hover:bg-gray-100" onClick={()=>setView('login')}>Login untuk berkomentar</div>)}
                      </div>
                      <div className="space-y-4">
                          {comments.length === 0 ? <p className="text-center text-gray-400 text-xs italic">Belum ada komentar. Jadilah yang pertama!</p> : comments.map(c => (
                              <div key={c.id} className="flex gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0"><img src={c.userPhoto || 'https://placehold.co/100'} className="w-full h-full object-cover"/></div>
                                  <div className="bg-gray-50 p-3 rounded-lg rounded-tl-none flex-1">
                                      <div className="flex justify-between items-start mb-1"><span className="text-xs font-bold text-gray-700">{c.userName}</span><span className="text-[10px] text-gray-400">{c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleDateString() : 'Baru saja'}</span></div>
                                      <p className="text-sm text-gray-600">{c.content}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                  <div className="text-center mb-8">
                      {/* HANYA TAMPILKAN JUDUL BAB JIKA BUKAN PROLOG */}
                      {activeChapterIndex !== 'prologue' && (
                          <h2 className="text-xs font-bold text-orange-600 tracking-widest uppercase mb-1">Bab {activeChapterIndex + 1}</h2>
                      )}
                      <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 leading-tight">
                          {activeChapterIndex === 'prologue' 
                            ? 'Prolog' // JUDUL PROLOG SELALU 'PROLOG'
                            : (currentStory.chapters[activeChapterIndex]?.title || '')}
                      </h1>
                  </div>
                  <article className="font-serif leading-relaxed text-gray-800 px-2 text-justify">{renderContent(activeChapterIndex === 'prologue' ? (currentStory.prologue?.content || '') : (currentStory.chapters[activeChapterIndex]?.content || ''))}</article>
                  <div className="flex justify-between mt-10 pt-6 border-t">
                      <button disabled={activeChapterIndex==='prologue' || (activeChapterIndex===0 && !currentStory.prologue)} onClick={()=>{window.scrollTo(0,0); if(activeChapterIndex===0 && currentStory.prologue) setActiveChapterIndex('prologue'); else setActiveChapterIndex(p=>p-1)}} className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-orange-600 disabled:opacity-30"><ChevronLeft size={16}/> Sebelumnya</button>
                      <button disabled={activeChapterIndex===currentStory.chapters.length-1} onClick={()=>{window.scrollTo(0,0); if(activeChapterIndex==='prologue') setActiveChapterIndex(0); else setActiveChapterIndex(p=>p+1)}} className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-orange-600 disabled:opacity-30">Selanjutnya <ChevronRight size={16}/></button>
                  </div>
              </div>
            )}
          </div>
        )}

        {view === 'login' && (
            <div className="flex items-center justify-center py-10 animate-fade-in">
                <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-gray-100">
                    <div className="text-center mb-8"><BookOpen className="text-orange-600 mx-auto mb-3" size={40} /><h2 className="text-2xl font-bold text-gray-800">{isRegistering ? 'Buat Akun Baru' : 'Masuk ke Pustaka'}</h2><p className="text-gray-500 text-sm mt-2">Bergabunglah untuk mulai berkarya.</p></div>
                    <form onSubmit={handleAuth} className="space-y-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><div className="relative"><Mail className="absolute left-3 top-3 text-gray-400" size={18} /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="contoh@email.com" /></div></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><div className="relative"><Lock className="absolute left-3 top-3 text-gray-400" size={18} /><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="******" /></div></div>
                    {isRegistering && (<div><label className="block text-sm font-medium text-gray-700 mb-1">Kode Pendaftaran (Wajib)</label><div className="relative"><Key className="absolute left-3 top-3 text-gray-400" size={18} /><input type="text" required value={regCode} onChange={(e) => setRegCode(e.target.value)} className="w-full pl-10 p-2.5 border-2 border-orange-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-orange-50" placeholder="Kode Rahasia dari Admin" /></div><p className="text-[10px] text-gray-400 mt-1 italic">*Hanya yang punya kode ini yang bisa daftar.</p></div>)}
                    {authError && (<div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16} /> {authError}</div>)}<button type="submit" disabled={authLoading} className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-bold hover:bg-orange-700 transition shadow-lg disabled:opacity-50">{authLoading ? 'Memproses...' : (isRegistering ? 'Daftar Akun Baru' : 'Masuk Sekarang')}</button></form>
                    <div className="mt-6 text-center text-sm"><p className="text-gray-600">{isRegistering ? 'Sudah punya akun?' : 'Belum punya akun?'}<button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="ml-1 text-orange-600 font-bold hover:underline">{isRegistering ? 'Login di sini' : 'Daftar di sini'}</button></p></div>
                </div>
            </div>
        )}

        {view === 'profile' && user && (
            <div className="animate-fade-in max-w-4xl mx-auto">
                <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2 text-gray-800"><User className="text-orange-600" /> Profil Penulis</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center h-fit">
                        <div className="relative w-24 h-24 mx-auto mb-4"><div className="w-full h-full rounded-full overflow-hidden border-4 border-orange-50 bg-gray-100">{userProfile.photoUrl ? (<img src={userProfile.photoUrl} className="w-full h-full object-cover" alt="Avatar" />) : (<User className="w-full h-full p-4 text-gray-300" />)}</div><button onClick={() => openImageModal('profile')} className="absolute bottom-0 right-0 bg-orange-600 text-white p-1.5 rounded-full hover:bg-orange-700 shadow-sm" title="Ganti Foto"><Edit size={12} /></button></div>
                        <div className="mb-4"><label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Nama Pena</label><input type="text" value={userProfile.name} onChange={(e) => setUserProfile({...userProfile, name: e.target.value})} className="w-full text-center font-bold text-gray-800 border-b border-gray-200 focus:border-orange-500 outline-none pb-1 mt-1" placeholder="Isi Nama Kamu" /></div>
                        <div className="space-y-2"><button onClick={handleSaveProfile} disabled={isSaving} className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition flex items-center justify-center gap-2"><Save size={14} /> Simpan Profil</button><button onClick={handleLogout} className="w-full border border-red-200 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition flex items-center justify-center gap-2"><LogOut size={14} /> Keluar</button></div>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <div className="flex justify-between items-center"><h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm sm:text-base"><BookOpen size={18} /> Cerita Saya ({stories.filter(s => s.authorId === user?.uid).length})</h3><button onClick={startWritingNew} className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"><PlusCircle size={14} /> Buat Baru</button></div>
                        <div className="space-y-3">{stories.filter(s => s.authorId === user?.uid).length === 0 ? (<div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200"><p className="text-gray-400 text-sm">Kamu belum menulis cerita apapun.</p></div>) : (stories.filter(s => s.authorId === user?.uid).map(story => (<div key={story.id} className="bg-white p-3 rounded-lg border border-gray-100 flex gap-4 hover:shadow-md transition group"><div className="w-16 h-24 shrink-0 bg-gray-100 rounded overflow-hidden"><img src={story.coverUrl} className="w-full h-full object-contain" onError={(e) => {e.target.src = 'https://placehold.co/400x600/e2e8f0/1e293b?text=No+Cover'}} /></div><div className="flex-1 min-w-0 py-1"><h4 className="font-bold text-gray-800 truncate text-sm sm:text-base">{story.title}</h4><p className="text-xs text-gray-500 mb-3">{story.chapters.length} Bab</p><div className="flex gap-2"><button onClick={() => startEditing(story)} className="text-xs bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full hover:bg-orange-100 font-medium">Edit</button><button onClick={(e) => handleDeleteStory(e, story.id)} className="text-xs bg-red-50 text-red-700 px-3 py-1.5 rounded-full hover:bg-red-100 font-medium">Hapus</button></div></div></div>)))}</div>
                    </div>
                </div>
            </div>
        )}

        {view === 'write' && (
          <div className="max-w-3xl mx-auto animate-fade-in">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2 text-gray-800"><PenTool className="text-orange-600" /> {editingId ? 'Edit Novel' : 'Novel Baru'}</h2>
            {activeChapterIndex === null && (
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-4 mb-6">
                <div className="flex justify-between items-center border-b pb-2 mb-2">
                    <h3 className="font-bold text-gray-700 text-sm sm:text-base">Informasi Novel</h3>
                    <button onClick={() => { pushHistory(); resetForm(); setView('home'); }} className="text-xs sm:text-sm text-gray-500 hover:text-orange-600 flex items-center gap-1"><ArrowLeft size={14}/> Batal</button>
                </div>

                <div><label className="block text-sm font-medium text-gray-700 mb-1">Judul Novel</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Judul Novel..." /></div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Genre (Pilih Maksimal 4)</label>
                    <div className="flex flex-wrap gap-2">
                        {GENRES.filter(g => g !== "Semua").map(g => (
                            <button
                                key={g}
                                onClick={() => toggleGenre(g)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                                    genre.includes(g) 
                                    ? 'bg-orange-100 text-orange-600 border-orange-200' 
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Penulis</label><input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Otomatis dari Profil..." /></div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative group shrink-0 w-fit mx-auto sm:mx-0">
                        <div onClick={() => openImageModal('cover')} className="w-32 h-48 bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-orange-500 overflow-hidden rounded-lg">
                            {coverUrl ? <img src={coverUrl} className="w-full h-full object-cover" /> : <div className="text-center"><UploadCloud size={24} className="mx-auto text-gray-400"/><span className="text-[10px] text-gray-400">Sampul</span></div>}
                        </div>
                        {coverUrl && (<button onClick={handleRemoveCover} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 z-10"><X size={14} /></button>)}
                    </div>
                    <div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">Sinopsis</label><textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} className="w-full p-3 border rounded-lg h-32 sm:h-48 text-sm resize-none focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Sinopsis..." /></div>
                </div>
                <div className="border-t pt-4">
                    <button onClick={() => setActiveChapterIndex('new')} className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 flex items-center justify-center gap-2"><List size={18}/> Kelola Bab & Terbitkan</button>
                </div>
              </div>
            )}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
              {activeChapterIndex === null ? (
                <div>
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                      <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm sm:text-base"><List size={18}/> Daftar Bab ({chapters.length + (prologue ? 1 : 0)})</h3>
                      <div className="flex gap-2">
                          {!prologue ? (
                              <button onClick={() => { setChapterTitle(''); setChapterContent(''); setActiveChapterIndex('prologue'); }} className="text-xs sm:text-sm bg-purple-100 text-purple-600 px-3 py-1.5 rounded-full hover:bg-purple-200 transition flex items-center gap-1 font-medium"><PlusCircle size={14} /> Prolog</button>
                          ) : null}
                          <button onClick={() => { setChapterTitle(''); setChapterContent(''); setActiveChapterIndex('new'); }} className="text-xs sm:text-sm bg-orange-100 text-orange-600 px-3 py-1.5 rounded-full hover:bg-orange-200 transition flex items-center gap-1 font-medium"><PlusCircle size={14} /> Bab</button>
                      </div>
                  </div>

                  {prologue && (
                       <div className="p-3 border rounded-lg hover:bg-purple-50 transition group mb-2 border-purple-100 bg-purple-50/50">
                          <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3"><span className="w-16 text-xs font-bold text-purple-600">PROLOG</span><span className="font-medium text-gray-700 text-sm sm:text-base truncate max-w-[150px] sm:max-w-xs"></span></div>
                              <div className="flex gap-2"><button onClick={handleEditPrologue} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16} /></button><button onClick={handleDeletePrologue} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button></div>
                          </div>
                       </div>
                  )}

                  {chapters.length === 0 && !prologue ? (<div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg bg-gray-50"><p>Belum ada bab.</p><p className="text-sm">Klik "Tambah" untuk mulai.</p></div>) : (<div className="space-y-2">{chapters.map((chap, idx) => (<div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition group"><div className="flex items-center gap-3"><span className="w-6 h-6 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span><span className="font-medium text-gray-700 text-sm sm:text-base truncate max-w-[150px] sm:max-w-xs">{chap.title}</span></div><div className="flex gap-2"><button onClick={() => handleEditChapter(idx)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16} /></button><button onClick={() => handleDeleteChapter(idx)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button></div></div>))}</div>)}
                  <div className="mt-8 flex justify-end gap-3 pt-4 border-t"><button onClick={() => { resetForm(); setView('home'); }} className="px-4 sm:px-6 py-2 rounded-full border text-gray-600 hover:bg-gray-50 text-sm sm:text-base">Batal</button><button onClick={handlePublish} disabled={isSaving} className={`px-4 sm:px-6 py-2 rounded-full bg-orange-600 text-white font-semibold hover:bg-orange-700 flex items-center gap-2 text-sm sm:text-base ${isSaving ? 'opacity-50' : ''}`}><Save size={18} /> {editingId ? 'Update' : 'Terbitkan'}</button></div>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-800 text-sm sm:text-base">
                          {activeChapterIndex === 'new' ? 'Menulis Bab Baru' : activeChapterIndex === 'prologue' ? 'Edit Prolog' : `Edit Bab`}
                      </h3>
                      <button onClick={() => setActiveChapterIndex(null)} className="text-xs sm:text-sm text-gray-500 hover:text-orange-600 flex items-center gap-1"><ArrowLeft size={14}/> Kembali ke Daftar</button>
                  </div>
                  <div className="space-y-4">
                    {/* INPUT JUDUL HANYA MUNCUL JIKA BUKAN PROLOG */}
                    {activeChapterIndex !== 'prologue' && (
                        <input type="text" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-lg font-bold text-lg focus:border-orange-500 outline-none" placeholder="Judul Bab..." />
                    )}
                    
                    <div className="flex gap-2 border-b border-gray-200 mb-0"><button onClick={() => setWriteMode('edit')} className={`px-3 sm:px-4 py-2 flex items-center gap-2 text-xs sm:text-sm font-medium rounded-t-lg transition ${writeMode === 'edit' ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500' : 'text-gray-500 hover:bg-gray-50'}`}><FileText size={16} /> Edit</button><button onClick={() => setWriteMode('preview')} className={`px-3 sm:px-4 py-2 flex items-center gap-2 text-xs sm:text-sm font-medium rounded-t-lg transition ${writeMode === 'preview' ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500' : 'text-gray-500 hover:bg-gray-50'}`}><Eye size={16} /> Preview</button></div>
                    <div className="border border-gray-300 rounded-b-lg rounded-tr-lg overflow-hidden bg-white h-[50vh] sm:h-[60vh] flex flex-col">
                      {writeMode === 'edit' ? (<><div className="bg-gray-50 border-b px-3 py-2 flex gap-2"><button onClick={() => openImageModal('content')} className="flex items-center gap-1 text-xs bg-white border px-3 py-1.5 rounded hover:bg-gray-100 text-gray-700"><ImageIcon size={14} /> Gambar</button></div><textarea value={chapterContent} onChange={(e) => setChapterContent(e.target.value)} className="w-full p-4 h-full outline-none resize-none font-serif text-base sm:text-lg leading-relaxed flex-1" placeholder="Tulis isi cerita di sini..." /></>) : (<div className="p-4 sm:p-6 h-full overflow-y-auto bg-white"><div className="font-serif text-gray-800 text-base sm:text-lg md:text-xl leading-relaxed whitespace-pre-wrap">{renderContent(chapterContent || "Belum ada konten.")}</div></div>)}
                    </div>
                    <div className="flex justify-end gap-3"><button onClick={() => {setChapterTitle(''); setChapterContent(''); setActiveChapterIndex(null);}} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Batal</button><button onClick={handleSaveChapterToLocal} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm">Simpan</button></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Gambar & Konfirmasi (Tetap sama) */}
        {showImageModal && <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"><div className="bg-white p-4 rounded w-full max-w-sm"><h3 className="font-bold mb-2">Upload Gambar</h3><div className="border border-gray-200 rounded p-2 mb-3"><p className="text-xs text-gray-500 mb-2">Tempel Link Gambar (Google Drive / Direct URL)</p><input value={tempImageUrl} onChange={e=>setTempImageUrl(e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="https://..." /></div><div className="flex justify-end gap-2"><button onClick={()=>setShowImageModal(false)} className="px-3 py-1 border rounded text-sm">Batal</button><button onClick={handleSaveImageLink} className="px-3 py-1 bg-orange-600 text-white rounded text-sm">Simpan</button></div></div></div>}
        {confirmModal.isOpen && <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"><div className="bg-white p-4 rounded text-center"><h3 className="font-bold mb-1">{confirmModal.title}</h3><p className="text-sm text-gray-500 mb-4">{confirmModal.message}</p><div className="flex gap-2 justify-center"><button onClick={closeConfirmModal} className="px-4 py-1 border rounded">Batal</button><button onClick={confirmModal.onConfirm} className="px-4 py-1 bg-red-600 text-white rounded">Ya</button></div></div></div>}
      </main>
    </div>
  );
}
