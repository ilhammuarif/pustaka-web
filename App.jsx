import React, { useState, useEffect } from 'react';
import { BookOpen, PenTool, Home, Image as ImageIcon, Save, ArrowLeft, PlusCircle, User, X, Info, UploadCloud, Edit, Trash2, List, ChevronRight, ChevronLeft, Link as LinkIcon, AlertCircle, Eye, FileText, AlertTriangle, Settings, LogOut, Lock, Mail } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCustomToken } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, setDoc, getDoc } from "firebase/firestore";

// --- 1. KONFIGURASI FIREBASE (WebNovelKuu) ---
const firebaseConfig = {
  apiKey: "AIzaSyBnc9NMHH4bQdfBm4E1EIKmCbhCvX23yEA",
  authDomain: "webnovelkuu.firebaseapp.com",
  projectId: "webnovelkuu",
  storageBucket: "webnovelkuu.firebasestorage.app",
  messagingSenderId: "758683527144",
  appId: "1:758683527144:web:069e6ef93b87158ef9265d"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ID Aplikasi Statis
const appId = 'pustaka-utama'; 

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState({ name: '', photoUrl: '' });
  
  // State Auth (Login/Register)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // State App Utama
  const [view, setView] = useState('home'); 
  const [stories, setStories] = useState([]);
  const [currentStory, setCurrentStory] = useState(null);
  
  // State Info Novel
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState(''); 
  const [coverUrl, setCoverUrl] = useState('');
  const [synopsis, setSynopsis] = useState('');
  
  // State Chapter
  const [chapters, setChapters] = useState([]); 
  const [activeChapterIndex, setActiveChapterIndex] = useState(null); 
  
  // State Editor
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterContent, setChapterContent] = useState('');
  const [writeMode, setWriteMode] = useState('edit');

  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState('');
  const [editingId, setEditingId] = useState(null);

  // State Modal & Konfirmasi
  const [showImageModal, setShowImageModal] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [imageModalMode, setImageModalMode] = useState('content'); 
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', onConfirm: null
  });

  // --- 2. Inisialisasi Auth ---
  useEffect(() => {
    // Cek token auth bawaan (untuk environment preview ini)
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch (e) { console.log("Login manual diperlukan."); }
      }
    };
    initAuth();
    
    // Listener Perubahan Status Login
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'info');
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        } else {
            setUserProfile({ name: '', photoUrl: '' });
        }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // --- 3. Fungsi Auth ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
        if (isRegistering) {
            await createUserWithEmailAndPassword(auth, email, password);
            showNotification("Akun berhasil dibuat! Selamat datang.");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            showNotification("Berhasil masuk.");
        }
    } catch (error) {
        console.error("Auth Error:", error);
        let msg = "Terjadi kesalahan.";
        if (error.code === 'auth/invalid-email') msg = "Format email salah.";
        if (error.code === 'auth/invalid-credential') msg = "Email atau password salah.";
        if (error.code === 'auth/email-already-in-use') msg = "Email sudah terdaftar.";
        if (error.code === 'auth/weak-password') msg = "Password terlalu lemah.";
        setAuthError(msg);
    } finally { setAuthLoading(false); }
  };

  const handleLogout = async () => {
      await signOut(auth);
      setView('home');
      showNotification("Berhasil keluar.");
  };

  // --- 4. Listener Data Cerita ---
  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'stories'), orderBy('createdAt', 'desc'));
    const unsubscribeData = onSnapshot(q, (snapshot) => {
      const storiesData = snapshot.docs.map(doc => {
        const data = doc.data();
        if (!data.chapters && data.content) data.chapters = [{ title: "Bagian Utama", content: data.content }];
        return { id: doc.id, ...data, chapters: data.chapters || [] };
      });
      setStories(storiesData);
    }, (error) => console.error("Error data:", error));
    return () => unsubscribeData();
  }, []); 

  // --- 5. Fungsi Logika App ---

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
        const profileData = { name: userProfile.name, photoUrl: userProfile.photoUrl || '' };
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), profileData);
        showNotification("Profil berhasil disimpan!");
    } catch (error) { showNotification("Gagal menyimpan profil."); } 
    finally { setIsSaving(false); }
  };

  const startEditing = (story) => {
    setEditingId(story.id); setTitle(story.title);
    setAuthorName(story.authorName || userProfile.name || ''); setCoverUrl(story.coverUrl);
    setSynopsis(story.synopsis); setChapters(story.chapters || []);
    setActiveChapterIndex(null); setChapterTitle(''); setChapterContent('');
    setView('write');
  };

  const startWritingNew = () => {
      resetForm();
      if (userProfile.name) setAuthorName(userProfile.name);
      setView('write');
  };

  const closeConfirmModal = () => setConfirmModal({ ...confirmModal, isOpen: false });

  const handleDeleteStory = (e, storyId) => {
    if(e) e.stopPropagation();
    setConfirmModal({
      isOpen: true, title: 'Hapus Novel Permanen',
      message: 'Apakah kamu yakin ingin menghapus novel ini selamanya?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stories', storyId));
          showNotification("Novel berhasil dihapus.");
          if (view === 'read' && currentStory?.id === storyId) { setView('home'); setCurrentStory(null); }
        } catch (error) { showNotification("Gagal menghapus novel."); }
        closeConfirmModal();
      }
    });
  };

  const handleRemoveCover = (e) => {
    if(e) e.stopPropagation();
    setConfirmModal({
      isOpen: true, title: 'Hapus Sampul', message: 'Hapus gambar sampul ini?',
      onConfirm: () => { setCoverUrl(''); closeConfirmModal(); }
    });
  };

  const handleDeleteChapter = (index) => {
    setConfirmModal({
      isOpen: true, title: 'Hapus Chapter', message: 'Yakin ingin menghapus chapter ini?',
      onConfirm: () => {
        const updatedChapters = chapters.filter((_, i) => i !== index);
        setChapters(updatedChapters);
        if (activeChapterIndex === index) { setActiveChapterIndex(null); setChapterTitle(''); setChapterContent(''); }
        closeConfirmModal();
      }
    });
  };

  const handleSaveChapterToLocal = () => {
    if (!chapterTitle || !chapterContent) { showNotification("Judul dan Isi tidak boleh kosong!"); return; }
    const newChapterData = { title: chapterTitle, content: chapterContent };
    const updatedChapters = [...chapters];
    if (activeChapterIndex === 'new') updatedChapters.push(newChapterData);
    else if (typeof activeChapterIndex === 'number') updatedChapters[activeChapterIndex] = newChapterData;
    setChapters(updatedChapters);
    setChapterTitle(''); setChapterContent(''); setWriteMode('edit'); setActiveChapterIndex(null); 
  };

  const handleEditChapter = (index) => {
    setActiveChapterIndex(index); setChapterTitle(chapters[index].title);
    setChapterContent(chapters[index].content); setWriteMode('edit'); 
  };

  const handlePublish = async () => {
    if (!title || chapters.length === 0) { showNotification("Judul dan minimal 1 Chapter wajib ada!"); return; }
    setIsSaving(true);
    try {
      const storyData = {
        title, authorName: authorName || userProfile.name || 'Anonim', 
        coverUrl: coverUrl || 'https://placehold.co/400x600/e2e8f0/1e293b?text=No+Cover',
        synopsis, chapters, authorId: user.uid, updatedAt: serverTimestamp()
      };
      if (editingId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stories', editingId), storyData);
        showNotification("Novel berhasil diperbarui!");
      } else {
        storyData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'stories'), storyData);
        showNotification("Novel berhasil diterbitkan!");
      }
      resetForm(); setView('home');
    } catch (error) { console.error("Error:", error); showNotification("Gagal menyimpan novel."); } 
    finally { setIsSaving(false); }
  };

  const showNotification = (msg) => { setNotification(msg); setTimeout(() => setNotification(''), 3000); };

  const resetForm = () => {
    setTitle(''); setAuthorName(''); setCoverUrl(''); setSynopsis('');
    setChapters([]); setChapterTitle(''); setChapterContent('');
    setActiveChapterIndex(null); setEditingId(null); setWriteMode('edit');
  };

  const openImageModal = (mode) => {
    setImageModalMode(mode);
    let initialUrl = '';
    if (mode === 'cover') initialUrl = coverUrl;
    else if (mode === 'profile') initialUrl = userProfile.photoUrl;
    setTempImageUrl(initialUrl); setShowImageModal(true);
  };

  const handleSaveImageLink = () => {
    if (!tempImageUrl) { setShowImageModal(false); return; }
    let finalUrl = tempImageUrl;
    // Fitur: Google Drive Converter
    if (tempImageUrl.includes('drive.google.com') || tempImageUrl.includes('docs.google.com')) {
      const idMatch = tempImageUrl.match(/[-\w]{25,}/);
      if (idMatch) {
        finalUrl = `https://drive.google.com/thumbnail?id=${idMatch[0]}&sz=w1200`;
        showNotification("Link Google Drive berhasil dikonversi!");
      }
    }
    if (imageModalMode === 'cover') setCoverUrl(finalUrl);
    else if (imageModalMode === 'profile') setUserProfile(prev => ({ ...prev, photoUrl: finalUrl }));
    else setChapterContent(prev => prev + `\n\n[GAMBAR: ${finalUrl}]\n\n`);
    setShowImageModal(false); setTempImageUrl('');
  };

  const renderContent = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, index) => {
      const imageMatch = line.match(/\[GAMBAR:\s*(.*?)\]/);
      if (imageMatch) {
        return (
          <div key={index} className="my-6 flex justify-center">
            <img src={imageMatch[1]} alt="Ilustrasi" className="max-w-full rounded-lg shadow-md max-h-[500px] object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
        );
      }
      if (line.trim() === '') return <div key={index} className="h-4"></div>;
      return <p key={index} className="mb-2 leading-relaxed text-gray-800 indent-6 text-lg">{line}</p>;
    });
  };

  // --- 6. Tampilan (UI) ---
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div onClick={() => { resetForm(); setView('home'); }} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition">
            <BookOpen className="text-orange-600" size={28} />
            <span className="font-bold text-xl tracking-tight text-gray-800 hidden md:inline">Pustaka<span className="text-orange-600">Kita</span></span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { resetForm(); setView('home'); }} className={`p-2 rounded-full transition ${view === 'home' ? 'bg-orange-100 text-orange-600' : 'text-gray-500 hover:bg-gray-100'}`} title="Beranda"><Home size={22} /></button>
            {user ? (
                <button onClick={() => { resetForm(); setView('profile'); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition border ${view === 'profile' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'border-transparent text-gray-600 hover:bg-gray-100'}`} title="Profil Saya">
                    {userProfile.photoUrl ? <img src={userProfile.photoUrl} className="w-6 h-6 rounded-full object-cover" alt="Profile" /> : <User size={20} />}
                    <span className="text-sm font-medium hidden md:inline truncate max-w-[100px]">{userProfile.name || 'Penulis'}</span>
                </button>
            ) : (
                <button onClick={() => setView('login')} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-full text-sm font-bold hover:bg-orange-700 transition">Masuk / Daftar</button>
            )}
          </div>
        </div>
      </nav>

      {notification && <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-bounce">{notification}</div>}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 mb-6 text-sm">{confirmModal.message}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={closeConfirmModal} className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 flex-1">Batal</button>
              <button onClick={confirmModal.onConfirm} className="px-5 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 shadow-md flex-1">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      {showImageModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><ImageIcon className="text-orange-600" /> {imageModalMode === 'cover' ? 'Sampul Novel' : imageModalMode === 'profile' ? 'Foto Profil' : 'Sisipkan Ilustrasi'}</h3>
              <button onClick={() => setShowImageModal(false)}><X size={24} /></button>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-900 mb-4 border border-blue-100"><p className="font-bold mb-1">Tips Upload:</p><p className="opacity-90 text-xs">Gunakan link <strong>Google Drive</strong> (Share Public) atau link gambar langsung.</p></div>
            <div className="space-y-3"><label className="block text-sm font-medium text-gray-700">Link Gambar</label><div className="flex gap-2"><div className="relative flex-1"><LinkIcon size={16} className="absolute left-3 top-3 text-gray-400" /><input type="text" value={tempImageUrl} onChange={(e) => setTempImageUrl(e.target.value)} placeholder="https://..." className="w-full pl-9 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" /></div></div></div>
            <div className="flex justify-end gap-2 mt-6"><button onClick={() => setShowImageModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button><button onClick={handleSaveImageLink} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-sm font-medium">Proses & Simpan</button></div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6">
        {view === 'home' && (
          <div className="animate-fade-in">
             <div className="mb-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
               <div className="relative z-10"><h1 className="text-3xl font-bold mb-2">Selamat Datang di Pustaka Kita</h1><p className="opacity-90 max-w-lg mb-6">Mulai petualanganmu menulis cerita atau baca karya seru dari penulis lain.</p><div className="flex gap-3">{user ? (<><button onClick={startWritingNew} className="bg-white text-orange-600 px-6 py-2 rounded-full font-semibold hover:bg-orange-50 transition shadow-md flex items-center gap-2"><PlusCircle size={20} /> Tulis Cerita</button><button onClick={() => setView('profile')} className="bg-orange-600 border border-white/30 text-white px-6 py-2 rounded-full font-semibold hover:bg-orange-700 transition shadow-md flex items-center gap-2"><User size={20} /> Profil Saya</button></>) : (<button onClick={() => setView('login')} className="bg-white text-orange-600 px-6 py-2 rounded-full font-bold hover:bg-orange-50 transition shadow-md">Masuk untuk Menulis</button>)}</div></div><BookOpen size={200} className="absolute -right-10 -bottom-10 text-white opacity-10 rotate-12" /></div>
            <h2 className="text-xl font-bold mb-6 border-l-4 border-orange-500 pl-3">Daftar Bacaan Terbaru</h2>
            {stories.length === 0 ? (<div className="text-center py-20 text-gray-400"><BookOpen size={48} className="mx-auto mb-4 opacity-20" /><p>Belum ada novel.</p></div>) : (<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{stories.map(story => (<div key={story.id} onClick={() => { setCurrentStory(story); setActiveChapterIndex(null); setView('read'); }} className="group cursor-pointer flex flex-col gap-2 relative"><div className="aspect-[2/3] w-full rounded-lg overflow-hidden shadow-md group-hover:shadow-xl transition relative bg-gray-200"><img src={story.coverUrl} alt={story.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" onError={(e) => {e.target.src = 'https://placehold.co/400x600/e2e8f0/1e293b?text=No+Cover'}} /><div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">{story.chapters.length} Bab</div></div><div><h3 className="font-bold text-gray-800 leading-tight group-hover:text-orange-600">{story.title}</h3><p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><User size={10} /> {story.authorName || 'Anonim'}</p></div></div>))}</div>)}
          </div>
        )}

        {view === 'login' && (
            <div className="flex items-center justify-center py-10 animate-fade-in">
                <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-gray-100">
                    <div className="text-center mb-8"><BookOpen className="text-orange-600 mx-auto mb-3" size={40} /><h2 className="text-2xl font-bold text-gray-800">{isRegistering ? 'Buat Akun Baru' : 'Masuk ke Pustaka'}</h2><p className="text-gray-500 text-sm mt-2">Bergabunglah untuk mulai berkarya.</p></div>
                    <form onSubmit={handleAuth} className="space-y-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><div className="relative"><Mail className="absolute left-3 top-3 text-gray-400" size={18} /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="contoh@email.com" /></div></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><div className="relative"><Lock className="absolute left-3 top-3 text-gray-400" size={18} /><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="******" /></div></div>{authError && (<div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16} /> {authError}</div>)}<button type="submit" disabled={authLoading} className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-bold hover:bg-orange-700 transition shadow-lg disabled:opacity-50">{authLoading ? 'Memproses...' : (isRegistering ? 'Daftar Akun Baru' : 'Masuk Sekarang')}</button></form>
                    <div className="mt-6 text-center text-sm"><p className="text-gray-600">{isRegistering ? 'Sudah punya akun?' : 'Belum punya akun?'}<button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="ml-1 text-orange-600 font-bold hover:underline">{isRegistering ? 'Login di sini' : 'Daftar di sini'}</button></p></div>
                </div>
            </div>
        )}

        {view === 'profile' && user && (
            <div className="animate-fade-in max-w-3xl mx-auto">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800"><User className="text-orange-600" /> Profil Penulis</h2>
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center h-fit">
                        <div className="relative w-24 h-24 mx-auto mb-4"><div className="w-full h-full rounded-full overflow-hidden border-4 border-orange-50 bg-gray-100">{userProfile.photoUrl ? (<img src={userProfile.photoUrl} className="w-full h-full object-cover" alt="Avatar" />) : (<User className="w-full h-full p-4 text-gray-300" />)}</div><button onClick={() => openImageModal('profile')} className="absolute bottom-0 right-0 bg-orange-600 text-white p-1.5 rounded-full hover:bg-orange-700 shadow-sm" title="Ganti Foto"><Edit size={12} /></button></div>
                        <div className="mb-4"><label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Nama Pena</label><input type="text" value={userProfile.name} onChange={(e) => setUserProfile({...userProfile, name: e.target.value})} className="w-full text-center font-bold text-gray-800 border-b border-gray-200 focus:border-orange-500 outline-none pb-1 mt-1" placeholder="Isi Nama Kamu" /></div>
                        <div className="space-y-2"><button onClick={handleSaveProfile} disabled={isSaving} className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition flex items-center justify-center gap-2"><Save size={14} /> Simpan Profil</button><button onClick={handleLogout} className="w-full border border-red-200 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition flex items-center justify-center gap-2"><LogOut size={14} /> Keluar (Logout)</button></div><p className="text-[10px] text-gray-400 mt-4">Login sebagai: {auth.currentUser?.email}</p>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <div className="flex justify-between items-center"><h3 className="font-bold text-gray-700 flex items-center gap-2"><BookOpen size={18} /> Cerita Saya ({stories.filter(s => s.authorId === user?.uid).length})</h3><button onClick={startWritingNew} className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"><PlusCircle size={14} /> Buat Baru</button></div>
                        <div className="space-y-3">{stories.filter(s => s.authorId === user?.uid).length === 0 ? (<div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200"><p className="text-gray-400 text-sm">Kamu belum menulis cerita apapun.</p></div>) : (stories.filter(s => s.authorId === user?.uid).map(story => (<div key={story.id} className="bg-white p-3 rounded-lg border border-gray-100 flex gap-4 hover:shadow-md transition group"><div className="w-16 h-20 shrink-0 bg-gray-200 rounded overflow-hidden"><img src={story.coverUrl} className="w-full h-full object-cover" onError={(e) => {e.target.src = 'https://placehold.co/400x600/e2e8f0/1e293b?text=No+Cover'}} /></div><div className="flex-1 min-w-0"><h4 className="font-bold text-gray-800 truncate">{story.title}</h4><p className="text-xs text-gray-500 mb-2">{story.chapters.length} Chapter • {new Date(story.createdAt?.seconds * 1000).toLocaleDateString()}</p><div className="flex gap-2"><button onClick={() => startEditing(story)} className="text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-100 font-medium">Edit</button><button onClick={(e) => handleDeleteStory(e, story.id)} className="text-xs bg-red-50 text-red-700 px-3 py-1 rounded-full hover:bg-red-100 font-medium">Hapus</button><button onClick={() => { setCurrentStory(story); setActiveChapterIndex(null); setView('read'); }} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full hover:bg-gray-200">Baca</button></div></div></div>)))}</div>
                    </div>
                </div>
            </div>
        )}

        {view === 'write' && (
          <div className="max-w-3xl mx-auto animate-fade-in">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800"><PenTool className="text-orange-600" /> {editingId ? 'Edit Novel' : 'Novel Baru'}</h2>
            {activeChapterIndex === null && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4 mb-6">
                <h3 className="font-bold text-gray-700 border-b pb-2">Informasi Novel</h3>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Judul Novel</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Judul Novel..." /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Penulis</label><input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Otomatis dari Profil..." /></div>
                <div className="flex gap-4"><div className="relative group shrink-0"><div onClick={() => openImageModal('cover')} className="w-20 h-28 bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-orange-500 overflow-hidden rounded">{coverUrl ? <img src={coverUrl} className="w-full h-full object-cover" /> : <UploadCloud size={20} className="text-gray-400" />}</div>{coverUrl && (<button onClick={handleRemoveCover} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 z-10"><X size={12} /></button>)}</div><div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">Sinopsis</label><textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} className="w-full p-2 border rounded-lg h-20 text-sm resize-none" placeholder="Sinopsis..." /></div></div>
              </div>
            )}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              {activeChapterIndex === null ? (
                <div>
                  <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold text-gray-700 flex items-center gap-2"><List size={18}/> Daftar Chapter ({chapters.length})</h3><button onClick={() => setActiveChapterIndex('new')} className="text-sm bg-orange-100 text-orange-600 px-3 py-1.5 rounded-full hover:bg-orange-200 transition flex items-center gap-1 font-medium"><PlusCircle size={14} /> Tambah Chapter</button></div>
                  {chapters.length === 0 ? (<div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg bg-gray-50"><p>Belum ada chapter.</p><p className="text-sm">Klik "Tambah Chapter" untuk mulai.</p></div>) : (<div className="space-y-2">{chapters.map((chap, idx) => (<div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition group"><div className="flex items-center gap-3"><span className="w-6 h-6 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span><span className="font-medium text-gray-700">{chap.title}</span></div><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition"><button onClick={() => handleEditChapter(idx)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16} /></button><button onClick={() => handleDeleteChapter(idx)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button></div></div>))}</div>)}
                  <div className="mt-8 flex justify-end gap-3 pt-4 border-t"><button onClick={() => { resetForm(); setView('home'); }} className="px-6 py-2 rounded-full border text-gray-600 hover:bg-gray-50">Batal</button><button onClick={handlePublish} disabled={isSaving} className={`px-6 py-2 rounded-full bg-orange-600 text-white font-semibold hover:bg-orange-700 flex items-center gap-2 ${isSaving ? 'opacity-50' : ''}`}><Save size={18} /> {editingId ? 'Update Novel' : 'Terbitkan Novel'}</button></div>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-800">{activeChapterIndex === 'new' ? 'Menulis Chapter Baru' : `Edit Chapter ${activeChapterIndex + 1}`}</h3></div>
                  <div className="space-y-4">
                    <input type="text" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-lg font-bold text-lg focus:border-orange-500 outline-none" placeholder="Judul Chapter..." />
                    <div className="flex gap-2 border-b border-gray-200 mb-0"><button onClick={() => setWriteMode('edit')} className={`px-4 py-2 flex items-center gap-2 text-sm font-medium rounded-t-lg transition ${writeMode === 'edit' ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500' : 'text-gray-500 hover:bg-gray-50'}`}><FileText size={16} /> Mode Edit</button><button onClick={() => setWriteMode('preview')} className={`px-4 py-2 flex items-center gap-2 text-sm font-medium rounded-t-lg transition ${writeMode === 'preview' ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500' : 'text-gray-500 hover:bg-gray-50'}`}><Eye size={16} /> Lihat Preview</button></div>
                    <div className="border border-gray-300 rounded-b-lg rounded-tr-lg overflow-hidden bg-white min-h-[400px]">
                      {writeMode === 'edit' ? (<><div className="bg-gray-50 border-b px-3 py-2 flex gap-2"><button onClick={() => openImageModal('content')} className="flex items-center gap-1 text-xs bg-white border px-3 py-1.5 rounded hover:bg-gray-100 text-gray-700"><ImageIcon size={14} /> Sisipkan Gambar</button></div><textarea value={chapterContent} onChange={(e) => setChapterContent(e.target.value)} className="w-full p-4 h-[400px] outline-none resize-none font-serif text-lg leading-relaxed" placeholder="Tulis isi chapter di sini..." /></>) : (<div className="p-6 h-[450px] overflow-y-auto bg-white"><div className="font-serif text-gray-800 text-lg md:text-xl leading-relaxed whitespace-pre-wrap">{renderContent(chapterContent || "Belum ada konten.")}</div></div>)}
                    </div>
                    <div className="flex justify-end gap-3"><button onClick={() => setActiveChapterIndex(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button><button onClick={handleSaveChapterToLocal} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Simpan Chapter</button></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'read' && currentStory && (
          <div className="animate-fade-in pb-20">
            <div className="flex justify-between items-center mb-6 sticky top-20 z-40">
                <button onClick={() => { if(activeChapterIndex !== null) setActiveChapterIndex(null); else { resetForm(); setView('home'); } }} className="flex items-center gap-2 text-gray-500 hover:text-orange-600 transition bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border"><ArrowLeft size={18} /> {activeChapterIndex !== null ? 'Daftar Isi' : 'Rak Buku'}</button>
                {user && currentStory.authorId === user.uid && (<div className="flex gap-2"><button onClick={(e) => handleDeleteStory(e, currentStory.id)} className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full hover:bg-red-100 text-sm font-medium border border-red-200"><Trash2 size={14} /> Hapus</button><button onClick={() => startEditing(currentStory)} className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full hover:bg-orange-100 text-sm font-medium border border-orange-200"><Edit size={14} /> Edit</button></div>)}
            </div>
            {activeChapterIndex === null ? (
              <div className="max-w-2xl mx-auto"><div className="flex flex-col md:flex-row gap-6 mb-8"><div className="w-40 mx-auto md:mx-0 shrink-0 shadow-lg rounded-lg overflow-hidden bg-gray-200"><img src={currentStory.coverUrl} className="w-full h-full object-cover" onError={(e) => {e.target.src = 'https://placehold.co/400x600/e2e8f0/1e293b?text=No+Cover'}} /></div><div className="text-center md:text-left flex-1"><h1 className="text-3xl font-bold text-gray-900 mb-2 font-serif">{currentStory.title}</h1><div className="text-gray-500 text-sm mb-4 flex items-center justify-center md:justify-start gap-2"><User size={14}/> {currentStory.authorName || 'Penulis Anonim'}</div><p className="text-gray-700 italic text-sm leading-relaxed">{currentStory.synopsis || "Tidak ada sinopsis."}</p></div></div><div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"><div className="bg-gray-50 px-4 py-3 border-b font-bold text-gray-700">Daftar Isi ({currentStory.chapters.length} Bab)</div><div className="divide-y divide-gray-100">{currentStory.chapters.map((chap, idx) => (<div key={idx} onClick={() => setActiveChapterIndex(idx)} className="p-4 hover:bg-orange-50 cursor-pointer flex justify-between items-center transition group"><div><span className="text-xs font-bold text-orange-600 mb-1 block">CHAPTER {idx + 1}</span><span className="font-medium text-gray-800 group-hover:text-orange-700">{chap.title}</span></div><ChevronRight size={18} className="text-gray-300 group-hover:text-orange-500" /></div>))}</div></div></div>
            ) : (
              <div className="max-w-3xl mx-auto"><div className="text-center mb-8"><h2 className="text-sm font-bold text-orange-600 tracking-widest uppercase mb-1">Chapter {activeChapterIndex + 1}</h2><h1 className="text-3xl font-serif font-bold text-gray-900">{currentStory.chapters[activeChapterIndex].title}</h1></div><article className="font-serif text-gray-800 text-lg md:text-xl leading-relaxed whitespace-pre-wrap mb-10">{renderContent(currentStory.chapters[activeChapterIndex].content)}</article><div className="flex justify-between items-center border-t pt-8 mt-8"><button disabled={activeChapterIndex === 0} onClick={() => { window.scrollTo(0,0); setActiveChapterIndex(prev => prev - 1); }} className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-0 text-gray-600"><ChevronLeft size={20} /> Sebelumnya</button><button disabled={activeChapterIndex === currentStory.chapters.length - 1} onClick={() => { window.scrollTo(0,0); setActiveChapterIndex(prev => prev + 1); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-0 shadow-md">Berikutnya <ChevronRight size={20} /></button></div></div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}