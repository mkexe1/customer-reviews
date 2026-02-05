import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc,
  addDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot, 
  query, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { Star, CheckCircle, User, MessageSquare, ShieldCheck, Plus, Lock, Unlock, Trash2, Key, Reply, CornerDownRight, X, Info, AlertTriangle, Users } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'moderated-review-app';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModerator, setIsModerator] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [passError, setPassError] = useState(false);
  
  const [showNotification, setShowNotification] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  
  const ADMIN_PASSWORD = "1234"; 

  const [formData, setFormData] = useState({
    rating: 5,
    comment: '',
    displayName: ''
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const reviewsCol = collection(db, 'artifacts', appId, 'public', 'data', 'reviews');
    const q = query(reviewsCol);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const sorted = data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setReviews(sorted);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const verifiedReviews = reviews.filter(r => r.isVerified);
  const totalReviews = verifiedReviews.length;
  const averageRating = totalReviews > 0 
    ? (verifiedReviews.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews).toFixed(1)
    : 0;

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.comment.trim()) return;

    try {
      const reviewsCol = collection(db, 'artifacts', appId, 'public', 'data', 'reviews');
      await addDoc(reviewsCol, {
        userId: user.uid,
        displayName: formData.displayName || 'Anonymous',
        rating: formData.rating,
        comment: formData.comment,
        isVerified: false,
        adminReply: null,
        createdAt: serverTimestamp()
      });

      setFormData({ rating: 5, comment: '', displayName: '' });
      setIsModalOpen(false);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    } catch (error) {
      console.error("Error adding review:", error);
    }
  };

  const handleVerify = async (reviewId: string) => {
    if (!isModerator) return;
    const reviewRef = doc(db, 'artifacts', appId, 'public', 'data', 'reviews', reviewId);
    await updateDoc(reviewRef, { isVerified: true });
  };

  const handleDelete = async () => {
    if (!isModerator || !deleteConfirmId) return;
    const reviewRef = doc(db, 'artifacts', appId, 'public', 'data', 'reviews', deleteConfirmId);
    await deleteDoc(reviewRef);
    setDeleteConfirmId(null);
  };

  const handlePostReply = async (reviewId: string) => {
    if (!isModerator || !adminReplyText.trim()) return;
    const reviewRef = doc(db, 'artifacts', appId, 'public', 'data', 'reviews', reviewId);
    await updateDoc(reviewRef, { 
      adminReply: adminReplyText,
      replyAt: new Date().toISOString()
    });
    setReplyingTo(null);
    setAdminReplyText('');
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (passInput === ADMIN_PASSWORD) {
      setIsModerator(true);
      setIsPassModalOpen(false);
      setPassInput('');
      setPassError(false);
    } else {
      setPassError(true);
    }
  };

  const StarRating = ({ rating, interactive = false, setRating = null, size = 16 }: any) => (
    <div className="flex gap-1 items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={interactive ? 24 : size}
          className={`${
            star <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
          } ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
          onClick={() => interactive && setRating && setRating(star)}
        />
      ))}
    </div>
  );

  const displayReviews = isModerator 
    ? reviews 
    : reviews.filter(r => r.isVerified);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {showNotification && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 border border-indigo-400">
            <div className="bg-white/20 p-1 rounded-full text-white">
              <Info size={18} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-white">Review Submitted!</p>
              <p className="text-xs text-indigo-100">Your review is now up for review by our staff before it goes public.</p>
            </div>
            <button onClick={() => setShowNotification(false)} className="text-white/60 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-xl font-bold mb-2">Are you sure?</h2>
            <p className="text-sm text-slate-500 mb-6">This action cannot be undone. This review will be permanently deleted from the community board.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)} 
                className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                No, Keep it
              </button>
              <button 
                onClick={handleDelete} 
                className="flex-1 py-3 text-white font-bold bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-200 transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <ShieldCheck className="w-6 h-6" />
            <span>TrustPanel</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => isModerator ? setIsModerator(false) : setIsPassModalOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                isModerator 
                ? 'bg-amber-100 text-amber-700 border-amber-200' 
                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {isModerator ? <Unlock size={14} /> : <Lock size={14} />}
              {isModerator ? "Exit Admin" : "Admin Login"}
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Review</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-4xl font-black mb-6 text-slate-900 tracking-tight">Customer Reviews</h1>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-12 bg-slate-50 rounded-3xl p-6 border border-slate-100 w-fit mx-auto shadow-sm">
            <div className="text-center sm:text-left px-4">
              <div className="text-3xl font-black text-slate-900">{totalReviews}</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Users size={12} /> Total Reviews
              </div>
            </div>
            
            <div className="hidden sm:block w-px h-10 bg-slate-200"></div>

            <div className="text-center sm:text-left px-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-slate-900">{averageRating}</span>
                <StarRating rating={Number(averageRating)} size={20} />
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Star size={12} className="fill-slate-400" /> Average Rating
              </div>
            </div>
          </div>
          
          <p className="mt-8 text-slate-500 max-w-md mx-auto text-sm">
            {isModerator 
              ? "Administrator Mode active. You can verify, reply, or remove submissions." 
              : "We value your honest feedback. All reviews are checked for safety."}
          </p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
             <p className="text-slate-400 text-sm">Loading reviews...</p>
          </div>
        ) : displayReviews.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
            <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No verified reviews found yet.</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="mt-4 text-indigo-600 font-bold hover:underline"
            >
              Be the first to write one!
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {displayReviews.map((review) => (
              <div key={review.id} className="space-y-3">
                <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-all ${!review.isVerified ? 'border-amber-200 bg-amber-50/30 ring-4 ring-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${review.isVerified ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                        <User size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          {review.displayName}
                          {review.isVerified && (
                            <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-sm flex items-center gap-1 uppercase font-black">
                              <CheckCircle size={10} /> Verified
                            </span>
                          )}
                        </div>
                        <StarRating rating={review.rating} />
                      </div>
                    </div>
                    
                    {isModerator && (
                      <div className="flex gap-2">
                        {!review.isVerified && (
                          <button 
                            onClick={() => handleVerify(review.id)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors"
                          >
                            <CheckCircle size={14} /> Verify
                          </button>
                        )}
                        <button 
                          onClick={() => setReplyingTo(replyingTo === review.id ? null : review.id)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors"
                        >
                          <Reply size={14} /> Reply
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(review.id)}
                          className="bg-white hover:bg-red-50 text-red-600 border border-red-100 text-xs px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-600 italic leading-relaxed">"{review.comment}"</p>
                  
                  {isModerator && replyingTo === review.id && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <textarea 
                        className="w-full p-3 text-sm border border-indigo-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-indigo-50/30"
                        placeholder="Write your response as admin..."
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => setReplyingTo(null)} className="text-xs text-slate-400 font-medium">Cancel</button>
                        <button 
                          onClick={() => handlePostReply(review.id)}
                          className="bg-indigo-600 text-white text-xs px-4 py-1.5 rounded-md font-bold"
                        >
                          Post Reply
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {review.adminReply && (
                  <div className="ml-8 flex gap-3 animate-in slide-in-from-left-4 duration-300">
                    <div className="text-slate-300">
                      <CornerDownRight size={24} />
                    </div>
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex-1 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                          <ShieldCheck size={14} />
                        </div>
                        <span className="font-bold text-sm text-indigo-900">Admin Response</span>
                      </div>
                      <p className="text-indigo-800 text-sm">{review.adminReply}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black mb-6">Write a Review</h2>
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Your Rating</label>
                <StarRating rating={formData.rating} interactive={true} setRating={(v: number) => setFormData({...formData, rating: v})} />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Display Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. HappyCustomer123"
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  value={formData.displayName}
                  onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Feedback</label>
                <textarea 
                  placeholder="Tell us about your experience..."
                  required
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  value={formData.comment}
                  onChange={(e) => setFormData({...formData, comment: e.target.value})}
                ></textarea>
              </div>
              <p className="text-[11px] text-slate-400 bg-slate-100 p-3 rounded-lg flex items-center gap-2">
                <ShieldCheck size={14} className="text-indigo-400 shrink-0" />
                Safety First: All reviews are manually checked before they appear on our public board.
              </p>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-100">Post Review</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xs rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key size={24} />
            </div>
            <h2 className="text-lg font-bold mb-2">Admin Access</h2>
            <p className="text-xs text-slate-500 mb-6">Enter the verification code to manage reviews.</p>
            <form onSubmit={handleAdminAuth} className="space-y-4">
              <input 
                type="password" 
                placeholder="Enter password..."
                autoFocus
                className={`w-full px-4 py-3 border rounded-xl text-center outline-none transition-all ${passError ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-indigo-500 bg-slate-50'}`}
                value={passInput}
                onChange={(e) => {
                  setPassInput(e.target.value);
                  setPassError(false);
                }}
              />
              {passError && <p className="text-[10px] text-red-500 font-bold">Incorrect code. Try again.</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => {setIsPassModalOpen(false); setPassInput(''); setPassError(false);}} className="flex-1 py-2 text-slate-500 text-sm font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold">Unlock</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
