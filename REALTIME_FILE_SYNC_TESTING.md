# 🔄 Real-Time File Sync Testing Guide

## ✅ Feature: Live File Synchronization

When one collaborator saves a file, **all other collaborators viewing that file see the changes instantly** without refreshing!

## 🎯 Quick Test (3 Minutes)

### Setup (1 minute):
1. **Browser 1**: Login as **dev1@test.com** / **Test123!**
2. **Browser 2** (Incognito): Login as **dev2@test.com** / **Test123!**
3. **Both**: Navigate to the same project (e.g., "test 59")
4. **Verify**: Both see "Live" badge and 2 avatars

### Test Real-Time Sync (2 minutes):

#### Step 1: Both Open Same File
1. **dev1**: Click on **package.json** in file tree
2. **dev2**: Click on **package.json** in file tree
3. **Both**: Monaco Editor opens with JSON content
4. **Verify**: Both see identical content

#### Step 2: dev1 Edits File
1. **dev1 browser**: Edit the file (e.g., change version number or add a comment)
2. **dev1**: See "Modified" badge (orange) appear
3. **dev1**: Click **"Save"** button or press **Cmd+S**
4. **dev1**: See "File Saved" toast notification

#### Step 3: dev2 Sees Changes Instantly! 🎉
1. **dev2 browser**: **IMMEDIATELY** see:
   - ✅ **Toast notification**: "File Updated - dev1 saved changes to package.json"
   - ✅ **Monaco Editor content updates** with dev1's changes
   - ✅ **No manual refresh needed!**
   - ✅ "Modified" badge disappears (if it was there)

#### Step 4: Verify Bidirectional Sync
1. **dev2 browser**: Now edit the same file (add another change)
2. **dev2**: Click **"Save"** or press **Cmd+S**
3. **dev1 browser**: **IMMEDIATELY** see:
   - ✅ **Toast notification**: "File Updated - dev2 saved changes to package.json"
   - ✅ **Monaco Editor content updates** with dev2's changes
   - ✅ **Works both ways!**

## 🎨 Expected Behavior

### When YOU Save:
```
Your Monaco Editor:
1. Click "Save" → Sends to server
2. Server saves to database
3. Server broadcasts to Socket.IO
4. Toast: "File Saved ✓"
5. "Modified" badge disappears
```

### When OTHERS Save:
```
Your Monaco Editor (watching same file):
1. Socket.IO receives broadcast
2. Monaco content auto-updates
3. Toast: "File Updated - [username] saved changes"
4. You see their changes immediately
5. No page refresh needed!
```

## 🧪 Advanced Test Scenarios

### Test 1: Different Files (No Interference)
1. **dev1**: Opens **index.html**
2. **dev2**: Opens **package.json**
3. **dev1**: Edits and saves **index.html**
4. **dev2**: Should **NOT** see notification (different file)
5. ✅ **Isolated file updates**

### Test 2: Multiple Collaborators
1. Add **dev3** to project
2. **All 3**: Open same file (e.g., README.md)
3. **dev1**: Edits and saves
4. **dev2 AND dev3**: Both see update instantly
5. ✅ **Broadcast to all users**

### Test 3: Switch Files
1. **dev1**: Opens **file1.js**, edits, saves
2. **dev2**: Currently viewing **file2.js**
3. **dev2**: Switches to **file1.js**
4. **dev2**: Sees latest saved content from dev1
5. ✅ **File list stays synchronized**

### Test 4: Rapid Successive Saves
1. **dev1**: Edits file, saves
2. **dev1**: Immediately edits again, saves
3. **dev1**: Third edit, save
4. **dev2**: Receives all 3 updates in order
5. ✅ **Sequential updates preserved**

### Test 5: Conflict Warning
1. **dev1**: Opens file, starts editing (don't save yet)
2. **dev2**: Opens same file, edits, **saves**
3. **dev1**: Sees toast: "File Updated - dev2 saved changes"
4. **dev1's editor**: Auto-updates with dev2's changes
5. **dev1's unsaved changes**: **Lost** (dev2's version loaded)
6. ⚠️ **Warning**: Save frequently to avoid conflicts!

### Test 6: Disconnection Recovery
1. **Both**: Open same file
2. **Simulate disconnect**: Restart Docker:
   ```bash
   docker compose restart
   ```
3. **Wait 30 seconds** for reconnection
4. **dev1**: Edit and save
5. **dev2**: Should see update after reconnection
6. ✅ **Auto-reconnect works**

## 🔍 Console Verification

### Open Browser Console (F12 → Console):

**When you save a file:**
```
[Collaboration] Broadcasting file save: package.json
```

**When someone else saves:**
```
[Collaboration] Remote file saved: dev1 package.json
[Editor] Remote file saved: package.json by dev1
```

