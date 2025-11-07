import { Operation } from '@/types';

/**
 * Operational Transformation (OT) Engine
 * Implements the transformation functions for concurrent editing
 */

/**
 * Transform two operations against each other
 * Returns the transformed version of op1 that can be applied after op2
 */
export function transformOperation(op1: Operation, op2: Operation): Operation {
  // If operations are on different files, no transformation needed
  if (op1.fileId !== op2.fileId) {
    return op1;
  }

  // If op2 happened before op1 (based on version), no transformation needed
  if (op2.version < op1.version) {
    return op1;
  }

  // Transform based on operation types
  if (op1.type === 'insert' && op2.type === 'insert') {
    return transformInsertInsert(op1, op2);
  } else if (op1.type === 'insert' && op2.type === 'delete') {
    return transformInsertDelete(op1, op2);
  } else if (op1.type === 'delete' && op2.type === 'insert') {
    return transformDeleteInsert(op1, op2);
  } else if (op1.type === 'delete' && op2.type === 'delete') {
    return transformDeleteDelete(op1, op2);
  } else if (op1.type === 'replace' && op2.type === 'insert') {
    return transformReplaceInsert(op1, op2);
  } else if (op1.type === 'replace' && op2.type === 'delete') {
    return transformReplaceDelete(op1, op2);
  } else if (op1.type === 'insert' && op2.type === 'replace') {
    return transformInsertReplace(op1, op2);
  } else if (op1.type === 'delete' && op2.type === 'replace') {
    return transformDeleteReplace(op1, op2);
  } else if (op1.type === 'replace' && op2.type === 'replace') {
    return transformReplaceReplace(op1, op2);
  }

  return op1;
}

// Insert vs Insert
function transformInsertInsert(op1: Operation, op2: Operation): Operation {
  if (op2.position < op1.position) {
    // op2 inserted before op1, shift op1 position
    return {
      ...op1,
      position: op1.position + (op2.content?.length || 0),
    };
  } else if (op2.position === op1.position) {
    // Same position, use timestamp to decide
    if (op2.timestamp < op1.timestamp) {
      return {
        ...op1,
        position: op1.position + (op2.content?.length || 0),
      };
    }
  }
  return op1;
}

// Insert vs Delete
function transformInsertDelete(op1: Operation, op2: Operation): Operation {
  const op2End = op2.position + (op2.length || 0);

  if (op2End <= op1.position) {
    // op2 deleted before op1, shift op1 position back
    return {
      ...op1,
      position: op1.position - (op2.length || 0),
    };
  } else if (op2.position < op1.position && op1.position < op2End) {
    // op1 position is within deleted range, move to deletion start
    return {
      ...op1,
      position: op2.position,
    };
  }
  return op1;
}

// Delete vs Insert
function transformDeleteInsert(op1: Operation, op2: Operation): Operation {
  if (op2.position <= op1.position) {
    // op2 inserted before op1, shift op1 position forward
    return {
      ...op1,
      position: op1.position + (op2.content?.length || 0),
    };
  } else if (op2.position < op1.position + (op1.length || 0)) {
    // op2 inserted within op1's range, increase op1's length
    return {
      ...op1,
      length: (op1.length || 0) + (op2.content?.length || 0),
    };
  }
  return op1;
}

// Delete vs Delete
function transformDeleteDelete(op1: Operation, op2: Operation): Operation {
  const op1End = op1.position + (op1.length || 0);
  const op2End = op2.position + (op2.length || 0);

  if (op2End <= op1.position) {
    // op2 deleted completely before op1, shift op1 position back
    return {
      ...op1,
      position: op1.position - (op2.length || 0),
    };
  } else if (op2.position >= op1End) {
    // op2 deleted completely after op1, no change
    return op1;
  } else {
    // Overlapping deletes - complex case
    if (op2.position <= op1.position && op2End >= op1End) {
      // op2 completely contains op1, op1 becomes a no-op
      return {
        ...op1,
        position: op2.position,
        length: 0,
      };
    } else if (op2.position <= op1.position && op2End < op1End) {
      // op2 overlaps start of op1
      return {
        ...op1,
        position: op2.position,
        length: op1End - op2End,
      };
    } else if (op2.position > op1.position && op2End >= op1End) {
      // op2 overlaps end of op1
      return {
        ...op1,
        length: op2.position - op1.position,
      };
    } else {
      // op2 is completely within op1
      return {
        ...op1,
        length: (op1.length || 0) - (op2.length || 0),
      };
    }
  }
}

// Replace vs Insert
function transformReplaceInsert(op1: Operation, op2: Operation): Operation {
  const op1End = op1.position + (op1.length || 0);

  if (op2.position <= op1.position) {
    // op2 inserted before op1, shift op1 position
    return {
      ...op1,
      position: op1.position + (op2.content?.length || 0),
    };
  } else if (op2.position < op1End) {
    // op2 inserted within op1's range, increase op1's length
    return {
      ...op1,
      length: (op1.length || 0) + (op2.content?.length || 0),
    };
  }
  return op1;
}

