import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Heart, Smile, Target, Shield, HelpCircle, LifeBuoy, Info, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { X } from 'lucide-react';
import AdminPage from './pages/AdminPage';
import AdminLoginPage from './pages/AdminLoginPage';

interface Toast {
    id: number;
    message: string;
    type: 'info' | 'error' | 'success';
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[], removeToast: (id: number) => void }) {
    return (
        <div className="toast-container">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, x: 20, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.9 }}
                        className={`toast toast-${toast.type}`}
                        onClick={() => removeToast(toast.id)}
                    >
                        <div className="toast-content">
                            {toast.type === 'error' ? <Shield size={18} /> : <Info size={18} />}
                            <span>{toast.message}</span>
                        </div>
                        <button className="toast-close">
                            <X size={14} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

interface Post {
    id: number;
    username: string;
    content: string;
    kindness_points: number;
    created_at: string;
}

function Header() {
    return (
        <header className="site-header">
            <div className="top-bar">
                <div className="mission-statement">
                    <Link to="/" className="rainbow-text">jeetSocial</Link> exists to spread and encourage kindness. Share something uplifting or supportive today!
                </div>
            </div>
            <div className="rainbow-border" />
        </header>
    );
}

function Footer() {
    return (
        <footer className="footer">
            © 2025 jeetSocial | <a href="https://github.com/bigknoxy/jeetSocial2" target="_blank" rel="noopener noreferrer">GitHub</a>
        </footer>
    );
}