**When Socket.IO connects:**
```
[Collaboration] Connected to server
[Collaboration] Active users: 2
```

## ✅ Success Checklist

After testing, verify:

- [ ] dev1 saves → dev2 sees update **instantly**
- [ ] dev2 saves → dev1 sees update **instantly**
- [ ] Toast notification appears with username
- [ ] Monaco Editor content updates automatically
- [ ] No page refresh needed
- [ ] Works for multiple file types (JS, JSON, HTML, CSS, etc.)
- [ ] Console logs show broadcast messages
- [ ] Different files don't interfere
- [ ] Multiple users (3+) all receive updates
- [ ] Bidirectional sync works both ways

## 🎉 Expected User Experience

### **Before** (Old Behavior):
❌ dev1 saves file  
❌ dev2 doesn't see changes  
❌ dev2 must: Click back → Dashboard → Project → File again  
❌ Very frustrating! 😤

### **After** (New Behavior):
✅ dev1 saves file  
✅ dev2 sees changes **instantly**  
✅ Toast notification: "File Updated - dev1 saved changes"  
✅ Monaco Editor auto-updates  
✅ Seamless collaboration! 🎉

## 🐛 Troubleshooting

### Issue: Changes Not Syncing
**Check:**
```bash
# 1. Verify Socket.IO connected
# Browser Console (F12) should show:
[Collaboration] Connected to server

# 2. Check server logs
docker logs dyad-collaborative-app-1 --tail 50

# 3. Look for broadcast messages
# Should see: "[Socket.IO] File saved by dev1: package.json"
```

### Issue: Only One-Way Sync
**Solution:**
1. Hard refresh **both** browsers (Cmd+Shift+R)
2. Check both consoles for Socket.IO connection
3. Verify both show "Live" badge

### Issue: Delayed Updates
**Check:**
1. Network latency (Socket.IO uses WebSocket)
2. Docker logs for errors
3. Browser console for JavaScript errors

### Issue: Lost Edits
**This is expected behavior!** 
- If you're editing and someone else saves, their version wins
- **Best Practice**: 
  - Save frequently (Cmd+S)
  - Communicate with team before major edits
  - Use version control (Git) for important changes

## 📊 Performance Metrics

**Expected Sync Speed:**
- ⚡ **Save to broadcast**: < 100ms
- ⚡ **Broadcast to receive**: < 500ms
- ⚡ **Monaco Editor update**: < 200ms
- 🎯 **Total**: < 1 second end-to-end

**Test:**
1. dev1 saves file → Note the time
2. dev2 sees toast → Note the time
3. Difference should be < 1 second

## 🎓 Technical Details

### Architecture:
```
dev1 (saves) 
  → API: PUT /api/projects/{id}/files/{fileId}
  → Database: Update content
  → Socket.IO: emit('file-saved', data)
  → Server: Broadcast to all users in project
  → dev2: receive('remote-file-saved')
  → Monaco Editor: Update content
  → Toast: "File Updated"
```

### Socket.IO Events:
- **Emit**: `file-saved` (when you save)
- **Listen**: `remote-file-saved` (when others save)
- **Room**: `project:{projectId}` (isolated per project)

### Data Transmitted:
```javascript
{
  fileId: "abc-123",
  filePath: "package.json",
  newContent: "{ ... }", // Full file content
  userId: "user-456",
  username: "dev1",
  timestamp: 1699300000000
}
```

## 🚀 Next Steps

After verifying real-time sync works:

1. **Test with your team** using actual projects
2. **Practice saving frequently** to avoid conflicts
3. **Use version control** (Git) for important changes
4. **Communicate** before making major edits
5. **Enjoy seamless collaboration!** 🎉

## 📝 Known Limitations

1. **Last Save Wins**: No automatic merge of concurrent edits
   - If 2 users edit simultaneously, last save overwrites
   - Future: Implement CRDT or Operational Transform

2. **Full File Sync**: Sends entire file content on save
   - Efficient for small files (< 1MB)
   - Future: Send only diffs for large files

3. **No Edit Locking**: Files can be edited by multiple users
   - Future: Add "Currently editing" indicator
   - Future: Add optional file locking

4. **Network Required**: Requires stable internet
   - Offline edits won't sync until reconnected
   - Future: Add offline mode with sync on reconnect

## 🎉 Ready to Test!

**Open two browsers and follow the Quick Test above!**

**You should see:**
- ✅ Instant file sync between users
- ✅ Toast notifications on updates
- ✅ Monaco Editor auto-updates
- ✅ "Live" badge shows active users

**Time to test:** 3 minutes  
**Difficulty:** Easy  
**Wow Factor:** 🤯 High!

---

**Last Updated:** November 6, 2025  
**Feature Status:** ✅ Production Ready  
**Application:** http://localhost:3000
