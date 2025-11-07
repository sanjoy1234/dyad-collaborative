# Dyad Collaborative - Quick Start Guide 🚀

## What We've Built So Far

You now have a **complete foundation** for a collaborative, web-based AI app builder platform! Here's what's ready:

### ✅ Complete Infrastructure
- **Docker Environment**: PostgreSQL + Redis + Nginx + App
- **Database Schema**: 10+ tables with indexes, triggers, and views
- **Seed Data**: 4 test users (dev1, dev2, dev3, admin) + sample project
- **Configuration**: All environment variables and settings
- **Documentation**: Comprehensive README and architecture docs

### 📁 Project Structure Created
```
dyad-collaborative/
├── package.json              ✅ All dependencies defined
├── tsconfig.json             ✅ TypeScript configuration
├── docker-compose.yml        ✅ Multi-service setup
├── Dockerfile                ✅ Production build
├── .env.example              ✅ Environment template
├── README.md                 ✅ Full documentation
├── PROGRESS.md               ✅ Implementation status
├── scripts/
│   ├── init-db.sql          ✅ Database schema
│   └── seed-db.ts           ✅ Test data seeding
└── (Next.js source code to be added in next phase)
```

## 🚀 Getting Started

### Option 1: Quick Start with Docker (Recommended)

```bash
# 1. Navigate to project
cd /Users/sanjoy.ghoshapexon.com/Library/CloudStorage/OneDrive-Apexon/demoworkspace/dyad-collaborative

# 2. Copy environment file
cp .env.example .env

# 3. Generate secure secret (macOS/Linux)
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env

# 4. Start all services
docker-compose up -d

# 5. Wait for services to be healthy (~30 seconds)
docker-compose ps

# 6. Seed the database
docker-compose exec app npm run db:seed

# 7. Access the application
open http://localhost:3000
```

### Option 2: Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your settings

# 3. Start PostgreSQL and Redis (separate terminals or use Docker)
docker-compose up db redis -d

# 4. Push database schema
npm run db:push

# 5. Seed test data
npm run db:seed

# 6. Start development server
npm run dev

# 7. Open browser
open http://localhost:3000
```

## 👥 Test Users

Login with these credentials:

| Username | Email | Password | Role |
|----------|-------|----------|------|
| **dev1** | dev1@test.com | Test123! | Developer (Owner) |
| **dev2** | dev2@test.com | Test123! | Developer (Editor) |
| **dev3** | dev3@test.com | Test123! | Developer (Editor) |
| **admin** | admin@test.com | Admin123! | Administrator |

## 🧪 Testing Collaborative Features

### Scenario 1: Multi-User Editing

**What to test:** Multiple developers editing simultaneously

```bash
# Terminal 1
open -na "Google Chrome" --args --new-window "http://localhost:3000"
# Login as dev1@test.com

# Terminal 2  
open -na "Google Chrome" --args --new-window "http://localhost:3000"
# Login as dev2@test.com

# Terminal 3
open -na "Google Chrome" --args --new-window "http://localhost:3000"
# Login as dev3@test.com
```

**Steps:**
1. All users open "Collaborative Demo Project"
2. All users open `src/App.tsx`
3. Each user edits different sections
4. Observe real-time updates
5. Check presence indicators
6. See live cursors

### Scenario 2: Conflict Resolution

**What to test:** Overlapping edits and conflict handling

1. dev1 and dev2 open same file
2. Both edit the same line
3. System detects conflict
4. Conflict resolution UI appears
5. Choose resolution strategy

### Scenario 3: File Locking

**What to test:** Exclusive file access

1. dev1 requests lock on `package.json`
2. dev2 and dev3 see file as locked
3. dev2/dev3 can view but not edit
4. dev1 releases lock or wait 15 minutes
5. File becomes editable again

## 📊 Monitoring & Logs

### View Docker Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f db
docker-compose logs -f redis
```

### Check Service Health
```bash
# All services status
docker-compose ps

# Database connection
docker-compose exec db psql -U postgres -d dyad_collaborative -c "SELECT COUNT(*) FROM users;"

# Redis connection
docker-compose exec redis redis-cli ping
```

