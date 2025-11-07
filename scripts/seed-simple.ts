#!/usr/bin/env tsx
/**
 * Simplified Database Seeding Script
 * Creates test users and sample project
 */

import postgres from 'postgres';
import * as bcrypt from 'bcryptjs';

const sql = postgres({
  host: 'localhost',
  port: 5432,
  database: 'dyad_collaborative',
  username: 'postgres',
  password: 'dyadpass123',
});

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...\n');

    // Hash passwords
    const devPassword = await bcrypt.hash('Test123!', 10);
    const adminPassword = await bcrypt.hash('Admin123!', 10);

    // Insert test users with fixed UUIDs for consistency
    console.log('Creating test users...');
    await sql`
      INSERT INTO users (id, email, username, password_hash, role)
      VALUES 
        ('550e8400-e29b-41d4-a716-446655440001', 'dev1@test.com', 'dev1', ${devPassword}, 'developer'),
        ('550e8400-e29b-41d4-a716-446655440002', 'dev2@test.com', 'dev2', ${devPassword}, 'developer'),
        ('550e8400-e29b-41d4-a716-446655440003', 'dev3@test.com', 'dev3', ${devPassword}, 'developer'),
        ('550e8400-e29b-41d4-a716-446655440004', 'admin@test.com', 'admin', ${adminPassword}, 'admin')
      ON CONFLICT (email) DO UPDATE 
      SET password_hash = EXCLUDED.password_hash, username = EXCLUDED.username
    `;
    console.log('✅ Created 4 test users\n');

    // Create sample project
    console.log('Creating sample project...');
    await sql`
      INSERT INTO projects (id, name, description, owner_id)
      VALUES (
        '660e8400-e29b-41d4-a716-446655440001',
        'Collaborative Demo Project',
        'A sample project for testing real-time collaboration',
        '550e8400-e29b-41d4-a716-446655440001'
      )
      ON CONFLICT (id) DO NOTHING
    `;
    console.log('✅ Created sample project\n');

    // Add collaborators
    console.log('Adding collaborators...');
    await sql`
      INSERT INTO project_collaborators (project_id, user_id, role, invited_by)
      VALUES 
        ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'owner', '550e8400-e29b-41d4-a716-446655440001'),
        ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'editor', '550e8400-e29b-41d4-a716-446655440001'),
        ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'editor', '550e8400-e29b-41d4-a716-446655440001')
      ON CONFLICT DO NOTHING
    `;
    console.log('✅ Added 3 collaborators\n');

    // Add sample files
    console.log('Creating sample files...');
    await sql`
      INSERT INTO project_files (project_id, path, content, file_type)
      VALUES 
        (
          '660e8400-e29b-41d4-a716-446655440001',
          '/README.md',
          '# Collaborative Demo Project

Welcome to the Dyad Collaborative Platform!

## Getting Started

This is a sample project to demonstrate real-time collaboration features.

### Features
- Real-time editing
- Multiple concurrent users
- Conflict-free merging with OT
- Live cursor tracking
',
          'markdown'
        ),
        (
          '660e8400-e29b-41d4-a716-446655440001',
          '/src/App.tsx',
          'import React from ''react'';

function App() {
  return (
    <div className="App">
      <h1>Welcome to Dyad</h1>
      <p>Collaborative Development Platform</p>
    </div>
  );
}

export default App;
',
          'typescript'
        ),
        (
          '660e8400-e29b-41d4-a716-446655440001',
          '/package.json',
          '{
  "name": "demo-project",
  "version": "1.0.0",
  "description": "Sample collaborative project",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
',
          'json'
        )
      ON CONFLICT DO NOTHING
    `;
    console.log('✅ Created 3 sample files\n');

    // Add activity logs
    console.log('Creating activity logs...');
    await sql`
      INSERT INTO activity_log (project_id, user_id, action, details)
      VALUES 
        (
          '660e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440001',
          'project_created',
          '{"projectName": "Collaborative Demo Project"}'::jsonb
        ),
        (
          '660e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440001',
          'collaborator_added',
          '{"userName": "Developer Two"}'::jsonb
        ),
        (
          '660e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440001',
          'collaborator_added',
          '{"userName": "Developer Three"}'::jsonb
        )
    `;
    console.log('✅ Created activity logs\n');

    console.log('🎉 Database seeding completed successfully!\n');
    console.log('Test Users:');
    console.log('  • dev1@test.com / Test123!');
    console.log('  • dev2@test.com / Test123!');
    console.log('  • dev3@test.com / Test123!');
    console.log('  • admin@test.com / Admin123!\n');
    console.log('Login at: http://localhost:3000');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seedDatabase();
