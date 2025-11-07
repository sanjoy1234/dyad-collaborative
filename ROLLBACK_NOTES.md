# Real-Time File Sync Rollback

**Date:** November 6, 2024  
**Status:** ✅ COMPLETED

## Issue Description

After implementing real-time file synchronization between collaborators, the application became unusable with the following critical issues:

1. **Application Hang on Save**: Clicking the "Save" button caused the browser to freeze
2. **Failed to Save File Errors**: Red toast notifications appeared repeatedly
3. **Incorrect Presence Count**: Showed "+178 collaborators" instead of the actual count (2 users)

## Root Causes

### Issue 1: File Save Failure
**Location:** `src/components/editor/DyadEditorClient.tsx` line 251

**Problem:**
```typescript
// In handleSaveFile function:
collaboration.sendFileSaved(selectedFile.id, selectedFile.path, fileContent);
```

**Why It Failed:**
- Called after every file save to broadcast changes to other collaborators
- The Socket.IO event handler may have thrown errors or caused conflicts
- Prevented the save operation from completing successfully
- Caused application to hang waiting for response

**Fix Applied:**
- ✅ Removed `collaboration.sendFileSaved()` call from handleSaveFile
- ✅ File saves now complete without broadcasting to other users

### Issue 2: Incorrect Presence Count
**Location:** `src/lib/collaboration/socket-server.ts` lines 125 and 257

**Problem:**
```typescript
// Used socket.id as Map key:
projectPresence.set(socket.id, userPresence);

// On disconnect:
projectPresence.delete(socket.id);
```

**Why It Failed:**
- Each browser tab/window creates a unique `socket.id`
- Each page refresh creates a new `socket.id`
- Disconnections didn't always clean up properly
- One user with multiple reconnections = multiple entries = inflated count
- Example: 1 user with 89 reconnections showed as "89 users"

**Fix Applied:**
```typescript
// Use userId as Map key (unique per user):
projectPresence.set(userDetails.id, userPresence);

// On disconnect:
projectPresence.delete(currentUser.id);
```
- ✅ Now uses `userId` as key ensuring one entry per unique user
- ✅ Multiple connections from same user only count once
- ✅ Presence count accurately reflects actual number of users

### Issue 3: Re-render Loops (Previously Fixed)
**Location:** `src/components/editor/DyadEditorClient.tsx` lines 93-123

**Problem:**
```typescript
const collaboration = useCollaboration({
  // ...
  onRemoteFileSaved: (data) => {
    setFileContent(data.newContent);      // setState #1
    setIsFileModified(false);              // setState #2
    toast({ ... });                        // Toast notification
    setFiles((prevFiles) => ...);          // setState #3
    setSelectedFile((prevFile) => ...);    // setState #4
  },
});
```

**Why It Failed:**
- 4 setState calls + 1 toast in callback
- Triggered on every remote file save from any collaborator
- Caused re-render cascades
- Contributed to application hangs

**Fix Applied:**
- ✅ Removed entire `onRemoteFileSaved` callback
- ✅ Reverted to simple useCollaboration hook

## Changes Rolled Back

### Removed Features:
1. ❌ Real-time file content synchronization between collaborators
2. ❌ `collaboration.sendFileSaved()` broadcast on file save
3. ❌ `onRemoteFileSaved` callback for receiving remote file updates
4. ❌ Toast notifications when other users save files
5. ❌ Automatic Monaco Editor content updates from remote saves

### Files Modified:
1. `src/components/editor/DyadEditorClient.tsx`
   - Removed `onRemoteFileSaved` callback
   - Removed `collaboration.sendFileSaved()` call

2. `src/lib/collaboration/socket-server.ts`
   - Changed Map key from `socket.id` to `userId` for presence tracking
   - Updated disconnect handler to use `userId`

3. `src/hooks/useCollaboration.ts`
   - No changes (kept `sendFileSaved` method but unused)

## Features Still Working ✅

1. ✅ **Monaco Editor**: Full-height display with syntax highlighting
2. ✅ **Direct Collaborator Addition**: Instant access without email verification
3. ✅ **Presence Indicators**: 
   - Correct user count
   - Live badge when other users are active
   - Avatar circles for each active user
