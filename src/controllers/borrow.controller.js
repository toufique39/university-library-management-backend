
import { ObjectId } from "mongodb";
import { connectDB, client } from "../config/db.js";

const getCollections = async () => {
  const db = await connectDB();

  return {
    books: db.collection("books"),
    requests: db.collection("borrowRequests"),
    records: db.collection("borrowRecords"),
  };
};

const isValidId = (id) =>
  /^[0-9a-fA-F]{24}$/.test(id);

const makeActiveKey = (memberId, bookId) =>
  `${memberId}:${bookId.toString()}`;

const createError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const handleError = (res, error) => {
  console.error("Borrowing API Error:", error);

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "An active request or borrowing record already exists.",
    });
  }

  return res.status(error.status || 500).json({
    success: false,
    message:
      error.status
        ? error.message
        : "Internal server error.",
  });
};


export const createBorrowRequest = async (req, res) => {
  try {
    const { bookId } = req.body;

    if (!bookId || !isValidId(bookId)) {
      return res.status(400).json({
        success: false,
        message: "A valid book ID is required.",
      });
    }

    const { books, requests, records } = await getCollections();

    const bookObjectId = new ObjectId(bookId);
    const memberId = req.user.id;

    const book = await books.findOne({
      _id: bookObjectId,
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    if (book.availableCopies <= 0) {
      return res.status(409).json({
        success: false,
        message: "This book is currently unavailable.",
      });
    }

    const activeKey = makeActiveKey(memberId, bookObjectId);

    // Check existing pending request
    const existingRequest = await requests.findOne({
      activeKey,
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending request for this book.",
      });
    }

    // Check existing active borrowing
    const existingRecord = await records.findOne({
      activeKey,
    });

    if (existingRecord) {
      return res.status(409).json({
        success: false,
        message: "You have already borrowed this book.",
      });
    }

    const request = {
      memberId,
      memberName: req.user.name,
      memberEmail: req.user.email,

      bookId: bookObjectId,
      bookTitle: book.title,
      bookAuthor: book.author,

      status: "pending",
      activeKey,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await requests.insertOne(request);

    return res.status(201).json({
      success: true,
      message: "Book borrow request submitted successfully.",
      data: {
        _id: result.insertedId,
        ...request,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};



export const getMyBorrowRequests = async (req, res) => {
  try {
    const { requests } = await getCollections();

    const result = await requests
      .find({
        memberId: req.user.id,
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};



export const getAllBorrowRequests = async (req, res) => {
  try {
    const { requests } = await getCollections();

    const { status = "pending" } = req.query;

    const allowedStatuses = [
      "pending",
      "approved",
      "rejected",
      "all",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request status.",
      });
    }

    const filter =
      status === "all" ? {} : { status };

    const result = await requests
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};




export const approveBorrowRequest = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID.",
    });
  }

  const session = client.startSession();

  try {
    const { books, requests, records } =
      await getCollections();

    const requestId = new ObjectId(id);

    const result = await session.withTransaction(async () => {
      const request = await requests.findOne(
        {
          _id: requestId,
          status: "pending",
        },
        { session }
      );

      if (!request) {
        throw createError(
          404,
          "Pending borrow request not found."
        );
      }

      // Ensure member hasn't already borrowed this book
      const activeKey = makeActiveKey(
        request.memberId,
        request.bookId
      );

      const existingRecord = await records.findOne(
        { activeKey },
        { session }
      );

      if (existingRecord) {
        throw createError(
          409,
          "Member has already borrowed this book."
        );
      }

      // Decrease available copies atomically
      const bookUpdate = await books.updateOne(
        {
          _id: request.bookId,
          availableCopies: { $gt: 0 },
        },
        {
          $inc: { availableCopies: -1 },
          $set: { updatedAt: new Date() },
        },
        { session }
      );

      if (bookUpdate.modifiedCount !== 1) {
        throw createError(
          409,
          "No available copies left for this book."
        );
      }

      const issuedAt = new Date();

      const dueDate = new Date(
        issuedAt.getTime() + 14 * 24 * 60 * 60 * 1000
      );

      // Create borrowing record
      const borrowRecord = {
        requestId: request._id,

        memberId: request.memberId,
        memberName: request.memberName,
        memberEmail: request.memberEmail,

        bookId: request.bookId,
        bookTitle: request.bookTitle,
        bookAuthor: request.bookAuthor,

        status: "issued",
        activeKey,

        issuedAt,
        dueDate,
        returnedAt: null,

        issuedBy: req.user.id,
        issuedByName: req.user.name,
      };

      const recordResult = await records.insertOne(
        borrowRecord,
        { session }
      );

      // Update original request
      await requests.updateOne(
        {
          _id: requestId,
          status: "pending",
        },
        {
          $set: {
            status: "approved",
            approvedAt: issuedAt,
            approvedBy: req.user.id,
            updatedAt: issuedAt,
          },
          $unset: {
            activeKey: "",
          },
        },
        { session }
      );

      return {
        ...borrowRecord,
        _id: recordResult.insertedId,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Borrow request approved. Book issued successfully.",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  } finally {
    await session.endSession();
  }
};



export const rejectBorrowRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const { requests } = await getCollections();

    const result = await requests.updateOne(
      {
        _id: new ObjectId(id),
        status: "pending",
      },
      {
        $set: {
          status: "rejected",
          rejectedAt: new Date(),
          rejectedBy: req.user.id,
          updatedAt: new Date(),
        },
        $unset: {
          activeKey: "",
        },
      }
    );

    if (result.modifiedCount !== 1) {
      return res.status(404).json({
        success: false,
        message: "Pending borrow request not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Borrow request rejected successfully.",
    });
  } catch (error) {
    handleError(res, error);
  }
};




export const getMyBorrowRecords = async (req, res) => {
  try {
    const { records } = await getCollections();

    const result = await records
      .find({
        memberId: req.user.id,
      })
      .sort({ issuedAt: -1 })
      .limit(100)
      .toArray();

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};



export const getAllBorrowRecords = async (req, res) => {
  try {
    const { records } = await getCollections();

    const { status = "all" } = req.query;

    if (!["all", "issued", "returned"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid record status.",
      });
    }

    const filter =
      status === "all" ? {} : { status };

    const result = await records
      .find(filter)
      .sort({ issuedAt: -1 })
      .limit(200)
      .toArray();

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};



export const returnBook = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid borrow record ID.",
    });
  }

  const session = client.startSession();

  try {
    const { books, records } = await getCollections();

    const recordId = new ObjectId(id);

    const result = await session.withTransaction(async () => {
      const record = await records.findOne(
        {
          _id: recordId,
          status: "issued",
        },
        { session }
      );

      if (!record) {
        throw createError(
          404,
          "Active borrowing record not found."
        );
      }

      // Restore available book copy
      const bookUpdate = await books.updateOne(
        {
          _id: record.bookId,
          $expr: {
            $lt: ["$availableCopies", "$totalCopies"],
          },
        },
        {
          $inc: {
            availableCopies: 1,
          },
          $set: {
            updatedAt: new Date(),
          },
        },
        { session }
      );

      if (bookUpdate.modifiedCount !== 1) {
        throw createError(
          409,
          "Book copy could not be restored. Check book inventory."
        );
      }

      const returnedAt = new Date();

      // Update borrowing record
      await records.updateOne(
        {
          _id: recordId,
          status: "issued",
        },
        {
          $set: {
            status: "returned",
            returnedAt,
            returnedBy: req.user.id,
            returnedByName: req.user.name,
            updatedAt: returnedAt,
          },
          $unset: {
            activeKey: "",
          },
        },
        { session }
      );

      return {
        recordId,
        bookId: record.bookId,
        bookTitle: record.bookTitle,
        returnedAt,
      };
    });

    res.status(200).json({
      success: true,
      message: "Book returned successfully.",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  } finally {
    await session.endSession();
  }
};

