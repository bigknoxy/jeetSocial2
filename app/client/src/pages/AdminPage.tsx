import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Trash2, ArrowLeft, Heart, LogOut, AlertTriangle, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface Post {
    id: number;
    username: string;
    content: string;
    kindness_points: number;
    created_at: string;
}

export default function AdminPage() {
    const navigate = useNavigate();
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState<Set<number>>(new Set());
    const [auth, setAuth] = useState<boolean>(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [postToYeet, setPostToYeet] = useState<Post | null>(null);

    useEffect(() => {
        // #14: session is an HttpOnly cookie — no credentials in JS storage
        if (!sessionStorage.getItem('adminAuth')) {
            navigate('/admin/login');
            return;
        }
        setAuth(true);

        const fetchPosts = async () => {
            try {
                // Cookie sent automatically by the browser
                const res = await fetch('/admin/posts');

                if (res.ok) {
                    const data = await res.json();
                    setPosts(data);
                } else if (res.status === 401) {
                    sessionStorage.removeItem('adminAuth');
                    navigate('/admin/login');
                }
            } catch (err) {
                console.error('Failed to fetch posts', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPosts();

        // WebSocket for real-time updates
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(`${protocol}//${window.location.host}`);

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'DELETE_POST') {
                setPosts(prev => prev.filter(p => p.id !== data.postId));
            } else if (data.type === 'NEW_POST') {
                setPosts(prev => [data.post, ...prev]);
            }
        };

        return () => socket.close();
    }, [navigate]);

    const handleDelete = (post: Post) => {
        setPostToYeet(post);
        setShowConfirm(true);
    };

    const confirmedDelete = async () => {
        if (!auth || !postToYeet) return;

        const postId = postToYeet.id;
        setShowConfirm(false);
        setIsDeleting(prev => new Set(prev).add(postId));

        try {
            // Cookie sent automatically by the browser (#14)
            const res = await fetch(`/admin/posts/${postId}`, { method: 'DELETE' });

            if (res.ok) {
                setPosts(prev => prev.filter(p => p.id !== postId));
            } else if (res.status === 401) {
                sessionStorage.removeItem('adminAuth');
                navigate('/admin/login');
            }
        } catch (err) {
            alert('Failed to connect to server');
        } finally {
            setIsDeleting(prev => {
                const next = new Set(prev);
                next.delete(postId);
                return next;
            });
            setPostToYeet(null);
        }
    };

    const handleLogout = async () => {
        await fetch('/admin/logout', { method: 'POST' }).catch(() => {});
        sessionStorage.removeItem('adminAuth');
        navigate('/admin/login');
    };

    if (!auth && !isLoading) return null;

    return (
        <main className="main-content">
            <header className="admin-header-bar">
                <Link to="/" className="back-link">
                    <ArrowLeft size={16} />
                    Back to Feed
                </Link>
                <div className="admin-title">
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <Shield size={32} />
                    </motion.div>
                    <h1 className="rainbow-text">Moderation Dashboard</h1>
                </div>
                <button onClick={handleLogout} className="logout-button">
                    <LogOut size={16} />
                    Log Out
                </button>
            </header>

            <section className="admin-stats">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                >
                    <h3>{posts.length}</h3>
                    <p>Active Posts</p>
                </motion.div>
            </section>

            <div className="admin-feed">
                {isLoading ? (
                    <div className="loading">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            style={{ display: 'inline-block', marginBottom: '1rem' }}
                        >
                            <Shield size={32} />
                        </motion.div>
                        <p>Loading active posts...</p>
                    </div>
                ) : posts.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="empty"
                    >
                        <Shield size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <p>No posts currently await moderation.</p>
                    </motion.div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {posts.map(post => (
                            <motion.div
                                key={post.id}
                                className="post-card admin-post-card"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                                layout
                            >
                                <div className="post-header">
                                    <span className="username">{post.username}</span>
                                    <span className="time">{formatDistanceToNow(new Date(post.created_at.replace(' ', 'T') + 'Z'))} ago</span>
                                </div>
                                <p className="content">{post.content}</p>
                                <div className="post-actions">
                                    <div className="kindness-points">
                                        <Heart size={14} fill="currentColor" />
                                        {post.kindness_points} points
                                    </div>
                                    <motion.button
                                        onClick={() => handleDelete(post)}
                                        className="delete-btn"
                                        disabled={isDeleting.has(post.id)}
                                        whileHover={{ backgroundColor: '#ff0000' }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Trash2 size={16} />
                                        {isDeleting.has(post.id) ? 'Yeeting...' : 'Yeet Post'}
                                    </motion.button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            <AnimatePresence>
                {showConfirm && (
                    <div className="modal-overlay">
                        <motion.div
                            className="confirm-modal"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        >
                            <div className="modal-header">
                                <div className="warning-icon">
                                    <AlertTriangle size={48} />
                                </div>
                                <h2>Yeet Confirmation</h2>
                            </div>

                            <div className="modal-body">
                                <p>Are you sure you want to yeet this post? This action is permanent and cannot be undone.</p>
                                {postToYeet && (
                                    <div className="post-preview">
                                        "{postToYeet.content}"
                                    </div>
                                )}
                            </div>

                            <div className="modal-actions">
                                <button
                                    onClick={() => {
                                        setShowConfirm(false);
                                        setPostToYeet(null);
                                    }}
                                    className="cancel-btn"
                                >
                                    <X size={18} />
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmedDelete}
                                    className="confirm-btn"
                                >
                                    <Trash2 size={18} />
                                    Yeet It!
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </main>
    );
}
