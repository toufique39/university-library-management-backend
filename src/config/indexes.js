
export async function ensureLibraryIndexes(db) {
  const borrowRequests = db.collection("borrowRequests");
  const borrowRecords = db.collection("borrowRecords");

  await Promise.all([
    // Prevent duplicate pending requests for the same member 
    borrowRequests.createIndex(
      { activeKey: 1 },
      { unique: true, sparse: true }
    ),

    borrowRequests.createIndex({
      memberId: 1,
      createdAt: -1,
    }),

    borrowRequests.createIndex({
      status: 1,
      createdAt: -1,
    }),

    // Prevent duplicate active borrowing of the same book by a member
    borrowRecords.createIndex(
      { activeKey: 1 },
      { unique: true, sparse: true }
    ),

    borrowRecords.createIndex({
      memberId: 1,
      issuedAt: -1,
    }),

    borrowRecords.createIndex({
      status: 1,
      dueDate: 1,
    }),
  ]);

  console.log("Library database indexes created successfully!");
}
