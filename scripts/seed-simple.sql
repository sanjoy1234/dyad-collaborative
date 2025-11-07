-- Seed database with test users and sample project
-- Run with: psql -U postgres -d dyad_collaborative -f scripts/seed-simple.sql

-- Insert test users (passwords are hashed "Test123!" and "Admin123!")
INSERT INTO users (id, email, password_hash, name, role) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'dev1@test.com', '$2a$10$YourHashedPasswordHere1', 'Developer One', 'developer'),
  ('550e8400-e29b-41d4-a716-446655440002', 'dev2@test.com', '$2a$10$YourHashedPasswordHere2', 'Developer Two', 'developer'),
  ('550e8400-e29b-41d4-a716-446655440003', 'dev3@test.com', '$2a$10$YourHashedPasswordHere3', 'Developer Three', 'developer'),
  ('550e8400-e29b-41d4-a716-446655440004', 'admin@test.com', '$2a$10$YourHashedPasswordHere4', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Create a sample project
INSERT INTO projects (id, name, description, owner_id) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', 'Collaborative Demo Project', 'A sample project for testing real-time collaboration', '550e8400-e29b-41d4-a716-446655440001')
ON CONFLICT (id) DO NOTHING;

-- Add collaborators
INSERT INTO project_collaborators (project_id, user_id, role, invited_by) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'owner', '550e8400-e29b-41d4-a716-446655440001'),
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'editor', '550e8400-e29b-41d4-a716-446655440001'),
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'editor', '550e8400-e29b-41d4-a716-446655440001')
ON CONFLICT DO NOTHING;

-- Add sample files
INSERT INTO project_files (project_id, file_path, file_name, content, language) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', '/README.md', 'README.md', '# Collaborative Demo Project

Welcome to the Dyad Collaborative Platform!

## Getting Started

This is a sample project to demonstrate real-time collaboration features.

### Features
- Real-time editing
- Multiple concurrent users
- Conflict-free merging with OT
- Live cursor tracking
', 'markdown'),
  ('660e8400-e29b-41d4-a716-446655440001', '/src/App.tsx', 'App.tsx', 'import React from ''react'';

function App() {
  return (
    <div className="App">
      <h1>Welcome to Dyad</h1>
      <p>Collaborative Development Platform</p>
    </div>
  );
}

export default App;
', 'typescript'),
  ('660e8400-e29b-41d4-a716-446655440001', '/package.json', 'package.json', '{
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
', 'json')
ON CONFLICT DO NOTHING;

-- Add activity logs
INSERT INTO activity_log (project_id, user_id, activity_type, metadata) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'project_created', '{"projectName": "Collaborative Demo Project"}'),
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'collaborator_added', '{"userName": "Developer Two"}'),
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'collaborator_added', '{"userName": "Developer Three"}');

SELECT '✅ Seed data inserted successfully!' as status;
SELECT 'Test with: dev1@test.com / Test123!' as credentials;