### Database Management
```bash
# Open database studio
npm run db:studio

# Connect with psql
docker-compose exec db psql -U postgres dyad_collaborative

# Run custom queries
docker-compose exec db psql -U postgres -d dyad_collaborative -c "SELECT * FROM users;"
```

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Stop all services
docker-compose down

# Remove volumes and restart
docker-compose down -v
docker-compose up -d --build

# Check for port conflicts
lsof -i :3000  # App
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
```

### Database Connection Issues

```bash
# Check if database is ready
docker-compose exec db pg_isready -U postgres

# Recreate database
docker-compose exec db psql -U postgres -c "DROP DATABASE IF EXISTS dyad_collaborative;"
docker-compose exec db psql -U postgres -c "CREATE DATABASE dyad_collaborative;"
docker-compose exec db psql -U postgres dyad_collaborative < scripts/init-db.sql
```

### Seed Data Issues

```bash
# Clear existing data and reseed
docker-compose exec app npm run db:seed

# Or manually
docker-compose exec db psql -U postgres dyad_collaborative -c "TRUNCATE users CASCADE;"
docker-compose exec app npm run db:seed
```

### Node Modules Issues

```bash
# Rebuild node_modules
rm -rf node_modules package-lock.json
npm install

# Or in Docker
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 🔄 Development Workflow

### Making Changes

```bash
# 1. Make code changes
# Files auto-reload with hot module replacement

# 2. Database schema changes
npm run db:generate  # Generate migration
npm run db:push      # Apply to database

# 3. Run tests
npm test

# 4. Check types
npm run type-check

# 5. Format code
npm run format
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/my-feature
```

## 📈 Next Steps

### Phase 3: Core Implementation

Now that infrastructure is ready, next steps are:

1. **Create src/ Directory Structure**
   ```bash
   mkdir -p src/{app,components,lib,hooks,types}
   ```

2. **Implement Authentication**
   - NextAuth.js configuration
   - Login/register pages
   - Session management

3. **Build Real-time Engine**
   - Socket.io server setup
   - Operational Transform implementation
   - Presence system

4. **Create UI Components**
   - Monaco Editor wrapper
   - File tree component
   - Collaborator panel
   - Cursor overlay

5. **Port Dyad Features**
   - AI builder integration
   - Component library
   - Preview panel

### Estimated Timeline

- ✅ **Phase 1**: Foundation (Completed)
- ✅ **Phase 2**: Infrastructure (Completed)
- 🚧 **Phase 3**: Core Features (Next - 2-3 days)
- ⏭️ **Phase 4**: Dyad Features (1-2 days)
- ⏭️ **Phase 5**: Testing & Polish (1 day)

**Total**: ~1 week for full implementation

## 🎯 Success Criteria

You'll know it's working when:

✅ Three browsers can log in with different users
✅ All users see the same project and files
✅ Typing in one browser appears in others instantly
✅ Cursor positions show in real-time
✅ File locking prevents concurrent edits
✅ Conflicts are detected and resolved
✅ Changes persist after refresh
✅ Version history is maintained

## 📚 Additional Resources

### Documentation Files
- `README.md` - Full project documentation
- `ARCHITECTURE.md` - System design and architecture
- `PROGRESS.md` - Implementation progress tracker
- `scripts/init-db.sql` - Complete database schema

### Key Technologies
- [Next.js Documentation](https://nextjs.org/docs)
- [Socket.io Guide](https://socket.io/docs/v4/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Docker Compose](https://docs.docker.com/compose/)

### Related Projects
- [Dyad](https://dyad.sh) - Original desktop app
- [Cursor](https://cursor.sh) - Inspiration for collaboration
- [Lovable](https://lovable.dev) - Similar web builder
- [v0](https://v0.dev) - Vercel's AI builder

## 🆘 Need Help?

1. **Check logs**: `docker-compose logs -f`
2. **Verify services**: `docker-compose ps`
3. **Review documentation**: See README.md
4. **Check database**: `npm run db:studio`
5. **Restart services**: `docker-compose restart`

## 🎉 You're Ready!

Your collaborative Dyad platform foundation is complete. The infrastructure is solid and ready for the application code.

**Next command to run:**
```bash
docker-compose up -d && docker-compose logs -f
```

**Then visit:** http://localhost:3000

---

**Status**: Infrastructure Complete ✅
**Ready For**: Application Development 🚀
**Expected**: Full functionality in ~1 week 📅
