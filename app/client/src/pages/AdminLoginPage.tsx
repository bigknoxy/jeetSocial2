import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminLoginPage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!username.trim() || !password.trim()) {
            setError('Please enter both username and password');
            return;
        }

        setIsLoading(true);

        try {
            const authString = btoa(`${username.trim()}:${password.trim()}`);
            const res = await fetch('/admin/check-auth', {
                headers: {
                    'Authorization': `Basic ${authString}`
                }
            });

            if (res.ok) {
                // Store credentials for the session
                const authData = { username: username.trim(), password: password.trim() };
                sessionStorage.setItem('adminAuth', JSON.stringify(authData));

                // Add a small delay for the "success" feeling
                setTimeout(() => navigate('/admin'), 500);
            } else if (res.status === 401) {
                setError('Invalid username or password');
            } else {
                setError('Authentication failed. Please try again.');
            }
        } catch (err) {
            setError('Failed to connect to server');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="main-content">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, type: 'spring' }}
                className="login-container"
            >
                <div className="login-header">
                    <button onClick={() => navigate('/')} className="back-to-home">
                        <ArrowLeft size={16} />
                        Back to Home
                    </button>
                    <div className="logo-section">
                        <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                        >
                            <Shield size={64} className="logo-icon" />
                        </motion.div>
                        <h1 className="rainbow-text">Admin Login</h1>
                        <p>Content Management Dashboard</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="error-message"
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="form-group">
                        <label htmlFor="username">
                            <Lock size={16} className="input-icon" />
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter moderator username"
                            autoComplete="username"
                            autoFocus
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">
                            <Lock size={16} className="input-icon" />
                            Password
                        </label>
                        <div className="password-input-wrapper">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter moderator password"
                                autoComplete="current-password"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="toggle-password"
                                disabled={isLoading}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <motion.button
                        type="submit"
                        className="login-button"
                        disabled={isLoading || !username.trim() || !password.trim()}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {isLoading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <Shield size={18} className="animate-pulse" />
                                Authenticating...
                            </span>
                        ) : 'Login to Dashboard'}
                    </motion.button>
                </form>

                <div className="login-footer">
                    <p className="security-note">
                        🔒 Secure access restricted to authorized moderators only.
                    </p>
                </div>
            </motion.div>
        </main>
    );
}
