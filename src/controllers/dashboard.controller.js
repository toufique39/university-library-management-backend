
import { connectDB } from "../config/db.js";

// ADMIN & LIBRARIAN DASHBOARD
export const getAdminDashboard = async (req, res) => {
  try {
    const db = await connectDB();

    const books = db.collection("books");
    const users = db.collection("user");
    const categories = db.collection("categories");
    const requests = db.collection("borrowRequests");
    const records = db.collection("borrowRecords");

    const now = new Date();

    const [
      bookStats,
      totalMembers,
      totalLibrarians,
      totalCategories,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      issuedBooks,
      returnedBooks,
      overdueBooks,
      mostBorrowedBooks,
      recentRequests,
      recentRecords,
    ] = await Promise.all([

      // Book statistics
      books.aggregate([
        {
          $group: {
            _id: null,
            totalBooks: { $sum: 1 },
            totalCopies: { $sum: "$totalCopies" },
            availableCopies: { $sum: "$availableCopies" },
          },
        },
      ]).toArray(),

      // Total members
      users.countDocuments({ role: "member" }),

      // Total librarians
      users.countDocuments({ role: "librarian" }),

      // Total categories
      categories.countDocuments(),

      // Pending requests
      requests.countDocuments({ status: "pending" }),

      // Approved requests
      requests.countDocuments({ status: "approved" }),

      // Rejected requests
      requests.countDocuments({ status: "rejected" }),

      // Currently issued books
      records.countDocuments({ status: "issued" }),

      // Returned books
      records.countDocuments({ status: "returned" }),

      // Overdue books
      records.countDocuments({
        status: "issued",
        dueDate: { $lt: now },
      }),

      // Most borrowed books
      records.aggregate([
        {
          $group: {
            _id: {
              bookId: "$bookId",
              bookTitle: "$bookTitle",
            },
            borrowCount: { $sum: 1 },
          },
        },
        { $sort: { borrowCount: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            bookId: "$_id.bookId",
            bookTitle: "$_id.bookTitle",
            borrowCount: 1,
          },
        },
      ]).toArray(),

      // Recent requests
      requests.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray(),

      // Recent borrowing activities
      records.find({})
        .sort({ issuedAt: -1 })
        .limit(5)
        .toArray(),
    ]);

    const stats = bookStats[0] || {
      totalBooks: 0,
      totalCopies: 0,
      availableCopies: 0,
    };

    res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully.",

      data: {
        overview: {
          totalBooks: stats.totalBooks,
          totalCopies: stats.totalCopies,
          availableCopies: stats.availableCopies,

          totalMembers,
          totalLibrarians,
          totalCategories,

          pendingRequests,
          approvedRequests,
          rejectedRequests,

          issuedBooks,
          returnedBooks,
          overdueBooks,
        },

        mostBorrowedBooks,
        recentRequests,
        recentRecords,
      },
    });
  } catch (error) {
    console.error("Admin Dashboard Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load dashboard statistics.",
    });
  }
};


// MEMBER DASHBOARD
export const getMemberDashboard = async (req, res) => {
  try {
    const db = await connectDB();

    const requests = db.collection("borrowRequests");
    const records = db.collection("borrowRecords");

    const memberId = req.user.id;
    const now = new Date();

    const [
      pendingRequests,
      issuedBooks,
      returnedBooks,
      overdueBooks,
      myActiveRecords,
      recentRequests,
    ] = await Promise.all([

      // Member pending requests
      requests.countDocuments({
        memberId,
        status: "pending",
      }),

      // Member currently issued books
      records.countDocuments({
        memberId,
        status: "issued",
      }),

      // Member returned books
      records.countDocuments({
        memberId,
        status: "returned",
      }),

      // Member overdue books
      records.countDocuments({
        memberId,
        status: "issued",
        dueDate: { $lt: now },
      }),

      // Current books with closest due dates
      records.find({
        memberId,
        status: "issued",
      })
        .sort({ dueDate: 1 })
        .limit(5)
        .toArray(),

      // Recent requests
      requests.find({ memberId })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray(),
    ]);

    res.status(200).json({
      success: true,
      message: "Member dashboard retrieved successfully.",

      data: {
        overview: {
          pendingRequests,
          issuedBooks,
          returnedBooks,
          overdueBooks,
        },

        myActiveRecords,
        recentRequests,
      },
    });
  } catch (error) {
    console.error("Member Dashboard Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load member dashboard.",
    });
  }
};
