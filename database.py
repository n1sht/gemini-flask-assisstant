import sqlite3
from datetime import datetime
import json
import os

class ChatDatabase:
    def __init__(self, db_path='chat_history.db'):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database tables"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Create sessions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    title TEXT DEFAULT 'New Chat',
                    model_name TEXT DEFAULT 'gemini-1.5-flash'
                )
            ''')
            
            # Create messages table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    sender TEXT NOT NULL,
                    content TEXT NOT NULL,
                    formatted_content TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
                )
            ''')
            
            # Create index for faster queries
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_messages_session_id 
                ON messages (session_id)
            ''')
            
            conn.commit()
    
    def create_session(self, session_id, title=None):
        """Create a new chat session"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO sessions (id, title) 
                VALUES (?, ?)
            ''', (session_id, title or 'New Chat'))
            conn.commit()
    
    def get_session(self, session_id):
        """Get session details"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, created_at, updated_at, title, model_name 
                FROM sessions 
                WHERE id = ?
            ''', (session_id,))
            
            row = cursor.fetchone()
            if row:
                return {
                    'id': row[0],
                    'created_at': row[1],
                    'updated_at': row[2],
                    'title': row[3],
                    'model_name': row[4]
                }
            return None
    
    def get_all_sessions(self, limit=50):
        """Get all chat sessions, most recent first"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, created_at, updated_at, title, model_name,
                       (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id) as message_count
                FROM sessions 
                ORDER BY updated_at DESC 
                LIMIT ?
            ''', (limit,))
            
            sessions = []
            for row in cursor.fetchall():
                sessions.append({
                    'id': row[0],
                    'created_at': row[1],
                    'updated_at': row[2],
                    'title': row[3],
                    'model_name': row[4],
                    'message_count': row[5]
                })
            return sessions
    
    def add_message(self, session_id, sender, content, formatted_content=None):
        """Add a message to the chat history"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Insert message
            cursor.execute('''
                INSERT INTO messages (session_id, sender, content, formatted_content) 
                VALUES (?, ?, ?, ?)
            ''', (session_id, sender, content, formatted_content))
            
            # Update session's updated_at timestamp
            cursor.execute('''
                UPDATE sessions 
                SET updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            ''', (session_id,))
            
            # Auto-generate title from first user message if still default
            if sender == 'user':
                cursor.execute('''
                    UPDATE sessions 
                    SET title = ? 
                    WHERE id = ? AND title = 'New Chat'
                ''', (content[:50] + '...' if len(content) > 50 else content, session_id))
            
            conn.commit()
    
    def get_messages(self, session_id):
        """Get all messages for a session"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT sender, content, formatted_content, timestamp 
                FROM messages 
                WHERE session_id = ? 
                ORDER BY timestamp ASC
            ''', (session_id,))
            
            messages = []
            for row in cursor.fetchall():
                messages.append({
                    'sender': row[0],
                    'content': row[1],
                    'formatted_content': row[2],
                    'timestamp': row[3]
                })
            return messages
    
    def delete_session(self, session_id):
        """Delete a session and all its messages"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM sessions WHERE id = ?', (session_id,))
            conn.commit()
    
    def search_messages(self, query, limit=50):
        """Search messages across all sessions"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT m.session_id, s.title, m.sender, m.content, m.timestamp
                FROM messages m
                JOIN sessions s ON m.session_id = s.id
                WHERE m.content LIKE ?
                ORDER BY m.timestamp DESC
                LIMIT ?
            ''', (f'%{query}%', limit))
            
            results = []
            for row in cursor.fetchall():
                results.append({
                    'session_id': row[0],
                    'session_title': row[1],
                    'sender': row[2],
                    'content': row[3],
                    'timestamp': row[4]
                })
            return results
    
    def export_session(self, session_id, format='json'):
        """Export a session's chat history"""
        session = self.get_session(session_id)
        messages = self.get_messages(session_id)
        
        if format == 'json':
            return json.dumps({
                'session': session,
                'messages': messages
            }, indent=2)
        elif format == 'txt':
            text = f"Chat Session: {session['title']}\n"
            text += f"Created: {session['created_at']}\n"
            text += f"Model: {session['model_name']}\n"
            text += "=" * 50 + "\n\n"
            
            for msg in messages:
                text += f"{msg['sender'].upper()} [{msg['timestamp']}]:\n"
                text += f"{msg['content']}\n\n"
            
            return text
        else:
            raise ValueError(f"Unsupported format: {format}")