// Replace vs Delete
function transformReplaceDelete(op1: Operation, op2: Operation): Operation {
  const op1End = op1.position + (op1.length || 0);
  const op2End = op2.position + (op2.length || 0);

  if (op2End <= op1.position) {
    // op2 deleted before op1, shift op1 position back
    return {
      ...op1,
      position: op1.position - (op2.length || 0),
    };
  } else if (op2.position >= op1End) {
    // op2 deleted after op1, no change
    return op1;
  } else {
    // Overlapping case
    if (op2.position <= op1.position && op2End >= op1End) {
      // op2 completely contains op1, op1 becomes insert
      return {
        ...op1,
        position: op2.position,
        length: 0,
      };
    } else if (op2.position <= op1.position && op2End < op1End) {
      // op2 overlaps start of op1
      return {
        ...op1,
        position: op2.position,
        length: op1End - op2End,
      };
    } else if (op2.position > op1.position && op2End >= op1End) {
      // op2 overlaps end of op1
      return {
        ...op1,
        length: op2.position - op1.position,
      };
    } else {
      // op2 is within op1
      return {
        ...op1,
        length: (op1.length || 0) - (op2.length || 0),
      };
    }
  }
}

// Insert vs Replace
function transformInsertReplace(op1: Operation, op2: Operation): Operation {
  const op2End = op2.position + (op2.length || 0);

  if (op2End <= op1.position) {
    // op2 replaced before op1, adjust position based on length change
    const lengthDiff = (op2.content?.length || 0) - (op2.length || 0);
    return {
      ...op1,
      position: op1.position + lengthDiff,
    };
  } else if (op2.position < op1.position && op1.position <= op2End) {
    // op1 position within op2's range, move to after replacement
    return {
      ...op1,
      position: op2.position + (op2.content?.length || 0),
    };
  }
  return op1;
}

// Delete vs Replace
function transformDeleteReplace(op1: Operation, op2: Operation): Operation {
  const op1End = op1.position + (op1.length || 0);
  const op2End = op2.position + (op2.length || 0);

  if (op2End <= op1.position) {
    // op2 replaced before op1, adjust position based on length change
    const lengthDiff = (op2.content?.length || 0) - (op2.length || 0);
    return {
      ...op1,
      position: op1.position + lengthDiff,
    };
  } else if (op2.position >= op1End) {
    // op2 replaced after op1, no change
    return op1;
  } else {
    // Overlapping - complex case
    // Treat replace as delete + insert for transformation
    const deleteOp: Operation = {
      ...op2,
      type: 'delete',
      content: undefined,
    };
    const transformedAfterDelete = transformDeleteDelete(op1, deleteOp);

    const insertOp: Operation = {
      ...op2,
      type: 'insert',
      length: undefined,
    };
    return transformDeleteInsert(transformedAfterDelete, insertOp);
  }
}

// Replace vs Replace
function transformReplaceReplace(op1: Operation, op2: Operation): Operation {
  const op1End = op1.position + (op1.length || 0);
  const op2End = op2.position + (op2.length || 0);

  if (op2End <= op1.position) {
    // op2 replaced before op1, adjust position
    const lengthDiff = (op2.content?.length || 0) - (op2.length || 0);
    return {
      ...op1,
      position: op1.position + lengthDiff,
    };
  } else if (op2.position >= op1End) {
    // op2 replaced after op1, no change
    return op1;
  } else {
    // Overlapping replaces - use timestamp to decide priority
    if (op2.timestamp < op1.timestamp) {
      // op2 has priority, transform op1 as if op2 is delete+insert
      const deleteOp: Operation = {
        ...op2,
        type: 'delete',
        content: undefined,
      };
      const transformedAfterDelete = transformReplaceDelete(op1, deleteOp);

      const insertOp: Operation = {
        ...op2,
        type: 'insert',
        length: undefined,
      };
      return transformReplaceInsert(transformedAfterDelete, insertOp);
    }
    return op1;
  }
}

/**
 * Apply an operation to a string content
 */
export function applyOperation(content: string, operation: Operation): string {
  const { type, position, content: opContent, length } = operation;

  if (type === 'insert' && opContent) {
    return content.slice(0, position) + opContent + content.slice(position);
  } else if (type === 'delete' && length) {
    return content.slice(0, position) + content.slice(position + length);
  } else if (type === 'replace' && opContent && length) {
    return content.slice(0, position) + opContent + content.slice(position + length);
  }

  return content;
}

/**
 * Transform a list of operations against a single operation
 */
export function transformOperations(operations: Operation[], against: Operation): Operation[] {
  return operations.map((op) => transformOperation(op, against));
}

/**
 * Check if two operations conflict
 */
export function detectConflict(op1: Operation, op2: Operation): boolean {
  if (op1.fileId !== op2.fileId) {
    return false;
  }

  const op1End = op1.position + (op1.length || op1.content?.length || 0);
  const op2End = op2.position + (op2.length || op2.content?.length || 0);

  // Check for overlapping ranges
  return !(op1End <= op2.position || op2End <= op1.position);
}
