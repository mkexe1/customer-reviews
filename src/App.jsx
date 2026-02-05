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
import { Star, CheckCircle, User, ShieldCheck, Plus, Lock, Unlock, Trash2, Key, Reply, CornerDownRight, X, Info, AlertTriangle, Users } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'moderated-review-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModerator, setIsModerator] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [passError, setPassError] = useState(false);
  
  const [showNotification, setShowNotification] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
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
      const sorted = data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
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

  const handleSubmitReview = async (e) => {
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

  const handleVerify = async (reviewId) => {
    if (!isModerator || !user) return;
    const reviewRef = doc(db, 'artifacts', appId, 'public', 'data', 'reviews', reviewId);
    await updateDoc(reviewRef, { isVerified: true });
  };

  const handleDelete = async () => {
    if (!isModerator || !deleteConfirmId || !user) return;
    const reviewRef = doc(db, 'artifacts', appId, 'public', 'data', 'reviews', deleteConfirmId);
    await deleteDoc(reviewRef);
    setDeleteConfirmId(null);
  };

  const handlePostReply = async (reviewId) => {
    if (!isModerator || !adminReplyText.trim() || !user) return;
    const reviewRef = doc(db, 'artifacts', appId, 'public', 'data', 'reviews', reviewId);
    await updateDoc(reviewRef, { 
      adminReply: adminReplyText,
      replyAt: new Date().toISOString()
    });
    setReplyingTo(null);
    setAdminReplyText('');
  };

  const handleAdminAuth = (e) => {
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

  const StarRating = ({ rating, interactive = false, setRating = null, size = 16 }) => (
    <div className="flex gap-1 items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={interactive ? 24 : size}
          className={`${
            star <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
          } ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
          onClick={() => interactive && setRating(star)}
        />
      ))}
    </div>
  );

  const displayReviews = isModerator 
    ? reviews 
    : reviews.filter(r => r.isVerified);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Notifications */}
      {showNotification && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 z-50 animate-bounce">
          <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <Info size={18} />
            <p className="font-bold text-sm">Submitted for Admin review!</p>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center">
            <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-4">Delete this review?</h2>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2 bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <ShieldCheck />
            <span>TrustPanel</span>
          </div>
          <div className="flex gap-3">
             <button 
              onClick={() => isModerator ? setIsModerator(false) : setIsPassModalOpen(true)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200"
            >
              {isModerator ? "Logout Admin" : "Admin Login"}
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold">
              + New Review
            </button>
          </div>
        </div>
      </nav>

      <header className="bg-white border-b py-12 text-center">
        <h1 className="text-4xl font-black mb-4">Community Feedback</h1>
        <div className="inline-flex gap-8 bg-slate-50 p-6 rounded-3xl border">
          <div className="text-center">
            <div className="text-2xl font-black">{totalReviews}</div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Verified Reviews</div>
          </div>
          <div className="text-center border-l pl-8">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black">{averageRating}</span>
              <StarRating rating={Number(averageRating)} size={18} />
            </div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Avg Rating</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading feedback...</div>
        ) : displayReviews.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed">
            <p className="text-slate-400">No reviews yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {displayReviews.map((review) => (
              <div key={review.id} className="space-y-3">
                <div className={`bg-white p-6 rounded-2xl border ${!review.isVerified ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200 shadow-sm'}`}>
                  <div className="flex justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                        <User size={20} />
                      </div>
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          {review.displayName}
                          {review.isVerified && <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black">VERIFIED</span>}
                        </div>
                        <StarRating rating={review.rating} />
                      </div>
                    </div>
                    {isModerator && (
                      <div className="flex gap-2">
                        {!review.isVerified && <button onClick={() => handleVerify(review.id)} className="text-green-600 hover:bg-green-50 p-1 rounded"><CheckCircle size={20}/></button>}
                        <button onClick={() => setReplyingTo(replyingTo === review.id ? null : review.id)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"><Reply size={20}/></button>
                        <button onClick={() => setDeleteConfirmId(review.id)} className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 size={20}/></button>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-600 italic">"{review.comment}"</p>

                  {isModerator && replyingTo === review.id && (
                    <div className="mt-4 pt-4 border-t">
                      <textarea 
                        className="w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 ring-indigo-100" 
                        placeholder="Write a response..." 
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                      />
                      <button onClick={() => handlePostReply(review.id)} className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Post Response</button>
                    </div>
                  )}
                </div>

                {review.adminReply && (
                  <div className="ml-8 flex gap-3">
                    <CornerDownRight className="text-slate-300 mt-2" />
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck size={14} className="text-indigo-600" />
                        <span className="font-bold text-xs text-indigo-900">Admin Response</span>
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

      {/* Write Review Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-6">Leave a Review</h2>
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div className="flex justify-center p-4 bg-slate-50 rounded-2xl">
                <StarRating rating={formData.rating} interactive={true} setRating={(v) => setFormData({...formData, rating: v})} />
              </div>
              <input 
                type="text" 
                placeholder="Name" 
                required 
                className="w-full p-3 border rounded-xl"
                value={formData.displayName}
                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
              />
              <textarea 
                placeholder="Your experience..." 
                required 
                className="w-full p-3 border rounded-xl"
                rows="3"
                value={formData.comment}
                onChange={(e) => setFormData({...formData, comment: e.target.value})}
              />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 font-bold text-slate-400">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {isPassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xs rounded-2xl p-6 text-center shadow-2xl">
            <Key size={32} className="mx-auto text-amber-500 mb-4" />
            <h2 className="font-bold mb-6">Admin Password</h2>
            <form onSubmit={handleAdminAuth} className="space-y-4">
              <input 
                type="password" 
                placeholder="Code" 
                autoFocus 
                className={`w-full p-3 border rounded-xl text-center ${passError ? 'border-red-500' : ''}`}
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsPassModalOpen(false)} className="flex-1 text-slate-400">Back</button>
                <button type="submit" className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Enter</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
