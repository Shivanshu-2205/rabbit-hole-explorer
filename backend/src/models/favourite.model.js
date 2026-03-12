import mongoose from 'mongoose';

const favouriteSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    title: {
      type:     String,
      required: true,
      trim:     true,   // the original search term
    },
    customName: {
      type:    String,
      trim:    true,
      default: null,    // null until user renames it
    },
    // The explored path — same shape as history path
    path: [
      {
        id:       { type: String, required: true },
        name:     { type: String, required: true },
        category: { type: String, default: 'other' },
        color:    { type: String, default: '#4a9eff' },
        icon:     { type: String, default: '🔵' },
      },
    ],
  },
  { timestamps: true }
);

export const Favourite = mongoose.model('Favourite', favouriteSchema);