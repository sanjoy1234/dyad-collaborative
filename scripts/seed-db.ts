#!/usr/bin/env tsx
/**
 * Database Seeding Script
 * Creates test users and sample projects for development and testing
 */

import postgres from 'postgres';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:dyadpass123@localhost:5432/dyad_collaborative';

const sql = postgres(DATABASE_URL);

interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string;
  role: string;
}

const TEST_USERS: Omit<TestUser, 'id'>[] = [
  {
    email: 'dev1@test.com',
    username: 'dev1',
    password: 'Test123!',
    role: 'developer',
  },
  {
    email: 'dev2@test.com',
    username: 'dev2',
    password: 'Test123!',
    role: 'developer',
  },
  {
    email: 'dev3@test.com',
    username: 'dev3',
    password: 'Test123!',
    role: 'developer',
  },
  {
    email: 'admin@test.com',
    username: 'admin',
    password: 'Admin123!',
    role: 'admin',
  },
];

async function seedUsers(): Promise<TestUser[]> {
  console.log('🌱 Seeding users...');
  
  const users: TestUser[] = [];
  
  for (const userData of TEST_USERS) {
    const passwordHash = await bcrypt.hash(userData.password, 10);
    const id = uuidv4();
    
    try {
      await pool.query(
        `INSERT INTO users (id, email, username, password_hash, role, is_active, email_verified, created_at)
         VALUES ($1, $2, $3, $4, $5, true, true, NOW())
         ON CONFLICT (email) DO UPDATE 
         SET password_hash = $4, role = $5, updated_at = NOW()
         RETURNING id`,
        [id, userData.email, userData.username, passwordHash, userData.role]
      );
      
      users.push({ id, ...userData });
      console.log(`  ✅ Created user: ${userData.username} (${userData.email})`);
    } catch (error) {
      console.error(`  ❌ Error creating user ${userData.username}:`, error);
    }
  }
  
  return users;
}

