import mongoose from 'mongoose';

const historySchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,   // fast lookups by user
    },
    searchTerm: {
      type:     String,
      required: true,
      trim:     true,
    },
    // The path the user took through this rabbit hole
    // e.g. [AI → Machine Learning → Neural Networks]
    path: [
      {
        id:       { type: String, required: true },   // Wikipedia page key
        name:     { type: String, required: true },
        category: { type: String, default: 'other' },
        color:    { type: String, default: '#4a9eff' },
        icon:     { type: String, default: '🔵' },
      },
    ],
  },
  { timestamps: true }
);

export const History = mongoose.model('History', historySchema);