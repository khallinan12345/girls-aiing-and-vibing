// src/pages/tech-skills/BackEndDevelopmentPage.tsx

import React, { useState, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import Editor from '@monaco-editor/react';
import {
  Database,
  Play,
  RotateCcw,
  Construction,
  Copy,
  Check,
  Terminal,
  FileCode,
  ChevronDown,
} from 'lucide-react';

type FileTab = {
  name: string;
  language: string;
  code: string;
};

const DEFAULT_FILES: FileTab[] = [
  {
    name: 'server.js',
    language: 'javascript',
    code: `// Express.js Server — Back-End Development
const express = require('express');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// In-memory data store (replace with a real database!)
let users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Carol', email: 'carol@example.com', role: 'user' },
];

// GET all users
app.get('/api/users', (req, res) => {
  res.json({ success: true, data: users });
});

// GET a single user by ID
app.get('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, data: user });
});

// POST — create a new user
app.post('/api/users', (req, res) => {
  const { name, email, role } = req.body;
  const newUser = {
    id: users.length + 1,
    name,
    email,
    role: role || 'user',
  };
  users.push(newUser);
  res.status(201).json({ success: true, data: newUser });
});

// DELETE a user
app.delete('/api/users/:id', (req, res) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  users.splice(index, 1);
  res.json({ success: true, message: 'User deleted' });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
`,
  },
  {
    name: 'schema.sql',
    language: 'sql',
    code: `-- Database Schema for a Users & Posts Application
-- Run this in PostgreSQL or adapt for your database

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  role        VARCHAR(20) DEFAULT 'user',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  body        TEXT,
  published   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_users_email ON users(email);

-- Sample data
INSERT INTO users (name, email, role) VALUES
  ('Alice', 'alice@example.com', 'admin'),
  ('Bob', 'bob@example.com', 'user'),
  ('Carol', 'carol@example.com', 'user');

INSERT INTO posts (user_id, title, body, published) VALUES
  (1, 'Getting Started with SQL', 'Learn the basics of SQL...', TRUE),
  (2, 'My First API', 'Building a REST API with Express...', TRUE),
  (1, 'Draft Post', 'This is still a work in progress.', FALSE);

-- Useful queries to try:
-- SELECT * FROM users;
-- SELECT p.title, u.name FROM posts p JOIN users u ON p.user_id = u.id;
-- SELECT u.name, COUNT(p.id) AS post_count FROM users u LEFT JOIN posts p ON u.id = p.user_id GROUP BY u.name;
`,
  },
  {
    name: '.env',
    language: 'plaintext',
    code: `# Environment Variables
# Copy this to .env and fill in your values

DATABASE_URL=postgresql://user:password@localhost:5432/myapp
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
`,
  },
];

const BackEndDevelopmentPage: React.FC = () => {
  const [files, setFiles] = useState<FileTab[]>(DEFAULT_FILES);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([
    '$ Welcome to Back-End Development Console',
    '$ Type your queries and logic here. Click "Run" to simulate execution.',
    '',
  ]);
  const [copied, setCopied] = useState(false);
  const [showConsole, setShowConsole] = useState(true);

  const activeFile = files[activeFileIndex];

  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      setFiles((prev) => {
        const updated = [...prev];
        updated[activeFileIndex] = {
          ...updated[activeFileIndex],
          code: value || '',
        };
        return updated;
      });
    },
    [activeFileIndex]
  );

  const handleRun = useCallback(() => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleOutput((prev) => [
      ...prev,
      `[${timestamp}] ▶ Running ${activeFile.name}...`,
      `[${timestamp}] ✓ Syntax check passed`,
      activeFile.language === 'sql'
        ? `[${timestamp}] ✓ SQL parsed successfully — 3 statements ready`
        : `[${timestamp}] ✓ Server would start on http://localhost:3000`,
      '',
    ]);
  }, [activeFile]);

  const handleReset = useCallback(() => {
    setFiles(DEFAULT_FILES);
    setActiveFileIndex(0);
    setConsoleOutput([
      '$ Files reset to defaults.',
      '',
    ]);
  }, []);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeFile.code]);

  return (
    <div className="flex min-h-screen">
      <AppLayout>
        <main className="flex-1 flex flex-col bg-gray-900 min-h-screen">
          {/* Top Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-orange-400" />
              <h1 className="text-xl font-bold text-white">
                Back-End Development
              </h1>
              <span className="text-sm text-gray-400">
                Server / Database / API
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConsole(!showConsole)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  showConsole
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <Terminal size={16} />
                Console
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RotateCcw size={16} />
                Reset
              </button>
              <button
                onClick={handleRun}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors shadow-lg shadow-orange-900/30"
              >
                <Play size={16} />
                Run
              </button>
            </div>
          </div>

          {/* Under Construction Banner */}
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/20 border-b border-amber-500/30">
            <Construction className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">
              🚧 Under Construction — Database connectivity, live execution, and guided challenges coming soon!
            </span>
            <Construction className="h-5 w-5 text-amber-400" />
          </div>

          {/* File Tabs */}
          <div className="flex items-center bg-gray-800/60 border-b border-gray-700 px-2">
            {files.map((file, idx) => (
              <button
                key={file.name}
                onClick={() => setActiveFileIndex(idx)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  idx === activeFileIndex
                    ? 'border-orange-400 text-white bg-gray-900/50'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <FileCode size={14} />
                {file.name}
              </button>
            ))}
          </div>

          {/* Editor + Console */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Editor */}
            <div className={`${showConsole ? 'flex-[3]' : 'flex-1'} min-h-0`}>
              <Editor
                height="100%"
                language={activeFile.language}
                value={activeFile.code}
                onChange={handleCodeChange}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  padding: { top: 12 },
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </div>

            {/* Console Panel */}
            {showConsole && (
              <div className="flex-1 min-h-0 border-t border-gray-700 bg-gray-950 flex flex-col">
                <div className="flex items-center justify-between px-4 py-1.5 bg-gray-800/80 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-orange-400" />
                    <span className="text-sm font-semibold text-gray-300">
                      Console Output
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setConsoleOutput(['$ Console cleared.', ''])
                    }
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-sm text-green-400 space-y-0.5">
                  {consoleOutput.map((line, i) => (
                    <div key={i} className={line.includes('✗') ? 'text-red-400' : ''}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </AppLayout>
    </div>
  );
};

export default BackEndDevelopmentPage;