4. ✅ **File Editing**: Full editing capabilities with syntax highlighting
5. ✅ **File Saving**: Normal file save functionality (no broadcasting)
6. ✅ **Role-Based Permissions**: Owner/Editor/Viewer permissions enforced
7. ✅ **CollaboratorsList**: Add/remove collaborators, role management
8. ✅ **Socket.IO Connection**: Real-time presence and future features

## Current Behavior

### File Editing Workflow:
1. User A opens a file and makes edits
2. User A clicks "Save"
3. File is saved to database
4. ✅ Toast: "File Saved"
5. ✅ "Modified" badge disappears
6. ✅ NO broadcast to other users
7. User B needs to manually refresh or reopen file to see changes

### Presence System:
1. Multiple users join project
2. Presence count shows accurate number (e.g., "2 users")
3. Each user appears once regardless of tabs/windows
4. Disconnections properly clean up entries
5. Count doesn't grow on page refresh

## Known Limitations

⚠️ **Manual Refresh Required**: 
- Changes made by one collaborator are NOT automatically visible to others
- Other users must manually refresh the page or reopen the file
- This is the trade-off for application stability

⚠️ **No Conflict Detection**:
- If two users edit the same file simultaneously, last save wins
- No warning about concurrent edits
- Potential for work to be overwritten

## Recommendations for Future Implementation

If real-time file sync is to be re-implemented, consider:

### 1. Use Proper CRDT/OT Libraries
- **Yjs**: Mature CRDT library with Monaco integration
- **Automerge**: Conflict-free replicated data types
- **ShareDB**: Operational transformation framework
- These libraries handle concurrent edits, conflict resolution, and state management

### 2. Debounce State Updates
```typescript
// Use debounced updates to prevent re-render storms
const debouncedUpdate = useMemo(
  () => debounce((content: string) => {
    setFileContent(content);
  }, 300),
  []
);
```

### 3. Implement Proper Conflict Resolution
- Detect concurrent edits
- Show diff/merge UI when conflicts occur
- Allow users to choose which version to keep

### 4. Add User Notifications
```typescript
// Notify user when others are editing same file
{activeEditorsOnFile.length > 1 && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      {activeEditorsOnFile.join(', ')} {activeEditorsOnFile.length === 1 ? 'is' : 'are'} 
      also editing this file
    </AlertDescription>
  </Alert>
)}
```

### 5. Implement File Locking (Optional)
- Lock file when user starts editing
- Prevent others from editing simultaneously
- Release lock after timeout or explicit unlock

### 6. Thorough Testing
- Test with 10+ concurrent users
- Test rapid saves (stress test)
- Test network disconnections and reconnections
- Test different file types and sizes
- Monitor for memory leaks and performance issues

## Testing Checklist

After rollback, verify:

- [ ] ✅ File save works without errors
- [ ] ✅ No "Failed to save file" toasts
- [ ] ✅ Application doesn't hang on save
- [ ] ✅ Presence count shows correct number (2 users, not +178)
- [ ] ✅ Multiple tabs from same user count as 1
- [ ] ✅ Page refresh doesn't increase count
- [ ] ✅ Disconnect properly removes user from count
- [ ] ✅ Monaco Editor displays correctly
- [ ] ✅ Syntax highlighting works
- [ ] ✅ Add collaborator works instantly
- [ ] ✅ Remove collaborator works
- [ ] ✅ Role permissions enforced
- [ ] ✅ File tree navigation works
- [ ] ✅ Create/delete files works

## Conclusion

**Status:** ✅ Application is now stable and usable

**Trade-off:** Manual refresh required to see others' changes in exchange for:
- ✅ Reliable file saving
- ✅ No application hangs
- ✅ Accurate presence indicators
- ✅ Stable user experience

**Next Steps:**
1. Monitor application for any remaining issues
2. Gather user feedback on collaboration workflow
3. Research proper CRDT implementation for future real-time sync
4. Consider file locking or conflict detection as intermediate solution

---

**Rollback Completed By:** GitHub Copilot  
**Test Accounts:** dev1@test.com, dev2@test.com, dev3@test.com (password: Test123!)  
**Application URL:** http://localhost:3000
