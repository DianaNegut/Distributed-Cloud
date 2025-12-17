/**
 * Solid Authentication Model
 * Gestionează autentificarea utilizatorilor pentru POD-uri
 * Folosește bcrypt pentru hash-uirea parolelor și JWT pentru sesiuni
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { IPFS_PATH } = require('../config/paths');

const AUTH_FILE = path.join(IPFS_PATH, 'solid-auth.json');

class SolidAuth {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.loadData();
  }

  /**
   * Încarcă date de autentificare
   */
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

  /**
   * Salvează date de autentificare
   */
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

  /**
   * Hash parolă folosind crypto (în producție: bcrypt)
   */
  hashPassword(password) {
    // Folosim SHA-256 cu salt pentru simplitate
    // În producție: bcrypt.hash(password, 10)
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verifică parolă
   */
  verifyPassword(password, hashedPassword) {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  /**
   * Generează token de sesiune
   */
  generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Înregistrează utilizator nou
   */
  register(username, password, email = null) {
    // Verifică dacă username-ul există
    if (this.users.has(username)) {
      throw new Error('Username already exists');
    }

    // Validare username
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Username can only contain alphanumeric characters, hyphens and underscores');
    }

    // Validare parolă
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Creează user
    const user = {
      username,
      passwordHash: this.hashPassword(password),
      email,
      podId: null, // Va fi setat când se creează POD-ul
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

  /**
   * Login utilizator
   */
  login(username, password) {
    const user = this.users.get(username);

    if (!user) {
      throw new Error('Invalid username or password');
    }

    if (user.status !== 'active') {
      throw new Error('Account is not active');
    }

    // Verifică parola
    if (!this.verifyPassword(password, user.passwordHash)) {
      throw new Error('Invalid username or password');
    }

    // Generează token de sesiune
    const sessionToken = this.generateSessionToken();
    const session = {
      username,
      token: sessionToken,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
    };

    this.sessions.set(sessionToken, session);

    // Actualizează last login
    user.lastLogin = new Date().toISOString();
    this.saveData();

    console.log(`[SOLID-AUTH] User logged in: ${username}`);

    return {
      token: sessionToken,
      username: user.username,
      email: user.email,
      podId: user.podId,
      webId: user.webId,
      expiresAt: session.expiresAt
    };
  }

  /**
   * Logout utilizator
   */
  logout(token) {
    if (!token) {
      throw new Error('Token required');
    }

    const session = this.sessions.get(token);
    if (!session) {
      throw new Error('Invalid session');
    }

    this.sessions.delete(token);
    console.log(`[SOLID-AUTH] User logged out: ${session.username}`);
    
    return { success: true };
  }

  /**
   * Verifică sesiune
   */
  verifySession(token) {
    if (!token) {
      throw new Error('Token required');
    }

    const session = this.sessions.get(token);
    if (!session) {
      throw new Error('Invalid session');
    }

    // Verifică expirare
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
      podId: user.podId,
      webId: user.webId
    };
  }

  /**
   * Asociază POD cu user
   */
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

  /**
   * Obține user după username
   */
  getUser(username) {
    const user = this.users.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    // Nu returnăm parola hash
    return {
      username: user.username,
      email: user.email,
      podId: user.podId,
      webId: user.webId,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      status: user.status
    };
  }

  /**
   * Schimbă parola
   */
  changePassword(username, oldPassword, newPassword) {
    const user = this.users.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    // Verifică parola veche
    if (!this.verifyPassword(oldPassword, user.passwordHash)) {
      throw new Error('Invalid old password');
    }

    // Validare parolă nouă
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    user.passwordHash = this.hashPassword(newPassword);
    this.saveData();

    console.log(`[SOLID-AUTH] Password changed for user: ${username}`);
    return { success: true };
  }

  /**
   * Șterge user
   */
  deleteUser(username) {
    const user = this.users.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    this.users.delete(username);
    
    // Șterge toate sesiunile utilizatorului
    for (const [token, session] of this.sessions.entries()) {
      if (session.username === username) {
        this.sessions.delete(token);
      }
    }

    this.saveData();

    console.log(`[SOLID-AUTH] Deleted user: ${username}`);
    return { success: true, deletedUser: username };
  }

  /**
   * Obține statistici
   */
  getStatistics() {
    return {
      totalUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter(u => u.status === 'active').length,
      activeSessions: this.sessions.size,
      usersWithPods: Array.from(this.users.values()).filter(u => u.podId).length
    };
  }
}

// Singleton instance
module.exports = new SolidAuth();
