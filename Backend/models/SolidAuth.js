const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { IPFS_PATH } = require('../config/paths');

const AUTH_FILE = path.join(IPFS_PATH, 'solid-auth.json');
const SESSION_FILE = path.join(IPFS_PATH, 'solid-sessions.json');

class SolidAuth {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.loadData();
    this.loadSessions();
    setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000);
  }

  loadData() {
    try {
      if (fs.existsSync(AUTH_FILE)) {
        const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
        this.users = new Map(Object.entries(data.users || {}));
        console.log(`[SOLID-AUTH] Loaded ${this.users.size} users`);
      } else {
        this.saveData();
      }
    } catch (error) {
      console.error('[SOLID-AUTH] Error loading data:', error.message);
      this.users = new Map();
    }
  }

  saveData() {
    try {
      const dir = path.dirname(AUTH_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        users: Object.fromEntries(this.users)
      };

      fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[SOLID-AUTH] Error saving data:', error.message);
      throw error;
    }
  }

  loadSessions() {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
        this.sessions = new Map(Object.entries(data.sessions || {}));
        console.log(`[SOLID-AUTH] Loaded ${this.sessions.size} active sessions`);
        this.cleanupExpiredSessions();
      }
    } catch (error) {
      console.error('[SOLID-AUTH] Error loading sessions:', error.message);
      this.sessions = new Map();
    }
  }

  saveSessions() {
    try {
      const dir = path.dirname(SESSION_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        sessions: Object.fromEntries(this.sessions)
      };

      fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[SOLID-AUTH] Error saving sessions:', error.message);
    }
  }

  cleanupExpiredSessions() {
    const now = new Date();
    let cleaned = 0;

    for (const [token, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt) < now) {
        this.sessions.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[SOLID-AUTH] Cleaned up ${cleaned} expired sessions`);
      this.saveSessions();
    }
  }

  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password, hashedPassword) {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  register(username, password, email = null) {
    if (this.users.has(username)) {
      throw new Error('Username already exists');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Username can only contain alphanumeric characters, hyphens and underscores');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const isFirstUser = this.users.size === 0;
    const role = (isFirstUser || username.toLowerCase() === 'admin') ? 'admin' : 'user';

    const user = {
      username,
      passwordHash: this.hashPassword(password),
      email,
      role,
      podId: null,
      webId: null,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      status: 'active'
    };

    this.users.set(username, user);
    this.saveData();

    console.log(`[SOLID-AUTH] Registered user: ${username}`);

    return {
      username: user.username,
      email: user.email,
      createdAt: user.createdAt
    };
  }

  login(username, password) {
    const user = this.users.get(username);

    if (!user) {
      throw new Error('Invalid username or password');
    }

    if (user.status !== 'active') {
      throw new Error('Account is not active');
    }

    if (!this.verifyPassword(password, user.passwordHash)) {
      throw new Error('Invalid username or password');
    }

    const sessionToken = this.generateSessionToken();
    const session = {
      username,
      token: sessionToken,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    this.sessions.set(sessionToken, session);
    this.saveSessions();

    user.lastLogin = new Date().toISOString();
    this.saveData();

    console.log(`[SOLID-AUTH] User logged in: ${username}`);

    return {
      token: sessionToken,
      username: user.username,
      email: user.email,
      role: user.role,
      podId: user.podId,
      webId: user.webId,
      expiresAt: session.expiresAt
    };
  }

  logout(token) {
    if (!token) {
      throw new Error('Token required');
    }

    const session = this.sessions.get(token);
    if (!session) {
      throw new Error('Invalid session');
    }

    this.sessions.delete(token);
    this.saveSessions();
    console.log(`[SOLID-AUTH] User logged out: ${session.username}`);

    return { success: true };
  }

  verifySession(token) {
    if (!token) {
      throw new Error('Token required');
    }

    const session = this.sessions.get(token);
    if (!session) {
      throw new Error('Invalid session');
    }

    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(token);
      throw new Error('Session expired');
    }

    const user = this.users.get(session.username);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      username: user.username,
      email: user.email,
      role: user.role,
      podId: user.podId,
      webId: user.webId
    };
  }

  setPodForUser(username, podId, webId) {
    const user = this.users.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    user.podId = podId;
    user.webId = webId;
    this.saveData();

    console.log(`[SOLID-AUTH] Associated POD ${podId} with user ${username}`);
    return user;
  }

  getUser(username) {
    const user = this.users.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      username: user.username,
      email: user.email,
      role: user.role,
      podId: user.podId,
      webId: user.webId,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      status: user.status
    };
  }

  changePassword(username, oldPassword, newPassword) {
    const user = this.users.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    if (!this.verifyPassword(oldPassword, user.passwordHash)) {
      throw new Error('Invalid old password');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    user.passwordHash = this.hashPassword(newPassword);
    this.saveData();

    console.log(`[SOLID-AUTH] Password changed for user: ${username}`);
    return { success: true };
  }

  deleteUser(username) {
    const user = this.users.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    this.users.delete(username);

    for (const [token, session] of this.sessions.entries()) {
      if (session.username === username) {
        this.sessions.delete(token);
      }
    }

    this.saveData();

    console.log(`[SOLID-AUTH] Deleted user: ${username}`);
    return { success: true, deletedUser: username };
  }

  getStatistics() {
    return {
      totalUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter(u => u.status === 'active').length,
      activeSessions: this.sessions.size,
      usersWithPods: Array.from(this.users.values()).filter(u => u.podId).length
    };
  }
}

module.exports = new SolidAuth();