function HomePage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [view, setView] = useState<'recent' | 'top'>('recent');
    const [content, setContent] = useState('');
    const [postOnEnter, setPostOnEnter] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const ws = useRef<WebSocket | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchPosts();
        connectWebSocket();

        const timer = setInterval(() => {
            setPosts(current => [...current]);
        }, 60000);

        const savedLikes = localStorage.getItem('likedPosts');
        if (savedLikes) {
            setLikedPosts(new Set(JSON.parse(savedLikes)));
        }

        return () => {
            if (ws.current) ws.current.close();
            clearInterval(timer);
        };
    }, [view]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const connectWebSocket = () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(`${protocol}//${window.location.host}`);

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'NEW_POST') {
                setPosts(prev => [data.post, ...prev].slice(0, 50));
            } else if (data.type === 'UPDATE_POST') {
                setPosts(prev => prev.map(p => p.id === data.post.id ? data.post : p));
            } else if (data.type === 'DELETE_POST') {
                setPosts(prev => prev.filter(p => p.id !== data.postId));
            }
        };

        socket.onclose = () => {
            setTimeout(connectWebSocket, 3000);
        };

        ws.current = socket;
    };

    const addToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 5000);
    };

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const fetchPosts = async () => {
        try {
            const res = await fetch(`/posts?type=${view}`);
            const data = await res.json();
            setPosts(data);
        } catch (e) {
            console.error('Failed to fetch posts', e);
        }
    };

    const handlePost = async () => {
        if (!content.trim() || content.length > 280 || isLoading) return;

        setIsLoading(true);
        try {
            const res = await fetch('/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });

            const data = await res.json();
            if (res.ok) {
                setContent('');
                setShowEmojiPicker(false);
                addToast('Kindness yeeted successfully! ✨', 'success');
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#facc15', '#ff6b6b', '#4ecdc4']
                });
            } else {
                addToast(data.error || 'Something went wrong', 'error');
            }
        } catch (e) {
            addToast('Failed to connect to server', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLike = async (postId: number) => {
        if (likedPosts.has(postId)) return;

        try {
            const clientId = localStorage.getItem('clientId') || Math.random().toString(36).substring(7);
            localStorage.setItem('clientId', clientId);

            const res = await fetch(`/posts/${postId}/like`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-client-id': clientId
                }
            });

            if (res.ok) {
                const newLiked = new Set(likedPosts).add(postId);
                setLikedPosts(newLiked);
                localStorage.setItem('likedPosts', JSON.stringify(Array.from(newLiked)));
            }
        } catch (e) {
            console.error('Failed to like post', e);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (postOnEnter && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handlePost();
        }
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end);

        const newText = before + emojiData.emoji + after;
        if (newText.length <= 280) {
            setContent(newText);
            // Re-focus and set cursor position after a small delay
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(
                    start + emojiData.emoji.length,
                    start + emojiData.emoji.length
                );
            }, 0);
        }
    };

    return (
        <main className="main-content">
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <section className="card brand-section">
                <div className="brand-header">
                    <motion.img
                        src="/favicon.png"
                        alt="Mascot"
                        className="brand-mascot"
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: 0.5, type: 'spring' }}
                    />
                    <h1 className="rainbow-text">jeetSocial</h1>
                </div>
                <p className="hero-intro">
                    A safe, anonymous space to spread kindness and support.
                </p>

                <div className="quick-facts">
                    <div className="fact-item"><Shield size={16} /> Anonymous</div>
                    <div className="fact-item"><Smile size={16} /> Random Usernames</div>
                    <div className="fact-item"><Heart size={16} /> 100% Kind</div>
                </div>

                <Link to="/about" className="learn-more rainbow-text">
                    Learn more about our kindness mission →
                </Link>

                <div className="share-section">
                    <h2>Share a message</h2>
                    <div className="post-form">
                        <div className="textarea-container">
                            <textarea
                                ref={textareaRef}
                                placeholder="Share something kind..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                onKeyDown={handleKeyDown}
                                maxLength={280}
                            />
                            <div className="char-counter">{content.length}/280</div>
                        </div>

                        <div className="form-controls">
                            <AnimatePresence>
                                {showEmojiPicker && (
                                    <motion.div
                                        ref={pickerRef}
                                        className="emoji-picker-container"
                                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                    >
                                        <EmojiPicker
                                            theme={Theme.DARK}
                                            onEmojiClick={onEmojiClick}
                                            autoFocusSearch={false}
                                            lazyLoadEmojis={true}
                                            previewConfig={{ showPreview: false }}
                                            width={300}
                                            height={400}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div className="mobile-hide" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <Smile
                                    size={20}
                                    cursor="pointer"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    color={showEmojiPicker ? '#4ecdc4' : 'currentColor'}
                                />
                                <div className="toggle-group">
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={postOnEnter}
                                            onChange={(e) => setPostOnEnter(e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                    <span>Post on Enter</span>
                                </div>
                            </div>

                            <button
                                className="post-button"
                                onClick={handlePost}
                                disabled={isLoading || !content.trim()}
                            >
                                {isLoading ? '...' : 'Post'}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <div className="feed-header">
                <h2>{view === 'recent' ? 'Recent Posts' : 'Top Posts'}</h2>
                <div className="toggle-tabs">
                    <button
                        className={`tab-btn ${view === 'recent' ? 'active' : ''}`}
                        onClick={() => setView('recent')}
                    >
                        Recent
                    </button>
                    <button
                        className={`tab-btn ${view === 'top' ? 'active' : ''}`}
                        onClick={() => setView('top')}
                    >
                        Top
                    </button>
                </div>
            </div>

            <div className="feed">
                <AnimatePresence initial={false}>
                    {posts.map((post) => (
                        <motion.div
                            key={post.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="post-card"
                        >
                            <div className="post-meta">
                                <span className="post-username">{post.username}</span>
                                <span className="post-time">{formatDistanceToNow(new Date(post.created_at.replace(' ', 'T') + 'Z'))} ago</span>
                            </div>
                            <div className="post-content">{post.content}</div>
                            <div className="post-actions">
                                <div className="kindness-points">
                                    <Heart size={16} fill="currentColor" />
                                    {post.kindness_points}
                                </div>
                                <button
                                    className={`like-button ${likedPosts.has(post.id) ? 'liked' : ''}`}
                                    onClick={() => handleLike(post.id)}
                                >
                                    <Heart size={20} fill={likedPosts.has(post.id) ? 'currentColor' : 'none'} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </main>
    );
}

function AboutPage() {
    return (
        <main className="main-content">
            <div className="about-card">
                <section className="about-hero">
                    <h1>About jeetSocial</h1>
                    <p className="hero-intro">
                        Welcome to a safe, anonymous space for sharing kindness and positivity.
                    </p>

                    <div className="quick-facts">
                        <div className="fact-item"><Shield size={16} /> Anonymous</div>
                        <div className="fact-item"><Smile size={16} /> Random Usernames</div>
                        <div className="fact-item"><Heart size={16} /> 100% Kind</div>
                    </div>

                    <motion.div
                        className="yeet-callout"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className="why-jeet-badge">The Philosophy</div>
                        <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Why "jeet"?</h2>
                        <p style={{ fontSize: '1.2rem', color: '#4ecdc4', fontWeight: 600 }}>
                            It's simple: "just yeet" kindness into the world!
                        </p>
                        <p style={{ marginTop: '1rem', opacity: 0.9, lineHeight: 1.6 }}>
                            Sometimes you gotta yeet some positivity out there. No overthinking, just pure, unfiltered good vibes launched into the universe.
                        </p>
                    </motion.div>

                    <div className="quote-container">
                        <p className="quote-text">“One kind word can change someone’s entire day.”</p>
                    </div>
                </section>

                <div className="about-grid">
                    <div className="about-sub-section">
                        <div className="section-icon-header">
                            <Target size={24} />
                            <h2>Our Mission</h2>
                        </div>
                        <p>jeetSocial is a safe, anonymous space to share kindness, support, and positivity. Our mission is to make the internet a little brighter, one uplifting message at a time.</p>
                    </div>

                    <div className="about-sub-section">
                        <div className="section-icon-header">
                            <Heart size={24} />
                            <h2>Kindness Manifesto</h2>
                        </div>
                        <div className="manifesto-content" style={{ fontSize: '0.95rem' }}>
                            <p className="manifesto-item">✨ We believe everyone deserves encouragement.</p>
                            <p className="manifesto-item">🌍 We celebrate diversity, empathy, and the power of uplifting words.</p>
                            <p className="manifesto-item">🤝 We support each other, no matter who we are.</p>
                            <p className="manifesto-item">💖 We choose kindness, always.</p>
                        </div>
                    </div>
                </div>

                <div className="about-sub-section guidelines-card" style={{ marginBottom: '2rem' }}>
                    <div className="section-icon-header">
                        <Shield size={24} />
                        <h2>Community Guidelines & Safety</h2>
                    </div>
                    <div className="about-grid" style={{ marginBottom: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                        <div>
                            <h3>Guidelines</h3>
                            <ul style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem' }}>
                                <li>Be kind and respectful.</li>
                                <li>No hate, bullying, or negativity.</li>
                                <li>Support others—uplift, don’t tear down.</li>
                                <li>All posts are anonymous; respect privacy.</li>
                            </ul>
                        </div>
                        <div>
                            <h3>How Moderation Works</h3>
                            <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                                All posts are checked for hate or unkind language using a simple word filter.
                                We never collect personal data, and all posts are anonymous.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="about-grid">
                    <div className="about-sub-section">
                        <div className="section-icon-header">
                            <LifeBuoy size={24} />
                            <h2>Kindness Resources</h2>
                        </div>
                        <div className="resources-grid">
                            <a href="https://www.mhanational.org/" className="resource-tile" target="_blank" rel="noopener noreferrer">MHA</a>
                            <a href="https://kindness.org/" className="resource-tile" target="_blank" rel="noopener noreferrer">Kindness.org</a>
                            <a href="https://www.7cups.com/" className="resource-tile" target="_blank" rel="noopener noreferrer">7 Cups</a>
                        </div>
                    </div>

                    <div className="about-sub-section">
                        <div className="section-icon-header">
                            <MessageSquare size={24} />
                            <h2>Feedback & Ideas</h2>
                        </div>
                        <p>Have ideas to make jeetSocial kinder? Contribute to our community!</p>
                        <a href="https://github.com/bigknoxy/jeetSocial2/issues" className="resource-link" style={{ marginTop: '1rem' }} target="_blank" rel="noopener noreferrer">
                            Report Issue on GitHub
                        </a>
                    </div>
                </div>

                <Link to="/" className="post-button back-button">← Back to jeetSocial</Link>
            </div>
        </main>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <div className="app-container">
                <Header />
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/admin/login" element={<AdminLoginPage />} />
                </Routes>
                <Footer />
            </div>
        </BrowserRouter>
    );
}
