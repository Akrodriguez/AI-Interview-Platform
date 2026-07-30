const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      default: "",
    },
    feedback: {
      type: String,
      default: "",
    },
    score: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const interviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      required: true,
    },

    experience: {
      type: Number,
      required: true,
    },

    techStack: [
      {
        type: String,
      },
    ],

    description: {
      type: String,
      default: "",
    },

    questions: [questionSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Interview", interviewSchema);