async function seedProjects(users: TestUser[]): Promise<string[]> {
  console.log('\n🌱 Seeding projects...');
  
  const projectIds: string[] = [];
  
  // Create a shared project for all developers
  const projectId = uuidv4();
  const ownerId = users.find(u => u.username === 'dev1')?.id;
  
  if (!ownerId) {
    console.error('  ❌ Could not find dev1 user');
    return projectIds;
  }
  
  try {
    await pool.query(
      `INSERT INTO projects (id, name, description, owner_id, visibility, max_collaborators, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        projectId,
        'Collaborative Demo Project',
        'A sample project for testing multi-developer collaboration',
        ownerId,
        'team',
        50,
      ]
    );
    
    projectIds.push(projectId);
    console.log(`  ✅ Created project: Collaborative Demo Project`);
    
    // Add collaborators
    for (const email of ['dev1@test.com', 'dev2@test.com', 'dev3@test.com']) {
      await sql`
        INSERT INTO project_collaborators (project_id, user_id, role, invited_by, joined_at)
        VALUES (${projectId}, ${userIds[email]}, ${email === 'dev1@test.com' ? 'owner' : 'editor'}, ${userIds['dev1@test.com']}, NOW())
      `;
      console.log(`✓ Added collaborator: ${email}`);
    }
  } catch (error) {
    console.error('  ❌ Error creating project:', error);
  }
  
  return projectIds;
}

async function seedFiles(projectIds: string[], users: TestUser[]): Promise<void> {
  console.log('\n🌱 Seeding sample files...');
  
  if (projectIds.length === 0) {
    console.log('  ⚠️  No projects to seed files for');
    return;
  }
  
  const projectId = projectIds[0];
  const creatorId = users.find(u => u.username === 'dev1')?.id;
  
  if (!creatorId) {
    console.error('  ❌ Could not find creator user');
    return;
  }
  
  const sampleFiles = [
    {
      path: 'README.md',
      content: `# Collaborative Demo Project

Welcome to the Dyad Collaborative demo!

## Getting Started

This is a sample project to demonstrate real-time collaboration features.

### Features
- Real-time code editing
- Live cursor tracking
- Presence indicators
- Conflict resolution

## Team Members
- dev1, dev2, dev3

Happy coding!`,
      fileType: 'markdown',
    },
    {
      path: 'src/App.tsx',
      content: `import React from 'react';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to Dyad Collaborative</h1>
        <p>Edit this file to see real-time collaboration in action!</p>
      </header>
    </div>
  );
}

export default App;`,
      fileType: 'typescript',
    },
    {
      path: 'src/components/Button.tsx',
      content: `import React from 'react';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export function Button({ onClick, children, variant = 'primary' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={\`btn btn-\${variant}\`}
    >
      {children}
    </button>
  );
}`,
      fileType: 'typescript',
    },
    {
      path: 'src/styles/globals.css',
      content: `:root {
  --primary-color: #0070f3;
  --secondary-color: #7928ca;
  --background: #ffffff;
  --foreground: #000000;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto';
  background: var(--background);
  color: var(--foreground);
}

.App-header {
  padding: 2rem;
  text-align: center;
}`,
      fileType: 'css',
    },
    {
      path: 'package.json',
      content: `{
  "name": "demo-project",
  "version": "1.0.0",
  "description": "Collaborative demo project",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "14.0.0"
  }
}`,
      fileType: 'json',
    },
  ];
  
  for (const file of sampleFiles) {
    try {
      const fileId = uuidv4();
      const sizeBytes = Buffer.byteLength(file.content, 'utf8');
      
      await pool.query(
        `INSERT INTO project_files (id, project_id, path, content, file_type, size_bytes, version, created_by, updated_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $7, NOW(), NOW())
         ON CONFLICT (project_id, path) DO UPDATE
         SET content = $4, updated_at = NOW()`,
        [fileId, projectId, file.path, file.content, file.fileType, sizeBytes, creatorId]
      );
      
      // Create initial version
      await pool.query(
        `INSERT INTO file_versions (file_id, version, content, size_bytes, changed_by, changed_at, change_description)
         VALUES ($1, 1, $2, $3, $4, NOW(), 'Initial version')
         ON CONFLICT (file_id, version) DO NOTHING`,
        [fileId, file.content, sizeBytes, creatorId]
      );
      
      console.log(`  ✅ Created file: ${file.path}`);
    } catch (error) {
      console.error(`  ❌ Error creating file ${file.path}:`, error);
    }
  }
}

async function seedActivityLog(projectIds: string[], users: TestUser[]): Promise<void> {
  console.log('\n🌱 Seeding activity log...');
  
  if (projectIds.length === 0 || users.length === 0) {
    return;
  }
  
  const activities = [
    {
      action: 'project_created',
      resourceType: 'project',
      details: { message: 'Project created' },
    },
    {
      action: 'user_joined',
      resourceType: 'project',
      details: { message: 'dev2 joined the project' },
    },
    {
      action: 'user_joined',
      resourceType: 'project',
      details: { message: 'dev3 joined the project' },
    },
    {
      action: 'file_created',
      resourceType: 'file',
      details: { file: 'README.md', message: 'Created README.md' },
    },
  ];
  
  for (const activity of activities) {
    try {
      await pool.query(
        `INSERT INTO activity_log (project_id, user_id, action, resource_type, details, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          projectIds[0],
          users[0].id,
          activity.action,
          activity.resourceType,
          JSON.stringify(activity.details),
        ]
      );
    } catch (error) {
      console.error(`  ❌ Error creating activity log:`, error);
    }
  }
  
  console.log(`  ✅ Created ${activities.length} activity log entries`);
}

async function main() {
  console.log('🚀 Starting database seeding...\n');
  
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');
    
    // Seed data
    const users = await seedUsers();
    const projectIds = await seedProjects(users);
    await seedFiles(projectIds, users);
    await seedActivityLog(projectIds, users);
    
    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('📋 Test Credentials:');
    console.log('┌─────────────────────────────────────┐');
    for (const user of TEST_USERS) {
      console.log(`│ ${user.username.padEnd(8)} │ ${user.email.padEnd(18)} │ ${user.password.padEnd(10)} │`);
    }
    console.log('└─────────────────────────────────────┘\n');
    console.log('🎯 Next steps:');
    console.log('  1. Start the application: npm run dev');
    console.log('  2. Open http://localhost:3000');
    console.log('  3. Log in with any test user');
    console.log('  4. Open "Collaborative Demo Project"');
    console.log('  5. Test multi-user editing!\n');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
